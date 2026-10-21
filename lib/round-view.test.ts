import assert from "node:assert/strict";
import test from "node:test";
import { filterCandidates, parseOpenedHints, replyFailureNotice, withOpenedHint } from "./round-view";

test("a paused game gets its own notice, any other failure the retry notice", () => {
  assert.equal(replyFailureNotice(true), "The game is paused. Try again later.");
  assert.equal(replyFailureNotice(false), "The reply failed. Send it again.");
  assert.equal(replyFailureNotice(undefined), "The reply failed. Send it again.");
});

test("candidates filter on model or company, ignoring case and spaces around", () => {
  const rows = [
    { name: "Claude Haiku", companyName: "Anthropic" },
    { name: "GPT", companyName: "OpenAI" },
  ];
  assert.equal(filterCandidates(rows, "  ").length, 2);
  assert.deepEqual(filterCandidates(rows, " haiku "), [rows[0]]);
  assert.deepEqual(filterCandidates(rows, "OPENAI"), [rows[1]]);
  assert.deepEqual(filterCandidates(rows, "zzz"), []);
});

test("opened hints parse from storage and never duplicate", () => {
  assert.deepEqual(parseOpenedHints('["year"]'), ["year"]);
  assert.deepEqual(parseOpenedHints("not json"), []);
  const opened = withOpenedHint([], "year");
  assert.deepEqual(opened, ["year"]);
  assert.equal(withOpenedHint(opened, "year"), opened);
  assert.deepEqual(withOpenedHint(opened, "size"), ["year", "size"]);
});
