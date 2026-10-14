import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { countGptTokens } from "./gpt-tokens";
import {
  blacklistReason,
  emitPaced,
  openRouterRequestOptions,
  outputAboveCount,
  outputGapPercent,
  revealStride,
  revealWords,
  visibleOutput,
} from "./provider-check";

const root = path.resolve(import.meta.dirname, "..");

test("visible output drops reported reasoning that sits inside the completion count", () => {
  assert.equal(visibleOutput(690, 314), 376);
  assert.equal(visibleOutput(1000, 0), 1000);
  assert.equal(visibleOutput(200, 400), 200);
});

test("a provider is blacklisted only when visible output is more than 10% and more than 16 tokens above the count", () => {
  assert.equal(outputAboveCount(100, 110, 0), false);
  assert.equal(outputAboveCount(100, 111, 0), false);
  assert.equal(outputAboveCount(100, 116, 0), false);
  assert.equal(outputAboveCount(100, 117, 0), true);
  assert.equal(outputAboveCount(28, 32, 0), false);
  assert.equal(outputAboveCount(14, 14, 0), false);
  assert.equal(outputAboveCount(180, 1000, 0), true);
  assert.equal(outputAboveCount(376, 690, 314), false);
  assert.equal(outputAboveCount(300, 690, 314), true);
  assert.equal(outputAboveCount(0, 0, 0), false);
  assert.equal(outputAboveCount(0, 5, 0), false);
  assert.equal(outputAboveCount(0, 17, 0), true);
  assert.equal(outputGapPercent(180, 1000, 0), 456);
});

test("the blacklist reason keeps the date, model, provider, messages, and token counts", () => {
  const reason = blacklistReason({
    at: new Date("2026-10-14T18:50:00.000Z"),
    model: "qwen/qwen3-8b",
    provider: "chutes",
    inputText: "user\nHello",
    outputText: "A short story",
    inputTokens: 621,
    outputTokens: 1000,
    reasoningTokens: 0,
    cachedTokens: 12,
    gptTokens: 180,
  });
  assert.match(reason, /Date: 2026-10-14T18:50:00.000Z/);
  assert.match(reason, /Model: qwen\/qwen3-8b/);
  assert.match(reason, /Provider: chutes/);
  assert.match(reason, /Input tokens: 621/);
  assert.match(reason, /Output tokens: 1,000/);
  assert.match(reason, /Reasoning tokens: 0/);
  assert.match(reason, /Cached tokens: 12/);
  assert.match(reason, /gpt-tokenizer: 180/);
  assert.match(reason, /threshold 10%, and more than 16 tokens/);
  assert.match(reason, /Input:\nuser\nHello/);
  assert.match(reason, /Output:\nA short story/);
  const compared = blacklistReason({
    at: new Date("2026-10-14T18:50:00.000Z"),
    model: "qwen/qwen3-8b",
    provider: "deka",
    inputText: "in",
    outputText: "out",
    inputTokens: 10,
    outputTokens: 690,
    reasoningTokens: 314,
    cachedTokens: 0,
    gptTokens: 300,
  });
  assert.match(compared, /subtracting 314 reported reasoning tokens/);
});

test("reasoning calls send effort low and skip blacklisted providers", () => {
  assert.deepEqual(openRouterRequestOptions({ reasoning: { effort: "xhigh" }, provider: { order: ["a"] } }, true, ["chutes"]), {
    usage: { include: true },
    provider: { order: ["a"], ignore: ["chutes"] },
    reasoning: { effort: "low" },
  });
  assert.deepEqual(openRouterRequestOptions({ reasoning: { effort: "low" } }, false, []), {
    usage: { include: true },
  });
  assert.deepEqual(openRouterRequestOptions({ provider: { ignore: ["old"] } }, true, ["old", "chutes"]), {
    usage: { include: true },
    provider: { ignore: ["old", "chutes"] },
    reasoning: { effort: "low" },
  });
});

test("a held reply is released a word at a time until the reply is long", async () => {
  assert.equal(revealStride(1), 1);
  assert.equal(revealStride(45), 1);
  assert.equal(revealStride(46), 2);
  const words: string[] = [];
  const pending = revealWords("one two three four", (word) => words.push(word));
  assert.equal(words.length, 1);
  await pending;
  assert.equal(words.join(""), "one two three four");
  const burst: string[] = [];
  await emitPaced(["a ", "b "], (word) => burst.push(word), false);
  assert.deepEqual(burst, ["a ", "b "]);
});

test("gpt-tokenizer counts the visible reply", () => {
  const count = countGptTokens("Hello, how are you?");
  assert.ok(count > 0 && count < 20);
  assert.equal(countGptTokens(""), 0);
});

test("the provider page lists both tables and can clear a blacklist", () => {
  const page = fs.readFileSync(path.join(root, "app/admin/providers/page.tsx"), "utf8");
  const nav = fs.readFileSync(path.join(root, "components/section-nav.tsx"), "utf8");
  const openrouter = fs.readFileSync(path.join(root, "lib/openrouter.ts"), "utf8");
  const config = fs.readFileSync(path.join(root, "lib/config.ts"), "utf8");
  const prompt = fs.readFileSync(path.join(root, "lib/prompt.ts"), "utf8");
  assert.match(page, /OpenRouter providers/);
  assert.match(page, /Blacklisted/);
  assert.match(page, /Trusted/);
  assert.match(page, /Deblacklist/);
  assert.match(page, /action=\{clearProvider\}/);
  assert.match(nav, /href="\/admin\/providers"/);
  assert.match(openrouter, /includeRawChunks: true/);
  assert.match(openrouter, /outputAboveCount/);
  assert.match(openrouter, /out\.reveal\(text\)/);
  assert.match(openrouter, /emitPaced/);
  assert.match(config, /maxOutputTokens: 2000/);
  assert.match(prompt, /2,000 tokens/);
});
