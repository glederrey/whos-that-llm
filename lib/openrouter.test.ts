import assert from "node:assert/strict";
import test from "node:test";
import { buildModelMessages } from "./openrouter";

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
