import assert from "node:assert/strict";
import { test } from "node:test";
import { readReplyEvents, sseResponse } from "./reply-events";
import { isCreditError } from "./game";

test("a client that disconnects mid-reply does not stop the work", async () => {
  let finished = false;
  const response = sseResponse(async (send) => {
    send({ type: "word", text: "a" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    send({ type: "word", text: "b" });
    finished = true;
  });
  const reader = response.body!.getReader();
  await reader.read();
  await reader.cancel();
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(finished, true);
});

test("events written before the end reach the reader", async () => {
  const seen: string[] = [];
  const response = sseResponse(async (send) => {
    send({ type: "word", text: "a" });
    send({ type: "game" });
  });
  await readReplyEvents(response, (event) => seen.push(event.type));
  assert.deepEqual(seen, ["word", "game"]);
});

test("only HTTP 402 counts as a credit error", () => {
  assert.equal(isCreditError(402), true);
  assert.equal(isCreditError(429), false);
  assert.equal(isCreditError(500), false);
  assert.equal(isCreditError(undefined), false);
});
