import assert from "node:assert/strict";
import test from "node:test";
import { shuffled } from "./home-demo-rounds";

test("shuffled keeps every item and leaves the input alone", () => {
  const input = [1, 2, 3, 4, 5, 6];
  const out = shuffled(input, Math.random);
  assert.deepEqual([...out].sort(), input);
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6]);
});

test("shuffled follows the random source", () => {
  assert.deepEqual(shuffled([1, 2, 3], () => 0), [2, 3, 1]);
  assert.deepEqual(shuffled([1, 2, 3], () => 0.999), [1, 2, 3]);
});
