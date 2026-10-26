import assert from "node:assert/strict";
import test from "node:test";
import { tokenMatches, wantsApply } from "./api-request";

test("the right token matches", () => {
  assert.equal(tokenMatches("Bearer secret-token", "secret-token"), true);
  assert.equal(tokenMatches("bearer secret-token", "secret-token"), true);
});

test("a wrong, missing, or differently sized token does not match", () => {
  assert.equal(tokenMatches("Bearer wrong-token!", "secret-token"), false);
  assert.equal(tokenMatches("Bearer secret", "secret-token"), false);
  assert.equal(tokenMatches("Bearer secret-token-and-more", "secret-token"), false);
  assert.equal(tokenMatches(null, "secret-token"), false);
  assert.equal(tokenMatches("secret-token", "secret-token"), false);
  assert.equal(tokenMatches("Basic secret-token", "secret-token"), false);
  assert.equal(tokenMatches("Bearer ", "secret-token"), false);
});

test("an unset or empty server token matches nothing", () => {
  assert.equal(tokenMatches("Bearer anything", undefined), false);
  assert.equal(tokenMatches("Bearer ", ""), false);
  assert.equal(tokenMatches("Bearer ", undefined), false);
});

test("only exactly apply=true writes", () => {
  assert.equal(wantsApply("true"), true);
  for (const value of [null, "", "1", "TRUE", "True", "yes", "false", " true", "true "]) assert.equal(wantsApply(value), false);
});
