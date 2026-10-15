import { outputGapPercent, visibleOutput } from "./provider-check";

export const providerPageSize = 10;

export const providerSortColumns = [
  "provider",
  "model",
  "updated",
  "input",
  "reasoning",
  "cached",
  "output",
  "gpt",
  "gap",
  "log",
] as const;

export type ProviderSortColumn = (typeof providerSortColumns)[number];

export type ProviderSort = { column: ProviderSortColumn; dir: "asc" | "desc" } | null;

export type ProviderTableRow = {
  slug: string;
  model: string | null;
  updatedAt: string;
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  cachedTokens: number | null;
  gptTokens: number | null;
  reason: string | null;
};

/** Ascending, then descending, then the original order. A different column starts at ascending. */
export function nextProviderSort(current: ProviderSort, column: ProviderSortColumn): ProviderSort {
  if (!current || current.column !== column) return { column, dir: "asc" };
  if (current.dir === "asc") return { column, dir: "desc" };
  return null;
}

export function sortProviderRows<T extends ProviderTableRow>(rows: readonly T[], sort: ProviderSort): T[] {
  if (!sort) return rows.slice();
  const sorted = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => compareRows(a.row, b.row, sort.column) || a.index - b.index)
    .map((item) => item.row);
  return sort.dir === "desc" ? sorted.reverse() : sorted;
}

function compareRows(a: ProviderTableRow, b: ProviderTableRow, column: ProviderSortColumn): number {
  if (column === "provider") return compareText(a.slug, b.slug);
  if (column === "model") return compareTextMissingLast(a.model ?? "", b.model ?? "");
  if (column === "updated") return compareMissingLast(timeOf(a.updatedAt), timeOf(b.updatedAt));
  if (column === "input") return compareMissingLast(a.inputTokens, b.inputTokens);
  if (column === "reasoning") return compareMissingLast(a.reasoningTokens, b.reasoningTokens);
  if (column === "cached") return compareMissingLast(a.cachedTokens, b.cachedTokens);
  if (column === "output") return compareMissingLast(visibleCount(a), visibleCount(b));
  if (column === "gpt") return compareMissingLast(a.gptTokens, b.gptTokens);
  if (column === "gap") return compareMissingLast(gapCount(a), gapCount(b));
  return compareTextMissingLast(a.reason ?? "", b.reason ?? "");
}

function visibleCount(row: ProviderTableRow): number | null {
  if (row.outputTokens === null) return null;
  return visibleOutput(row.outputTokens, row.reasoningTokens ?? 0);
}

function gapCount(row: ProviderTableRow): number | null {
  if (row.outputTokens === null || row.gptTokens === null) return null;
  return outputGapPercent(row.gptTokens, row.outputTokens, row.reasoningTokens ?? 0);
}

function timeOf(value: string): number | null {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "en", { sensitivity: "base" });
}

function compareTextMissingLast(a: string, b: string): number {
  const left = a.trim();
  const right = b.trim();
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return compareText(left, right);
}

function compareMissingLast(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}
