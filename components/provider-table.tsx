"use client";

import { useState } from "react";
import { clearProvider } from "@/app/admin/actions";
import { ProviderReason } from "@/components/provider-reason";
import { pageOf } from "@/lib/roster-list";
import { formatOutputGap, visibleOutput } from "@/lib/provider-check";
import {
  nextProviderSort,
  providerPageSize,
  sortProviderRows,
  type ProviderSort,
  type ProviderSortColumn,
  type ProviderTableRow,
} from "@/lib/provider-table";

const sortLabels: Record<ProviderSortColumn, string> = {
  provider: "Provider",
  model: "Model",
  updated: "Updated",
  input: "Input",
  reasoning: "Reasoning",
  cached: "Cached",
  output: "Output",
  gpt: "gpt-tokenizer",
  gap: "Gap",
  log: "Log",
};

const numericColumns = new Set<ProviderSortColumn>(["input", "reasoning", "cached", "output", "gpt", "gap"]);

export function ProviderTable({ rows, empty, blacklisted }: { rows: ProviderTableRow[]; empty: string; blacklisted: boolean }) {
  const [sort, setSort] = useState<ProviderSort>(null);
  const [page, setPage] = useState(1);
  if (rows.length === 0) return <p className="muted">{empty}</p>;
  const ordered = sortProviderRows(rows, sort);
  const list = pageOf(ordered, page, providerPageSize);

  function chooseSort(column: ProviderSortColumn) {
    setSort((current) => nextProviderSort(current, column));
    setPage(1);
  }

  return (
    <>
      <div className="card roster-card">
        <table className="roster compact providers">
          <thead>
            <tr>
              {(Object.keys(sortLabels) as ProviderSortColumn[]).map((column) => {
                const active = sort?.column === column;
                return (
                  <th
                    key={column}
                    className={numericColumns.has(column) ? "num" : undefined}
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button type="button" className="roster-sort" onClick={() => chooseSort(column)}>
                      {sortLabels[column]}
                      {active ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                );
              })}
              {blacklisted ? <th className="actions"></th> : null}
            </tr>
          </thead>
          <tbody>
            {list.rows.map((row) => (
              <tr key={row.slug}>
                <td className="identity">{row.slug}</td>
                <td className="identity">{row.model ?? "—"}</td>
                <td className="identity">{formatWhen(row.updatedAt)}</td>
                <td className="num">{count(row.inputTokens)}</td>
                <td className="num">{count(row.reasoningTokens)}</td>
                <td className="num">{count(row.cachedTokens)}</td>
                <td className="num">{visibleCount(row.outputTokens, row.reasoningTokens)}</td>
                <td className="num">{count(row.gptTokens)}</td>
                <td className="num">{formatOutputGap(row.gptTokens, row.outputTokens, row.reasoningTokens)}</td>
                <td className="actions">{row.reason ? <ProviderReason reason={row.reason} /> : "—"}</td>
                {blacklisted ? (
                  <td className="actions">
                    <form action={clearProvider}>
                      <input type="hidden" name="slug" value={row.slug} />
                      <button type="submit" className="button-quiet">
                        Deblacklist
                      </button>
                    </form>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    </>
  );
}

function visibleCount(output: number | null, reasoning: number | null): string {
  if (output === null) return "—";
  return count(visibleOutput(output, reasoning ?? 0));
}

function count(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-US");
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}
