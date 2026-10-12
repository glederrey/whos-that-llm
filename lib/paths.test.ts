import assert from "node:assert/strict";
import test from "node:test";
import { safeNext } from "./paths";

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
