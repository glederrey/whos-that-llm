import assert from "node:assert/strict";
import test from "node:test";
import { boardSeed } from "./board-seed";

const id = "0f8fad5b-d9cb-469f-a165-70867728950e";

test("other players get a short hash, never their id", () => {
  const seed = boardSeed(id, "Ada", false);
  assert.match(seed, /^[0-9a-f]{16}$/);
  assert.ok(!seed.includes(id));
  assert.equal(seed, boardSeed(id, "Ada", false));
});

test("the viewer keeps their own id so the avatar matches the menu", () => {
  assert.equal(boardSeed(id, "Ada", true), id);
});

test("a row without an id falls back to the name", () => {
  assert.equal(boardSeed("", "Ada", false), "Ada");
});
