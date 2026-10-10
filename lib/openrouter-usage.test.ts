import assert from "node:assert/strict";
import test from "node:test";
import { isoDaysBefore, parseActivity, parseKeyUsage, summarize } from "./openrouter-usage";

test("key usage reads all-time, week, month, and the cap", () => {
  const usage = parseKeyUsage({
    data: { usage: 25.5, usage_daily: 1.5, usage_weekly: 7, usage_monthly: 12, limit: 100, limit_remaining: 74.5 },
  });
  assert.deepEqual(usage, { allTime: 25.5, today: 1.5, week: 7, month: 12, limit: 100, limitRemaining: 74.5 });
  assert.equal(parseKeyUsage({ data: { usage: 3, limit: null } })?.limit, null);
  assert.equal(parseKeyUsage({}), null);
  assert.equal(parseKeyUsage({ data: { label: "x" } }), null);
});

test("activity rows are grouped per model over a window of completed days", () => {
  const rows = parseActivity({
    data: [
      { date: "2026-10-09", model: "a/one", requests: 2, prompt_tokens: 100, completion_tokens: 50, reasoning_tokens: 10, usage: 0.5 },
      { date: "2026-10-09", model: "a/one", requests: 1, prompt_tokens: 10, completion_tokens: 5, reasoning_tokens: 0, usage: 0.25 },
      { date: "2026-10-01", model: "a/one", requests: 4, prompt_tokens: 400, completion_tokens: 40, reasoning_tokens: 0, usage: 1 },
      { date: "2026-10-08", model: "b/two", requests: 3, prompt_tokens: 30, completion_tokens: 30, reasoning_tokens: 0, usage: 2 },
      { date: "bad" },
    ],
  });
  assert.ok(rows);
  assert.equal(rows.length, 4);
  const now = new Date("2026-10-10T18:00:00Z");
  assert.equal(isoDaysBefore(now, 7), "2026-10-03");
  const week = summarize(rows, 7, now);
  assert.deepEqual(week.models.map((row) => row.model), ["b/two", "a/one"]);
  assert.equal(week.usd, 2.75);
  assert.equal(week.requests, 6);
  assert.equal(week.models[1].promptTokens, 110);
  const month = summarize(rows, 30, now);
  assert.equal(month.usd, 3.75);
  assert.equal(month.requests, 10);
  assert.equal(parseActivity({ data: "nope" }), null);
});
