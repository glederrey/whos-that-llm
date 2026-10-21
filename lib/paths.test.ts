import assert from "node:assert/strict";
import test from "node:test";
import { isUuid, safeNext } from "./paths";

test("a next path stays on this site", () => {
  assert.equal(safeNext("/play"), "/play");
  assert.equal(safeNext("/welcome?next=/play"), "/welcome?next=/play");
  assert.equal(safeNext("/play#round"), "/play#round");
  assert.equal(safeNext(undefined), "/");
  assert.equal(safeNext("https://example.com"), "/");
  assert.equal(safeNext("//example.com"), "/");
  assert.equal(safeNext("/\\example.com"), "/");
  assert.equal(safeNext("/%2f%2fexample.com"), "/");
  assert.equal(safeNext("/%5cexample.com"), "/");
  assert.equal(safeNext("/play\nset"), "/");
  assert.equal(safeNext(" /play"), "/");
});

test("only a UUID counts as a game id", () => {
  assert.equal(isUuid("0f8fad5b-d9cb-469f-a165-70867728950e"), true);
  assert.equal(isUuid("0F8FAD5B-D9CB-469F-A165-70867728950E"), true);
  assert.equal(isUuid("abc"), false);
  assert.equal(isUuid("0f8fad5b-d9cb-469f-a165-70867728950e "), false);
  assert.equal(isUuid(""), false);
});
