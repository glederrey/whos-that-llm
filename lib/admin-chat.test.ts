import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { chatTurns, parseAdminChat, readSentTurns, searchChatModels, transcriptForCall } from "./admin-chat";
import { scoreTokens } from "./game";
import { callInput } from "./openrouter";
import { inputSinceStartMatchesPrompt, replyTokenLines, replyTokenTooltip } from "./reply-tokens";

const root = path.resolve(import.meta.dirname, "..");

test("a test chat can run past ten messages and past 500 characters", () => {
  const transcript = [];
  for (let index = 0; index < 12; index++) {
    transcript.push({ role: "user" as const, content: "q".repeat(600) });
    transcript.push({ role: "assistant" as const, content: index === 3 ? "" : "a" });
  }
  const parsed = parseAdminChat({ modelId: "deepseek-v4-pro", text: "z".repeat(800), transcript });
  assert.ok(parsed);
  assert.equal(parsed.transcript.length, 24);
  assert.equal(parsed.transcript[7].content, "");
  assert.equal(chatTurns(parsed.transcript)[0].content.length, 600);
  assert.equal(chatTurns(parsed.transcript)[7].content, "");
});

test("a failed reply stays visible and is left out of the next call", () => {
  const turns = transcriptForCall([
    { role: "user", content: "Hi" },
    { role: "assistant", content: "" },
    { role: "user", content: "Again" },
    { role: "assistant", content: "The reply failed.", failed: true },
  ]);
  assert.deepEqual(turns, [
    { role: "user", content: "Hi" },
    { role: "assistant", content: "" },
  ]);
});

test("later input is the new player message, and reasoning that was not sent again is not subtracted", () => {
  const views = replyTokenLines([
    { promptTokens: 1000, completionTokens: 50, reasoningTokens: 30, cacheReadTokens: 100 },
    { promptTokens: 1200, completionTokens: 0, reasoningTokens: 8, cacheReadTokens: 0 },
    { promptTokens: 1400, completionTokens: 20 },
  ]);
  assert.equal(views[0].input, 1000);
  assert.equal(views[0].output, 50);
  assert.equal(views[0].sinceStart, 1000);
  assert.equal(views[0].reasoning, 30);
  assert.equal(views[0].cacheRead, 100);
  assert.equal(views[1].input, 180);
  assert.equal(views[1].output, 0);
  assert.equal(views[1].sinceStart, 1180);
  assert.equal(views[1].reasoning, 8);
  assert.equal(views[1].cacheRead, 0);
  assert.equal(views[2].input, 200);
  assert.equal(views[2].reasoning, 0);
  assert.equal(views[2].cacheRead, 0);
  assert.equal(views[2].sinceStart, 1380);
  assert.notEqual(views[2].sinceStart, 1000 + 1200 + 1400);
  assert.equal(views[2].rawPrompt, 1400);
  assert.equal(inputSinceStartMatchesPrompt(views), true);
  assert.deepEqual(replyTokenTooltip(views[1]), [
    "Input tokens: 180",
    "Output tokens: 0",
    "Reasoning tokens: 8",
    "Cache read tokens: 0",
    "",
    "Prompt tokens: 1,200",
    "Total input tokens: 1,180",
    "Total output tokens: 20",
    "Total tokens: 1,200",
  ]);
  assert.notEqual(views[1].input, 1200 - 1000 - 50);
});

test("reasoning inside the completion count is left out of the output lines", () => {
  const views = replyTokenLines([
    { promptTokens: 341, completionTokens: 204, reasoningTokens: 193, cacheReadTokens: 256 },
    { promptTokens: 360, completionTokens: 40, reasoningTokens: 10 },
  ]);
  assert.equal(views[0].output, 204);
  assert.equal(views[0].reasoning, 193);
  assert.equal(views[0].outputTotal, 11);
  assert.equal(views[1].outputTotal, 11 + (40 - 10));
  assert.equal(inputSinceStartMatchesPrompt(views), true);
  assert.deepEqual(replyTokenTooltip(views[0]), [
    "Input tokens: 341",
    "Output tokens: 11",
    "Reasoning tokens: 193",
    "Cache read tokens: 256",
    "",
    "Prompt tokens: 341",
    "Total input tokens: 341",
    "Total output tokens: 11",
    "Total tokens: 352",
  ]);
  assert.equal(replyTokenTooltip(views[1])[1], "Output tokens: 30");
  assert.equal(replyTokenTooltip(views[1])[7], "Total output tokens: 41");
});

