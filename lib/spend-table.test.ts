import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityPeriod } from "./openrouter-usage";
import { nextSpendSort, sortSpendRows, spendRows, spendSortOf, type SpendRow } from "./spend-table";

function period(models: ActivityPeriod["models"]): ActivityPeriod {
  return {
    days: 7,
    models,
    requests: models.reduce((sum, row) => sum + row.requests, 0),
    promptTokens: models.reduce((sum, row) => sum + row.promptTokens, 0),
    completionTokens: models.reduce((sum, row) => sum + row.completionTokens, 0),
    usd: models.reduce((sum, row) => sum + row.usd, 0),
  };
}

function model(slug: string, usd: number, requests: number, tokens: number) {
  return { model: slug, requests, promptTokens: tokens, completionTokens: 0, reasoningTokens: 0, usd };
}

const names: Record<string, string> = { "x-ai/grok-4.7": "Grok 4.7", "a/one": "Alpha", "b/two": "Beta" };

test("a spend column cycles through ascending, descending, and the original order", () => {
  assert.deepEqual(nextSpendSort(null, "paid30"), { column: "paid30", dir: "asc" });
  assert.deepEqual(nextSpendSort({ column: "paid30", dir: "asc" }, "paid30"), { column: "paid30", dir: "desc" });
  assert.equal(nextSpendSort({ column: "paid30", dir: "desc" }, "paid30"), null);
  assert.deepEqual(nextSpendSort({ column: "paid30", dir: "desc" }, "model"), { column: "model", dir: "asc" });
  assert.equal(spendSortOf("buttons", "desc"), null);
  assert.deepEqual(spendSortOf("requests7", "desc"), { column: "requests7", dir: "desc" });
});

test("sorting moves model rows and leaves the original order for the third click", () => {
  const week = period([model("b/two", 2, 3, 30), model("a/one", 1, 9, 10)]);
  const month = period([model("a/one", 5, 4, 100), model("x-ai/grok-4.7", 0.0073, 2, 3875), model("b/two", 2, 3, 30)]);
  const rows = spendRows(week, month, (slug) => names[slug] ?? slug);
  assert.deepEqual(rows.map((row) => row.slug), ["a/one", "x-ai/grok-4.7", "b/two"]);
  assert.equal(rows.some((row) => row.name === "All models"), false);
  const namesOf = (sorted: SpendRow[]) => sorted.map((row) => row.name);
  assert.deepEqual(namesOf(sortSpendRows(rows, null)), ["Alpha", "Grok 4.7", "Beta"]);
  assert.deepEqual(namesOf(sortSpendRows(rows, { column: "model", dir: "asc" })), ["Alpha", "Beta", "Grok 4.7"]);
  assert.deepEqual(namesOf(sortSpendRows(rows, { column: "model", dir: "desc" })), ["Grok 4.7", "Beta", "Alpha"]);
  assert.deepEqual(namesOf(sortSpendRows(rows, { column: "paid30", dir: "asc" })), ["Grok 4.7", "Beta", "Alpha"]);
  assert.deepEqual(namesOf(sortSpendRows(rows, { column: "paid7", dir: "desc" })), ["Beta", "Alpha", "Grok 4.7"]);
  assert.deepEqual(namesOf(sortSpendRows(rows, { column: "requests7", dir: "asc" })), ["Grok 4.7", "Beta", "Alpha"]);
  assert.deepEqual(namesOf(sortSpendRows(rows, { column: "tokens30", dir: "desc" })), ["Grok 4.7", "Alpha", "Beta"]);
});
