import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { chatTurns, parseAdminChat, transcriptForCall } from "./admin-chat";
import { scoreTokens } from "./game";
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

test("later input is the new player message, and reasoning is not added to it", () => {
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
  assert.equal(views[1].input, 150);
  assert.equal(views[1].output, 0);
  assert.equal(views[1].sinceStart, 1150);
  assert.equal(views[1].reasoning, 8);
  assert.equal(views[1].cacheRead, 0);
  assert.equal(views[2].input, 200);
  assert.equal(views[2].reasoning, 0);
  assert.equal(views[2].cacheRead, 0);
  assert.equal(views[2].sinceStart, 1350);
  assert.notEqual(views[2].sinceStart, 1000 + 1200 + 1400);
  assert.equal(views[2].rawPrompt, 1400);
  assert.equal(inputSinceStartMatchesPrompt(views), true);
  assert.deepEqual(replyTokenTooltip(views[1]), [
    "Input tokens: 150",
    "Output tokens: 0",
    "Input tokens since the start of the conversation: 1,150",
    "Reasoning tokens: 8",
    "Cache read tokens: 0",
  ]);
  assert.equal(replyTokenTooltip(views[1]).some((line) => line.includes("1,200")), false);
  const scored = scoreTokens(views.map((view, index) => ({ inputTokens: [1000, 1200, 1400][index], outputTokens: view.output })));
  assert.equal(views[2].sinceStart, scored.inputTokens);
  assert.equal(views[2].input, scored.turns[2].inputTokens);
  assert.equal(scored.tokens, views[2].sinceStart + views.reduce((sum, view) => sum + view.output, 0));
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
  assert.match(openrouter, /system: systemPrompt\(\)/);
  assert.match(openrouter, /export async function streamPlayedReply/);
  assert.doesNotMatch(route, /streamText|systemPrompt\(|saveReply|from\("games"\)|from\("messages"\)|from\("guesses"\)|from\("usage"\)|\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  assert.match(page, /await requireOwner\(\)/);
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(chat, /MessageBubble/);
  assert.match(chat, /readReplyEvents/);
  assert.match(chat, /ReplyTokenTip/);
  assert.doesNotMatch(chat, /sessionStorage|localStorage|messageLimit|maxUserChars|admin-access|admin-roster/);
  assert.match(board, /MessageBubble/);
  assert.match(board, /readReplyEvents/);
  assert.match(result, /MessageBubble/);
  assert.match(openrouter, /inputTokens: usage\.inputTokens \?\? numberFrom\(accounted\.promptTokens\)/);
  assert.match(openrouter, /outputTokens: usage\.outputTokens \?\? numberFrom\(accounted\.completionTokens\)/);
});
