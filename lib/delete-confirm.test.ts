import assert from "node:assert/strict";
import test from "node:test";
import { deleteConfirmed } from "./delete-confirm";

test("the delete word confirms whatever its case or outer spaces", () => {
  assert.equal(deleteConfirmed("delete"), true);
  assert.equal(deleteConfirmed("  DELETE "), true);
  assert.equal(deleteConfirmed("Delete"), true);
});

test("anything else does not confirm", () => {
  assert.equal(deleteConfirmed(""), false);
  assert.equal(deleteConfirmed("dele"), false);
  assert.equal(deleteConfirmed("delete me"), false);
  assert.equal(deleteConfirmed("de lete"), false);
});
