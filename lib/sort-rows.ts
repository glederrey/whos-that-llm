export type SortValue = string | number | null;
export type SortState = { column: number; dir: "asc" | "desc" } | null;

/** A missing value goes last whichever way the column runs. */
export function compareValues(a: SortValue, b: SortValue, dir: "asc" | "desc"): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const order = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
  return dir === "asc" ? order : -order;
}

/** The sort after a click on a header: the same column flips, a new number column starts high to low, a text column A to Z. */
export function nextSort(current: SortState, column: number, numeric: boolean): SortState {
  if (current?.column === column) return { column, dir: current.dir === "asc" ? "desc" : "asc" };
  return { column, dir: numeric ? "desc" : "asc" };
}

/** Rows ordered by a column of sort values. Equal rows keep their order. */
export function sortRows<T>(rows: T[], valueOf: (row: T) => SortValue[], sort: SortState): T[] {
  if (!sort) return rows;
  return [...rows].sort((a, b) => compareValues(valueOf(a)[sort.column], valueOf(b)[sort.column], sort.dir));
}

export function pageCountOf(total: number, pageSize: number | undefined): number {
  return pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
}

export function pageOf<T>(rows: T[], page: number, pageSize: number | undefined): T[] {
  return pageSize ? rows.slice((page - 1) * pageSize, page * pageSize) : rows;
}
