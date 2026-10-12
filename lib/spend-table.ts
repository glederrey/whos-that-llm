import type { ActivityPeriod, ModelActivity } from "./openrouter-usage";

export const spendSortColumns = ["model", "paid7", "requests7", "tokens7", "paid30", "requests30", "tokens30"] as const;

export type SpendSortColumn = (typeof spendSortColumns)[number];

export type SpendSort = { column: SpendSortColumn; dir: "asc" | "desc" } | null;

export type SpendSide = {
  usd: number;
  requests: number;
  promptTokens: number;
  completionTokens: number;
};

export type SpendRow = {
  slug: string;
  name: string;
  week: SpendSide;
  month: SpendSide;
};

export function spendSortOf(sort: unknown, dir: unknown): SpendSort {
  if (typeof sort !== "string" || !spendSortColumns.includes(sort as SpendSortColumn)) return null;
  return { column: sort as SpendSortColumn, dir: dir === "desc" ? "desc" : "asc" };
}

/** Ascending, then descending, then no sort. A different column starts at ascending. */
export function nextSpendSort(current: SpendSort, column: SpendSortColumn): SpendSort {
  if (!current || current.column !== column) return { column, dir: "asc" };
  if (current.dir === "asc") return { column, dir: "desc" };
  return null;
}

function sideOf(row: ModelActivity | undefined): SpendSide {
  if (!row) return { usd: 0, requests: 0, promptTokens: 0, completionTokens: 0 };
  return { usd: row.usd, requests: row.requests, promptTokens: row.promptTokens, completionTokens: row.completionTokens };
}

export function periodSide(period: ActivityPeriod): SpendSide {
  return { usd: period.usd, requests: period.requests, promptTokens: period.promptTokens, completionTokens: period.completionTokens };
}

/** Month order, then any model that only appears in the shorter window. This is the unsorted order. */
export function spendRows(week: ActivityPeriod, month: ActivityPeriod, nameFor: (slug: string) => string): SpendRow[] {
  const weekBy = new Map(week.models.map((row) => [row.model, row]));
  const monthBy = new Map(month.models.map((row) => [row.model, row]));
  const slugs = month.models.map((row) => row.model);
  for (const row of week.models) if (!monthBy.has(row.model)) slugs.push(row.model);
  return slugs.map((slug) => ({ slug, name: nameFor(slug), week: sideOf(weekBy.get(slug)), month: sideOf(monthBy.get(slug)) }));
}

function tokens(side: SpendSide): number {
  return side.promptTokens + side.completionTokens;
}

function compareRows(a: SpendRow, b: SpendRow, column: SpendSortColumn): number {
  if (column === "model") return a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.slug.localeCompare(b.slug);
  if (column === "paid7") return a.week.usd - b.week.usd;
  if (column === "requests7") return a.week.requests - b.week.requests;
  if (column === "tokens7") return tokens(a.week) - tokens(b.week);
  if (column === "paid30") return a.month.usd - b.month.usd;
  if (column === "requests30") return a.month.requests - b.month.requests;
  return tokens(a.month) - tokens(b.month);
}

export function sortSpendRows(rows: SpendRow[], sort: SpendSort): SpendRow[] {
  if (!sort) return rows.slice();
  const sorted = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => compareRows(a.row, b.row, sort.column) || a.index - b.index)
    .map((item) => item.row);
  return sort.dir === "desc" ? sorted.reverse() : sorted;
}
