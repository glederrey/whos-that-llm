export const rosterPageSize = 10;

type Searchable = { name: string; companyName: string; classNames: string };

export function searchRoster<T extends Searchable>(rows: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    [row.name, row.companyName, row.classNames].some((value) => value.toLowerCase().includes(needle)),
  );
}

export function pageOf<T>(rows: T[], requested: unknown, size = rosterPageSize): { rows: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const number = Number(requested);
  const page = Number.isFinite(number) && number >= 1 ? Math.min(Math.trunc(number), pageCount) : 1;
  return { rows: rows.slice((page - 1) * size, page * size), page, pageCount };
}
