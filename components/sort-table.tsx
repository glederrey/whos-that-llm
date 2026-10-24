"use client";

import { useState } from "react";
import { nextSort, pageCountOf, pageOf, sortRows, type SortState, type SortValue } from "@/lib/sort-rows";

export type SortCell = { text: string; sort: SortValue };
export type SortRow = { id: string; cells: SortCell[] };

/** A small table whose headers reorder the rows. A number column starts high to low, a text column A to Z. */
export function SortTable({
  columns,
  rows,
  initial = null,
  pageSize,
}: {
  columns: { label: string; numeric?: boolean }[];
  rows: SortRow[];
  initial?: SortState;
  pageSize?: number;
}) {
  const [sort, setSort] = useState<SortState>(initial);
  const [page, setPage] = useState(1);
  const ordered = sortRows(rows, (row) => row.cells.map((cell) => cell.sort), sort);
  const pageCount = pageCountOf(rows.length, pageSize);
  const shown = pageOf(ordered, page, pageSize);
  const onSort = (column: number) => {
    setPage(1);
    setSort((current) => nextSort(current, column, Boolean(columns[column].numeric)));
  };
  return (
    <>
      <div className="card roster-card">
        <table className="roster compact">
          <thead>
            <tr>
              {columns.map((column, index) => {
                const active = sort?.column === index;
                return (
                  <th
                    key={column.label}
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button type="button" className="roster-sort" onClick={() => onSort(index)}>
                      {column.label}
                      {active ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell, index) => (
                  <td key={columns[index].label}>{cell.text}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 ? (
        <div className="row pager">
          <div className="row">
            {page > 1 ? (
              <button type="button" className="button-quiet" onClick={() => setPage(page - 1)}>
                Previous
              </button>
            ) : (
              <span className="button-quiet is-disabled">Previous</span>
            )}
            <span className="muted">
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <button type="button" className="button-quiet" onClick={() => setPage(page + 1)}>
                Next
              </button>
            ) : (
              <span className="button-quiet is-disabled">Next</span>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