test("a provider that omits reasoning cannot push the next input negative", () => {
  const views = replyTokenLines([
    { promptTokens: 408, completionTokens: 111, reasoningTokens: 45 },
    { promptTokens: 497, completionTokens: 1000, reasoningTokens: 0 },
    { promptTokens: 621, completionTokens: 690, reasoningTokens: 314 },
  ]);
  assert.equal(views[1].input, 23);
  assert.equal(views[1].output, 1000);
  assert.equal(views[1].reasoning, 876);
  assert.equal(replyTokenTooltip(views[1])[1], "Output tokens: 124");
  assert.equal(replyTokenTooltip(views[1])[2], "Reasoning tokens: 876");
  assert.equal(views[2].input, 0);
  assert.equal(views[2].rawPrompt, 621);
  assert.equal(replyTokenTooltip(views[2])[0], "Input tokens: 0");
  assert.equal(replyTokenTooltip(views[2])[1], "Output tokens: 376");
  assert.equal(replyTokenTooltip(views[2])[5], "Prompt tokens: 621");
  assert.equal(inputSinceStartMatchesPrompt(views), true);
});

test("reasoning larger than the completion stays out of the output subtraction", () => {
  const views = replyTokenLines([{ promptTokens: 1000, completionTokens: 200, reasoningTokens: 400 }]);
  assert.equal(views[0].outputTotal, 200);
  assert.equal(replyTokenTooltip(views[0])[1], "Output tokens: 200");
  assert.equal(replyTokenTooltip(views[0])[2], "Reasoning tokens: 400");
});

test("a reply whose completion includes reasoning does not make the next input negative", () => {
  const views = replyTokenLines([
    { promptTokens: 320, completionTokens: 51, reasoningTokens: 36, cacheReadTokens: 0 },
    { promptTokens: 351, completionTokens: 177, reasoningTokens: 118, cacheReadTokens: 0 },
  ]);
  assert.equal(views[0].input, 320);
  assert.equal(views[1].input, 351 - 320 - (51 - 36));
  assert.equal(views[1].input, 16);
  assert.equal(views[1].sinceStart, 336);
  assert.equal(views[1].output, 177);
  assert.equal(views[1].reasoning, 118);
  assert.equal(inputSinceStartMatchesPrompt(views), true);
  assert.equal(views[1].sinceStart + (51 - 36), views[1].rawPrompt);
});

test("a smaller later prompt matches the score and leaves reasoning out", () => {
  const views = replyTokenLines([
    { promptTokens: 1000, completionTokens: 200, reasoningTokens: 400, cacheReadTokens: 700 },
    { promptTokens: 1050, completionTokens: 40, reasoningTokens: 10, cacheReadTokens: 900 },
  ]);
  const scored = scoreTokens([
    { inputTokens: 1000, outputTokens: 200 },
    { inputTokens: 1050, outputTokens: 40 },
  ]);
  assert.equal(views[1].input, scored.turns[1].inputTokens);
  assert.equal(views[1].input, -150);
  assert.equal(views[1].sinceStart, scored.inputTokens);
  assert.equal(scored.tokens, 1050 + 40);
  assert.equal(views[0].reasoning, 400);
  assert.equal(views[1].cacheRead, 900);
  assert.equal(views[1].sinceStart + views[0].output + views[1].output, scored.tokens);
});

