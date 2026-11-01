"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { searchOpenRouterCompanies, type OpenRouterCompaniesResult } from "@/app/admin/actions";

export function OpenRouterCompanies() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OpenRouterCompaniesResult | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const node = cardRef.current;
    if (!result || !node || node.matches(":popover-open")) return;
    node.showPopover();
  }, [result]);

  async function search() {
    if (busy) return;
    setBusy(true);
    try {
      setResult(await searchOpenRouterCompanies());
    } catch {
      setResult({ ok: false, error: "Could not search OpenRouter." });
    } finally {
      setBusy(false);
    }
  }

  const needle = query.trim().toLowerCase();
  const rows = result?.ok
    ? result.companies.filter((row) => !needle || row.org.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle))
    : [];
  const missing = result?.ok ? result.companies.filter((row) => !row.company).length : 0;

  return (
    <>
      <div className="roster-sync">
        <button className="button" type="button" onClick={search} disabled={busy}>
          {busy ? "Searching…" : "Search OpenRouter companies"}
        </button>
      </div>
      <div ref={cardRef} id="openrouter-companies-card" popover="auto" className="roster-edit card roster-sync-card roster-new-models">
        <h2>Companies on OpenRouter</h2>
        {result && !result.ok ? (
          <p className="error" role="alert">
            {result.error}
          </p>
        ) : null}
        {result?.ok ? (
          <>
            <p className="muted">
              {result.companies.length} companies with text models, {missing} not on the roster. The count is OpenRouter text models.
            </p>
            <input
              type="search"
              aria-label="Filter companies"
              placeholder="Filter by name or OpenRouter id"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="roster-card">
              <table className="roster compact">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>OpenRouter</th>
                    <th>Models</th>
                    <th>Roster</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.org}>
                      <td>{row.name}</td>
                      <td>{row.org}</td>
                      <td>{row.models.toLocaleString("en-US")}</td>
                      <td>{row.company ? row.company.name : (
                          <Link
                            className="button"
                            href={`/admin/companies?add=${encodeURIComponent(row.name)}`}
                            onClick={() => cardRef.current?.hidePopover()}
                          >
                            Add to the roster
                          </Link>
                        )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 ? <p className="muted">No company matches.</p> : null}
            </div>
          </>
        ) : null}
        <div className="row">
          <button className="button-quiet" type="button" popoverTarget="openrouter-companies-card" popoverTargetAction="hide">
            Close
          </button>
        </div>
      </div>
    </>
  );
}
