import assert from "node:assert/strict";
import test from "node:test";
import { maxCustomModels, parseCustomModelIds } from "./custom-mode";

test("a list of model ids is kept in order without repeats", () => {
  assert.deepEqual(parseCustomModelIds(["claude-opus-5-5", "gpt-5", "claude-opus-5-5"]), ["claude-opus-5-5", "gpt-5"]);
  assert.deepEqual(parseCustomModelIds([]), []);
});

test("anything that is not a list of id-shaped strings is refused", () => {
  assert.equal(parseCustomModelIds(undefined), null);
  assert.equal(parseCustomModelIds("gpt-5"), null);
  assert.equal(parseCustomModelIds([1, 2]), null);
  assert.equal(parseCustomModelIds(["ok", "Not An Id"]), null);
  assert.equal(parseCustomModelIds(["ok", ""]), null);
});

test("a list longer than the cap is refused", () => {
  const ids = Array.from({ length: maxCustomModels + 1 }, (_, index) => `model-${index}`);
  assert.equal(parseCustomModelIds(ids), null);
  assert.equal(parseCustomModelIds(ids.slice(0, maxCustomModels))?.length, maxCustomModels);
});
