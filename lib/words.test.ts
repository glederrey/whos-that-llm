import assert from "node:assert/strict";
import test from "node:test";
import { takeWords } from "./words";

test("words flush only when whitespace closes them", () => {
  let rest = "";
  let emit: string[] = [];
  ({ emit, rest } = takeWords(rest, "Hel", false));
  assert.deepEqual(emit, []);
  ({ emit, rest } = takeWords(rest, "lo wor", false));
  assert.deepEqual(emit, ["Hello "]);
  assert.equal(rest, "wor");
  ({ emit, rest } = takeWords(rest, "ld", true));
  assert.deepEqual(emit, ["world"]);
  assert.equal(rest, "");
});
