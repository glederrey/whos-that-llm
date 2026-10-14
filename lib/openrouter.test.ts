import assert from "node:assert/strict";
import test from "node:test";
import { buildModelMessages, rawCallTokens } from "./openrouter";

test("each turn sends the earlier user and assistant messages", () => {
  const messages = buildModelMessages([
    { role: "user", content: "What is a prime?" },
    { role: "assistant", content: "A number with no divisors but 1 and itself." },
    { role: "user", content: "Name one under 10." },
  ]);
  assert.deepEqual(messages, [
    { role: "user", content: "What is a prime?" },
    { role: "assistant", content: "A number with no divisors but 1 and itself." },
    { role: "user", content: "Name one under 10." },
  ]);
});

test("raw counts prefer OpenRouter prompt and completion totals", () => {
  const tokens = rawCallTokens(
    { inputTokens: 40, outputTokens: 12, reasoningTokens: 1, cacheReadTokens: 2 },
    {
      promptTokens: 1500,
      completionTokens: 0,
      completionTokensDetails: { reasoningTokens: 80 },
      promptTokensDetails: { cachedTokens: 64 },
    },
  );
  assert.deepEqual(tokens, { input: 1500, output: 0, reasoning: 80, cacheRead: 64 });
});

test("missing reasoning and cache read are zero and are not folded into the prompt", () => {
  const tokens = rawCallTokens({ inputTokens: 90, outputTokens: 7 }, {});
  assert.deepEqual(tokens, { input: 90, output: 7, reasoning: 0, cacheRead: 0 });
});