test("the admin chat reuses the play send path and writes nothing", () => {
  const route = fs.readFileSync(path.join(root, "app/admin/chat/send/route.ts"), "utf8");
  const game = fs.readFileSync(path.join(root, "app/api/games/[id]/messages/route.ts"), "utf8");
  const openrouter = fs.readFileSync(path.join(root, "lib/openrouter.ts"), "utf8");
  const page = fs.readFileSync(path.join(root, "app/admin/chat/page.tsx"), "utf8");
  const chat = fs.readFileSync(path.join(root, "components/admin-chat.tsx"), "utf8");
  const board = fs.readFileSync(path.join(root, "components/round-board.tsx"), "utf8");
  const result = fs.readFileSync(path.join(root, "app/play/[gameId]/result/page.tsx"), "utf8");
  assert.match(route, /streamPlayedReply/);
  assert.match(game, /streamPlayedReply/);
  assert.match(game, /saveReply\(id, user\.id, trimmed, reply\.text, reply\.usage\)/);
  assert.doesNotMatch(game, /reply\.tokens/);
  assert.match(openrouter, /const system = systemPrompt\(\)/);
  assert.match(openrouter, /system,/);
  assert.match(openrouter, /export async function streamPlayedReply/);
  assert.doesNotMatch(route, /streamText|systemPrompt\(|saveReply|from\("games"\)|from\("messages"\)|from\("guesses"\)|from\("usage"\)|\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  assert.match(page, /await requireOwner\(\)/);
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(chat, /MessageBubble/);
  assert.match(chat, /readReplyEvents/);
  assert.match(chat, /Show tokens/);
  assert.doesNotMatch(chat, /ReplyTokenTip|reply-tooltip/);
  assert.doesNotMatch(chat, /sessionStorage|localStorage|messageLimit|maxUserChars|admin-access|admin-roster/);
  assert.match(board, /MessageBubble/);
  assert.match(board, /readReplyEvents/);
  assert.match(result, /MessageBubble/);
  assert.match(openrouter, /inputTokens: usage\.inputTokens \?\? numberFrom\(accounted\.promptTokens\)/);
  assert.match(openrouter, /outputTokens: usage\.outputTokens \?\? numberFrom\(accounted\.completionTokens\)/);
  assert.match(route, /sent: reply\.sent/);
  assert.doesNotMatch(game, /reply\.sent/);
  assert.match(chat, /CompanyLogo/);
  assert.match(chat, /Show input/);
  assert.match(chat, /searchChatModels/);
  assert.match(chat, /onFocus=\{\(\) => setListOpen\(true\)\}/);
  assert.match(chat, /\{listOpen \?/);
  assert.match(chat, /selected && !listOpen/);
});

test("the message box grows with the text on chat and on a round", () => {
  const composer = fs.readFileSync(path.join(root, "components/chat-composer.tsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  const chat = fs.readFileSync(path.join(root, "components/admin-chat.tsx"), "utf8");
  const board = fs.readFileSync(path.join(root, "components/round-board.tsx"), "utf8");
  assert.match(composer, /field\.scrollHeight/);
  assert.match(composer, /overflowY = capped \? "auto" : "hidden"/);
  assert.match(chat, /<ChatComposer/);
  assert.match(board, /<ChatComposer/);
  assert.match(css, /\.composer textarea \{[^}]*resize: none;[^}]*overflow-y: hidden;/);
  assert.match(css, /\.composer textarea \{[^}]*max-height: 28rem;/);
  assert.doesNotMatch(css, /\.composer textarea \{[^}]*resize: vertical/);
  assert.match(css, /\.bubble \{[^}]*width: fit-content;[^}]*max-width: 70%;/);
  assert.match(css, /\.reply-block \{[^}]*max-width: 70%;/);
  assert.match(css, /\.bubble, \.reply-block \{ max-width: 94%; \}/);
});

test("search matches a model name or company and keeps the list in order", () => {
  const models = [
    { name: "Claude Haiku", companyName: "Anthropic" },
    { name: "DeepSeek V4 Pro", companyName: "DeepSeek" },
    { name: "GPT Luna", companyName: "OpenAI" },
  ];
  assert.deepEqual(searchChatModels(models, "  "), models);
  assert.deepEqual(
    searchChatModels(models, "deep").map((model) => model.name),
    ["DeepSeek V4 Pro"],
  );
  assert.deepEqual(
    searchChatModels(models, "OPEN").map((model) => model.name),
    ["GPT Luna"],
  );
});

test("the sent input is the system prompt, then the whole visible conversation", () => {
  const sent = callInput("Be yourself.", [
    { role: "user", content: "Hello, how are you?" },
    { role: "assistant", content: "Hello! I'm doing well, thanks. How are you today?" },
    { role: "user", content: "I'm doing good. Can you tell me who you are?" },
  ]);
  assert.deepEqual(sent, [
    { role: "system", content: "Be yourself." },
    { role: "user", content: "Hello, how are you?" },
    { role: "assistant", content: "Hello! I'm doing well, thanks. How are you today?" },
    { role: "user", content: "I'm doing good. Can you tell me who you are?" },
  ]);
  assert.deepEqual(readSentTurns(sent), sent);
  assert.equal(readSentTurns([{ role: "tool", content: "no" }]), null);
});
