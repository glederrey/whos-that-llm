"use client";

import { useEffect, useRef, useState } from "react";
import { difficulties, difficultyLabel } from "@/lib/difficulty";
import type { HistoryFacets } from "@/lib/profile-data";
import type { HistoryFilter } from "@/lib/profile-filter";
import type { HistoryItem } from "@/lib/profile-history";
import { HistoryList } from "./history-list";

type Page = { items: HistoryItem[]; total: number; page: number; pageCount: number };

const statusOptions = [
  { value: "solved", label: "Solved" },
  { value: "miss", label: "Failed" },
  { value: "given_up", label: "Given up" },
  { value: "active", label: "In progress" },
] as const;

/** What the third menu offers once a game mode is chosen. */
function levelMenu(mode: string | undefined, facets: HistoryFacets): { label: string; options: { value: string; label: string }[] } | null {
  if (!mode || mode === "origin" || mode === "custom") return null;
  if (mode === "class") return { label: "Category", options: facets.categories.map((item) => ({ value: item.id, label: item.name })) };
  if (mode === "company") return { label: "Company", options: facets.companies.map((item) => ({ value: item.id, label: item.name })) };
  return { label: "Difficulty", options: difficulties.map((value) => ({ value, label: difficultyLabel[value] })) };
}

function query(filter: HistoryFilter, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) if (value) params.set(key, value);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

export function ProfileGames({ initial, facets }: { initial: Page; facets: HistoryFacets }) {
  const [filter, setFilter] = useState<HistoryFilter>({});
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page>(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    fetch(`/api/me/history?${query(filter, page)}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<Page>) : Promise.reject(new Error("history"))))
      .then((next) => {
        setData(next);
        setFailed(false);
        setBusy(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
        setBusy(false);
      });
    return () => controller.abort();
  }, [filter, page]);

  function change(patch: Partial<HistoryFilter>) {
    const next = { ...filter, ...patch };
    for (const key of Object.keys(next) as (keyof HistoryFilter)[]) if (!next[key]) delete next[key];
    setFilter(next);
    setPage(1);
  }

  const level = levelMenu(filter.mode, facets);
  const filtered = Object.keys(filter).length > 0;

  return (
    <>
      <div className="history-filters">
        <label>
          From
          <input type="date" value={filter.from ?? ""} max={filter.to} onChange={(event) => change({ from: event.target.value })} />
        </label>
        <label>
          To
          <input type="date" value={filter.to ?? ""} min={filter.from} onChange={(event) => change({ to: event.target.value })} />
        </label>
        <label>
          Status
          <select value={filter.status ?? ""} onChange={(event) => change({ status: (event.target.value || undefined) as HistoryFilter["status"] })}>
            <option value="">All</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Game mode
          <select value={filter.mode ?? ""} onChange={(event) => change({ mode: event.target.value || undefined, level: undefined })}>
            <option value="">All</option>
            {facets.modes.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.name}
              </option>
            ))}
          </select>
        </label>
        {level ? (
          <label>
            {level.label}
            <select value={filter.level ?? ""} onChange={(event) => change({ level: event.target.value || undefined })}>
              <option value="">All</option>
              {level.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {filtered ? (
          <button type="button" className="button-quiet" onClick={() => change({ from: undefined, to: undefined, status: undefined, mode: undefined, level: undefined })}>
            Clear
          </button>
        ) : null}
      </div>
      {failed ? <p className="error">Could not load your games. Try again.</p> : null}
      <div className="history-body" aria-busy={busy} data-busy={busy ? "true" : undefined}>
        {data.items.length === 0 ? (
          <div className="card empty">{filtered ? "No games match these filters." : "No games yet."}</div>
        ) : (
          <>
            <HistoryList key={`${data.page}:${query(filter, 1)}`} items={data.items} />
            <div className="row pager">
              <div className="row">
                {data.page > 1 ? (
                  <button type="button" className="button-quiet" onClick={() => setPage(data.page - 1)}>
                    Previous
                  </button>
                ) : (
                  <span className="button-quiet is-disabled">Previous</span>
                )}
                <span className="muted">
                  Page {data.page} of {data.pageCount}
                </span>
                {data.page < data.pageCount ? (
                  <button type="button" className="button-quiet" onClick={() => setPage(data.page + 1)}>
                    Next
                  </button>
                ) : (
                  <span className="button-quiet is-disabled">Next</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
