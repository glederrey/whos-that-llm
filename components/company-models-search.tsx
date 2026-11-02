"use client";

import { useState } from "react";
import { addCompanyModels, searchCompanyModels } from "@/app/admin/actions";
import { MenuSelect } from "@/components/menu-select";
import { addedSentence, ModelCard, type ModelPick } from "@/components/roster-sync";
import type { AddModelsResult, CompanyModelsResult } from "@/lib/roster-sync";

const panel = "company-models-card";

export function CompanyModelsSearch({ companies }: { companies: { id: string; name: string; logoUrl: string }[] }) {
  const [companyId, setCompanyId] = useState("");
  const [busy, setBusy] = useState<"search" | "add" | null>(null);
  const [result, setResult] = useState<CompanyModelsResult | null>(null);
  const [searched, setSearched] = useState("");
  const [hidden, setHidden] = useState<string[]>([]);
  const [picks, setPicks] = useState<Record<string, ModelPick>>({});
  const [notice, setNotice] = useState<AddModelsResult | null>(null);

  async function search() {
    if (busy || !companyId) return;
    setBusy("search");
    setNotice(null);
    setHidden([]);
    setPicks({});
    setSearched(companyId);
    try {
      setResult(await searchCompanyModels(companyId));
    } catch {
      setResult({ ok: false, error: "Could not search for models." });
    } finally {
      setBusy(null);
    }
  }

  function setPick(id: string, field: keyof ModelPick, value: string) {
    setPicks((current) => ({ ...current, [id]: { ...(current[id] ?? { size: "", difficulty: "" }), [field]: value } }));
  }

  const visible = result?.ok ? result.add.filter((model) => !hidden.includes(model.id)) : [];
  const ready = visible.length > 0 && visible.every((model) => picks[model.id]?.size && picks[model.id]?.difficulty);
  const added = notice?.ok ? notice.added : null;

  async function add() {
    if (busy || !ready) return;
    setBusy("add");
    try {
      const outcome = await addCompanyModels(
        searched,
        visible.map((model) => ({ id: model.id, size: picks[model.id].size, difficulty: picks[model.id].difficulty })),
      );
      setNotice(outcome);
      if (outcome.ok) {
        // Stay on this company: the added models move to "Already on the roster" and the rest stay to pick from.
        setHidden([]);
        setPicks({});
        setResult(await searchCompanyModels(searched));
      }
    } catch {
      setNotice({ ok: false, error: "Could not add those models." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button className="button" type="button" popoverTarget={panel}>
        Search all models from a company
      </button>
      <div id={panel} popover="auto" className="roster-edit card roster-sync-card roster-new-models">
        <h2>Models from a company</h2>
        <div className="row">
          <MenuSelect
            value={companyId}
            onChange={setCompanyId}
            options={[{ value: "", label: "Choose a company" }, ...companies.map((company) => ({ value: company.id, label: company.name, logoUrl: company.logoUrl }))]}
          />
          <button className="button" type="button" disabled={busy !== null || !companyId} aria-busy={busy === "search"} onClick={search}>
            {busy === "search" ? <Busy>Searching…</Busy> : "Search"}
          </button>
        </div>
        {result && !result.ok ? (
          <p className="error" role="alert">
            {result.error}
          </p>
        ) : null}
        {notice && !notice.ok ? (
          <p className="error" role="alert">
            {notice.error}
          </p>
        ) : null}
        {added !== null ? <p>{addedSentence(added)}</p> : null}
        {result?.ok ? (
          <>
            <h3>Already on the roster ({result.onRoster.length})</h3>
            {result.onRoster.length === 0 ? (
              <p className="muted">None of {result.companyName}&apos;s models are on the roster.</p>
            ) : (
              <ul className="roster-sync-list">
                {result.onRoster.map((model) => (
                  <li key={model.id}>
                    <strong>{model.name}</strong>
                    <span className="muted">{model.id} · already in the roster</span>
                  </li>
                ))}
              </ul>
            )}
            <h3>Not on the roster ({result.add.length})</h3>
            {result.add.length === 0 ? (
              <p className="muted">Every {result.companyName} text model on OpenRouter is already on the roster.</p>
            ) : (
              <div className="roster-new-list">
                {visible.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    pick={picks[model.id] ?? { size: "", difficulty: "" }}
                    onDismiss={(id) => setHidden((current) => [...current, id])}
                    onPick={setPick}
                  />
                ))}
              </div>
            )}
          </>
        ) : null}
        <div className="row">
          {result?.ok && result.add.length > 0 ? (
            <button className="button" type="button" disabled={busy !== null || !ready} aria-busy={busy === "add"} onClick={add}>
              {busy === "add" ? <Busy>Adding…</Busy> : "Add models"}
            </button>
          ) : null}
          <button className="button-quiet" type="button" popoverTarget={panel} popoverTargetAction="hide">
            Close
          </button>
        </div>
      </div>
    </>
  );
}

function Busy({ children }: { children: string }) {
  return (
    <>
      <span className="spinner" aria-hidden="true" />
      {children}
    </>
  );
}
