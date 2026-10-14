"use client";

import { useState } from "react";
import { compact, usd } from "@/lib/admin-metrics";
import { pageOf } from "@/lib/roster-list";
import { nextSpendSort, sortSpendRows, type SpendRow, type SpendSide, type SpendSort, type SpendSortColumn } from "@/lib/spend-table";

const metricColumns: { column: SpendSortColumn; label: string; hint: string }[] = [
  { column: "paid7", label: "Paid", hint: "Last 7 days" },
  { column: "requests7", label: "Requests", hint: "Last 7 days" },
  { column: "tokens7", label: "Tokens", hint: "Last 7 days" },
  { column: "paid30", label: "Paid", hint: "Last 30 days" },
  { column: "requests30", label: "Requests", hint: "Last 30 days" },
  { column: "tokens30", label: "Tokens", hint: "Last 30 days" },
];

export function SpendActivityTable({ rows, week, month }: { rows: SpendRow[]; week: SpendSide; month: SpendSide }) {
  const [sort, setSort] = useState<SpendSort>(null);
  const [page, setPage] = useState(1);
  const ordered = sortSpendRows(rows, sort);
  const list = pageOf(ordered, page);
  const onSort = (column: SpendSortColumn) => setSort((current) => nextSpendSort(current, column));
  return (
    <>
    <div className="card roster-card">
      <table className="roster compact">
        <thead>
          <tr>
            <SortHeader column="model" label="Model" sort={sort} onSort={onSort} rowSpan={2} />
            <SortHeader column="paid7" label="Last 7 days" sort={sort} onSort={onSort} colSpan={3} group />
            <SortHeader column="paid30" label="Last 30 days" sort={sort} onSort={onSort} colSpan={3} group />
          </tr>
          <tr>
            {metricColumns.map((column) => (
              <SortHeader key={column.column} column={column.column} label={column.label} hint={column.hint} sort={sort} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.length === 0 ? (
            <tr>
              <td colSpan={7} className="muted">
                No OpenRouter activity in the last 30 days.
              </td>
            </tr>
          ) : (
            <>
              <tr className="total-row">
                <td>All models</td>
                <Cells row={week} />
                <Cells row={month} />
              </tr>
              {list.rows.map((row) => (
                <tr key={row.slug}>
                  <td title={row.slug}>{row.name}</td>
                  <Cells row={row.week} />
                  <Cells row={row.month} />
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
      {ordered.length > 0 ? (
        <div className="row pager">
          <div className="row">
            {list.page > 1 ? (
              <button type="button" className="button-quiet" onClick={() => setPage(list.page - 1)}>
                Previous
              </button>
            ) : (
              <span className="button-quiet is-disabled">Previous</span>
            )}
            <span className="muted">
              Page {list.page} of {list.pageCount}
            </span>
            {list.page < list.pageCount ? (
              <button type="button" className="button-quiet" onClick={() => setPage(list.page + 1)}>
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

function SortHeader({
  column,
  label,
  hint,
  sort,
  onSort,
  rowSpan,
  colSpan,
  group,
}: {
  column: SpendSortColumn;
  label: string;
  hint?: string;
  sort: SpendSort;
  onSort: (column: SpendSortColumn) => void;
  rowSpan?: number;
  colSpan?: number;
  group?: boolean;
}) {
  const active = sort?.column === column;
  return (
    <th
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={group ? "group" : undefined}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" className="roster-sort" onClick={() => onSort(column)}>
        {hint ? <span className="sr-only">{hint} </span> : null}
        {label}
        {active ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

function Cells({ row }: { row: SpendSide }) {
  return (
    <>
      <td>{usd(row.usd)}</td>
      <td>{row.requests.toLocaleString("en-US")}</td>
      <td title={`${row.promptTokens.toLocaleString("en-US")} in, ${row.completionTokens.toLocaleString("en-US")} out`}>
        {compact(row.promptTokens + row.completionTokens)}
      </td>
    </>
  );
}
