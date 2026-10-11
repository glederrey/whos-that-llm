import { difficultyNumber, type Difficulty } from "./difficulty";
import { regionLabel, type Region, type Size } from "./game";

export const rosterPageSize = 10;

export const rosterSortColumns = ["name", "company", "region", "year", "size", "difficulty", "input", "output", "classes"] as const;

export type RosterSortColumn = (typeof rosterSortColumns)[number];

export type RosterSort = { column: RosterSortColumn; dir: "asc" | "desc" } | null;

type Searchable = { name: string; companyName: string; classNames: string };

type Sortable = Searchable & {
  id: string;
  region: Region;
  year: string;
  size: Size;
  difficulty: Difficulty | null;
  inputUsdPerMtok: number | null;
  outputUsdPerMtok: number | null;
};

const sizeRank: Record<Size, number> = { nano: 0, small: 1, medium: 2, large: 3, xxl: 4 };

export function rosterSortOf(sort: unknown, dir: unknown): RosterSort {
  if (typeof sort !== "string" || !rosterSortColumns.includes(sort as RosterSortColumn)) return null;
  return { column: sort as RosterSortColumn, dir: dir === "desc" ? "desc" : "asc" };
}

/** Ascending, then descending, then no sort. A different column starts at ascending. */
export function nextRosterSort(current: RosterSort, column: RosterSortColumn): RosterSort {
  if (!current || current.column !== column) return { column, dir: "asc" };
  if (current.dir === "asc") return { column, dir: "desc" };
  return null;
}

export function sortRoster<T extends Sortable>(rows: T[], sort: RosterSort): T[] {
  if (!sort) return rows.slice();
  const sorted = rows.slice().sort((a, b) => compareRows(a, b, sort.column) || compareText(a.name, b.name) || a.id.localeCompare(b.id));
  return sort.dir === "desc" ? sorted.reverse() : sorted;
}

function compareRows(a: Sortable, b: Sortable, column: RosterSortColumn): number {
  if (column === "name") return compareText(a.name, b.name);
  if (column === "company") return compareText(a.companyName, b.companyName);
  if (column === "region") return compareText(regionLabel(a.region), regionLabel(b.region));
  if (column === "year") return compareMissingLast(yearNumber(a.year), yearNumber(b.year));
  if (column === "size") return sizeRank[a.size] - sizeRank[b.size];
  if (column === "difficulty") {
    return compareMissingLast(a.difficulty ? difficultyNumber[a.difficulty] : null, b.difficulty ? difficultyNumber[b.difficulty] : null);
  }
  if (column === "input") return compareMissingLast(a.inputUsdPerMtok, b.inputUsdPerMtok);
  if (column === "output") return compareMissingLast(a.outputUsdPerMtok, b.outputUsdPerMtok);
  return compareTextMissingLast(a.classNames, b.classNames);
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

function yearNumber(year: string): number | null {
  return /^\d{4}$/.test(year) ? Number(year) : null;
}

export function searchRoster<T extends Searchable>(rows: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    [row.name, row.companyName, row.classNames].some((value) => value.toLowerCase().includes(needle)),
  );
}

export function modelsReturnPath(raw: {
  notice?: string;
  q?: string;
  sort?: string;
  dir?: string;
  active?: string;
  inactive?: string;
}): string {
  const params = new URLSearchParams();
  if (raw.notice) params.set("notice", raw.notice);
  const query = (raw.q ?? "").trim().slice(0, 100);
  if (query) params.set("q", query);
  const sort = rosterSortOf(raw.sort, raw.dir);
  if (sort) {
    params.set("sort", sort.column);
    params.set("dir", sort.dir);
  }
  for (const key of ["active", "inactive"] as const) {
    const number = Number(raw[key]);
    if (Number.isFinite(number) && number > 1) params.set(key, String(Math.trunc(number)));
  }
  const text = params.toString();
  return text ? `/admin/models?${text}` : "/admin/models";
}

export function pageOf<T>(rows: T[], requested: unknown, size = rosterPageSize): { rows: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const number = Number(requested);
  const page = Number.isFinite(number) && number >= 1 ? Math.min(Math.trunc(number), pageCount) : 1;
  return { rows: rows.slice((page - 1) * size, page * size), page, pageCount };
}
