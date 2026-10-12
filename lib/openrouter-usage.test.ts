import assert from "node:assert/strict";
import test from "node:test";
import {
  analyticsTruncated,
  canonicalModel,
  currentDayRange,
  isoDaysBefore,
  mergeCurrentDay,
  modelAliases,
  parseActivity,
  parseAnalyticsModels,
  parseKeyUsage,
  summarize,
} from "./openrouter-usage";

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

test("7-day and 30-day windows include the current UTC day", () => {
  const now = new Date("2026-10-12T18:00:00Z");
  const completed = [
    { date: "2026-10-11", model: "anthropic/claude-haiku-4.5", requests: 10, promptTokens: 100, completionTokens: 50, reasoningTokens: 0, usd: 0.17 },
    { date: "2026-09-01", model: "old/model", requests: 1, promptTokens: 1, completionTokens: 1, reasoningTokens: 0, usd: 1 },
  ];
  const today = [
    {
      date: "2026-10-12",
      model: "x-ai/grok-4.7-2026-09-21",
      requests: 2,
      promptTokens: 3000,
      completionTokens: 875,
      reasoningTokens: 0,
      usd: 0.0073,
    },
  ];
  const known = ["anthropic/claude-haiku-4.5", "x-ai/grok-4.7", "openai/gpt-5.6-luna", "openai/gpt-5.6-luna-pro"];
  const merged = mergeCurrentDay(completed, today, (slug) => canonicalModel(slug, {}, known));
  const week = summarize(merged, 7, now);
  const month = summarize(merged, 30, now);
  assert.equal(week.models.some((row) => row.model === "x-ai/grok-4.7"), true);
  assert.equal(month.models.some((row) => row.model === "x-ai/grok-4.7"), true);
  assert.equal(month.models.some((row) => row.model === "old/model"), false);
  assert.equal(week.usd, month.usd);
  assert.equal(week.usd, 0.1773);
  assert.equal(week.requests, 12);
});

test("today's analytics rows join activity without double counting or collapsing a longer model name", () => {
  const payload = {
    data: {
      data: [
        {
          date__day: "2026-10-12T00:00:00.000Z",
          model: "x-ai/grok-4.7-2026-09-21",
          request_count: "2",
          tokens_prompt: "3000",
          tokens_completion: "875",
          tokens_total: "4000",
          total_usage: 0.0073,
        },
        { request_count: "9", total_usage: 1 },
      ],
      metadata: { truncated: false },
    },
  };
  const rows = parseAnalyticsModels(payload, "2026-10-12");
  assert.equal(rows?.length, 1);
  assert.equal(rows?.[0].date, "2026-10-12");
  assert.equal(rows?.[0].requests, 2);
  assert.equal(rows?.[0].promptTokens, 3000);
  assert.equal(rows?.[0].completionTokens, 875);
  assert.equal(parseAnalyticsModels({ data: { data: "nope" } }, "2026-10-12"), null);
  assert.equal(analyticsTruncated({ data: { metadata: { truncated: true }, data: [] } }), true);
  const aliases = modelAliases({
    data: [{ date: "2026-10-11", model: "x-ai/grok-4.7", model_permaslug: "x-ai/grok-4.7-2026-09-21" }],
  });
  assert.equal(canonicalModel("x-ai/grok-4.7-2026-09-21", aliases, []), "x-ai/grok-4.7");
  assert.equal(
    canonicalModel("openai/gpt-5.6-luna-pro-2026-01-01", {}, ["openai/gpt-5.6-luna", "openai/gpt-5.6-luna-pro"]),
    "openai/gpt-5.6-luna-pro",
  );
  assert.equal(canonicalModel("openai/gpt-5.6-luna-pro", {}, ["openai/gpt-5.6-luna"]), "openai/gpt-5.6-luna-pro");
  assert.equal(
    canonicalModel("deepseek/deepseek-v4-pro", {}, ["deepseek/deepseek-v4-pro-0813", "deepseek/deepseek-v4-flash-0731"]),
    "deepseek/deepseek-v4-pro-0813",
  );
  assert.equal(canonicalModel("deepseek/deepseek-v4-flash", {}, ["deepseek/deepseek-v4-flash-0731"]), "deepseek/deepseek-v4-flash-0731");
  assert.equal(
    canonicalModel("deepseek/deepseek-v4-pro", {}, ["deepseek/deepseek-v4-pro-0813", "deepseek/deepseek-v4-pro-0901"]),
    "deepseek/deepseek-v4-pro",
  );
  const counted = mergeCurrentDay(
    [{ date: "2026-10-12", model: "x-ai/grok-4.7", requests: 2, promptTokens: 1, completionTokens: 1, reasoningTokens: 0, usd: 0.0073 }],
    [{ date: "2026-10-12", model: "x-ai/grok-4.7-2026-09-21", requests: 2, promptTokens: 9, completionTokens: 9, reasoningTokens: 0, usd: 0.0073 }],
    (slug) => canonicalModel(slug, {}, ["x-ai/grok-4.7"]),
  );
  assert.equal(counted.length, 1);
  assert.equal(counted[0].requests, 2);
  assert.equal(counted[0].promptTokens, 1);
  const range = currentDayRange(new Date("2026-10-12T18:04:05.123Z"));
  assert.equal(range.start, "2026-10-12T00:00:00Z");
  assert.equal(range.end, "2026-10-12T18:04:05Z");
  assert.equal(currentDayRange(new Date("2026-10-12T00:00:00.000Z")).end, "2026-10-12T00:00:01Z");
});
