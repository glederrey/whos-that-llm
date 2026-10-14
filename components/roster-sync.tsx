"use client";

import { useEffect, useRef, useState } from "react";
import { addNewRosterModels, checkRosterAvailability, searchNewModels, updateRosterPrices } from "@/app/admin/actions";
import {
  formatSyncPrice,
  openRouterModelHref,
  type AddModelsResult,
  type AvailabilityResult,
  type NewModelCard,
  type NewModelsResult,
  type PriceChange,
  type PriceSyncResult,
} from "@/lib/roster-sync";

type Card =
  | { status: "prices"; result: PriceSyncResult }
  | { status: "availability"; result: AvailabilityResult }
  | { status: "search"; result: NewModelsResult; hidden: string[]; notice: AddModelsResult | null };

export function RosterSync() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"prices" | "availability" | "search" | "add" | null>(null);
  const [card, setCard] = useState<Card | null>(null);

  useEffect(() => {
    const node = cardRef.current;
    if (!card || !node || node.matches(":popover-open")) return;
    node.showPopover();
  }, [card]);

  async function run(which: "prices" | "availability") {
    if (busy) return;
    setBusy(which);
    try {
      if (which === "prices") setCard({ status: "prices", result: await updateRosterPrices() });
      else setCard({ status: "availability", result: await checkRosterAvailability() });
    } catch {
      const error = which === "prices" ? "Could not update prices." : "Could not check availability.";
      setCard(which === "prices" ? { status: "prices", result: { ok: false, error } } : { status: "availability", result: { ok: false, error } });
    } finally {
      setBusy(null);
    }
  }

  async function search() {
    if (busy) return;
    setBusy("search");
    try {
      setCard({ status: "search", result: await searchNewModels(), hidden: [], notice: null });
    } catch {
      setCard({ status: "search", result: { ok: false, error: "Could not search for new models." }, hidden: [], notice: null });
    } finally {
      setBusy(null);
    }
  }

  function dismiss(id: string) {
    setCard((current) => (current?.status === "search" ? { ...current, hidden: [...current.hidden, id] } : current));
  }

  async function addVisible(ids: string[]) {
    if (busy || ids.length === 0) return;
    setBusy("add");
    try {
      const notice = await addNewRosterModels(ids);
      setCard((current) => (current?.status === "search" ? { ...current, notice } : current));
    } catch {
      setCard((current) =>
        current?.status === "search" ? { ...current, notice: { ok: false, error: "Could not add those models." } } : current,
      );
    } finally {
      setBusy(null);
    }
  }

  const searching = card?.status === "search";
  return (
    <>
      <div className="roster-sync">
        <button className="button" type="button" onClick={() => run("prices")} disabled={busy !== null}>
          {busy === "prices" ? "Updating prices…" : "Update prices"}
        </button>
        <button className="button" type="button" onClick={() => run("availability")} disabled={busy !== null}>
          {busy === "availability" ? "Checking availability…" : "Check availability"}
        </button>
        <button className="button" type="button" onClick={search} disabled={busy !== null}>
          {busy === "search" ? "Searching…" : "Search for new models"}
        </button>
      </div>
      <div
        ref={cardRef}
        id="roster-sync-card"
        popover="auto"
        className={searching ? "roster-edit card roster-sync-card roster-new-models" : "roster-edit card roster-sync-card"}
      >
        {card?.status === "prices" ? <PriceCard result={card.result} /> : null}
        {card?.status === "availability" ? <AvailabilityCard result={card.result} /> : null}
        {card?.status === "search" ? (
          <SearchCard
            result={card.result}
            hidden={card.hidden}
            notice={card.notice}
            adding={busy === "add"}
            onDismiss={dismiss}
            onAdd={addVisible}
          />
        ) : null}
        {card && !searchAddRow(card) ? (
          <div className="row">
            <button className="button-quiet" type="button" popoverTarget="roster-sync-card" popoverTargetAction="hide">
              Close
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

function PriceCard({ result }: { result: PriceSyncResult }) {
  return (
    <>
      <h2>Update prices</h2>
      {result.ok ? <PriceBody result={result} /> : <p className="error" role="alert">{result.error}</p>}
    </>
  );
}

function PriceBody({ result }: { result: Extract<PriceSyncResult, { ok: true }> }) {
  return (
    <>
      {result.changes.length === 0 ? (
        <p>{result.notUpdated.length === 0 ? "Every roster price already matches OpenRouter." : "No prices changed."}</p>
      ) : (
        <>
          <h3>Changed</h3>
          <ul className="roster-sync-list">
            {result.changes.map((change) => (
              <li key={change.id}>
                <strong>{change.name}</strong>
                <PriceLine label="Input" side={change.input} />
                <PriceLine label="Output" side={change.output} />
              </li>
            ))}
          </ul>
        </>
      )}
      {result.notUpdated.length > 0 ? (
        <>
          <h3>Not updated</h3>
          <ul className="roster-sync-list">
            {result.notUpdated.map((model) => (
              <li key={model.id}>
                <strong>{model.name}</strong>
                <span className="muted">No OpenRouter price</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

function PriceLine({ label, side }: { label: string; side: PriceChange["input"] }) {
  if (!side) return null;
  return (
    <span>
      {label} {formatSyncPrice(side.oldPrice)} → {formatSyncPrice(side.newPrice)}
    </span>
  );
}

function AvailabilityCard({ result }: { result: AvailabilityResult }) {
  return (
    <>
      <h2>Check availability</h2>
      {result.ok ? (
        result.unavailable.length === 0 ? (
          <p>Every roster model is still on OpenRouter.</p>
        ) : (
          <>
            <h3>No longer available</h3>
            <ul className="roster-sync-list">
              {result.unavailable.map((model) => (
                <li key={model.id}>
                  <strong>{model.name}</strong>
                </li>
              ))}
            </ul>
            <p className="muted">Turned off. They stay in the roster.</p>
          </>
        )
      ) : (
        <p className="error" role="alert">
          {result.error}
        </p>
      )}
    </>
  );
}

function SearchCard({
  result,
  hidden,
  notice,
  adding,
  onDismiss,
  onAdd,
}: {
  result: NewModelsResult;
  hidden: string[];
  notice: AddModelsResult | null;
  adding: boolean;
  onDismiss: (id: string) => void;
  onAdd: (ids: string[]) => void;
}) {
  const visible = result.ok ? result.models.filter((model) => !hidden.includes(model.id)) : [];
  const added = notice?.ok ? notice.added : null;
  return (
    <>
      <h2>New models</h2>
      {!result.ok ? <p className="error" role="alert">{result.error}</p> : null}
      {notice && !notice.ok ? <p className="error" role="alert">{notice.error}</p> : null}
      {added !== null ? <p>{addedSentence(added)}</p> : null}
      {result.ok && added === null ? (
        result.models.length === 0 ? (
          <p>No new text models in the last 30 days.</p>
        ) : (
          <>
            <div className="roster-new-list">
              {visible.map((model) => (
                <ModelCard key={model.id} model={model} onDismiss={onDismiss} />
              ))}
            </div>
            <div className="row">
              <button
                className="button"
                type="button"
                disabled={adding || visible.length === 0}
                onClick={() => {
                  if (visible.length === 0) return;
                  onAdd(visible.map((model) => model.id));
                }}
              >
                {adding ? "Adding…" : "Add models"}
              </button>
              <button className="button-quiet" type="button" popoverTarget="roster-sync-card" popoverTargetAction="hide">
                Close
              </button>
            </div>
          </>
        )
      ) : null}
    </>
  );
}

function ModelCard({ model, onDismiss }: { model: NewModelCard; onDismiss: (id: string) => void }) {
  const href = openRouterModelHref(model.id);
  return (
    <article className="card roster-new-model">
      <button className="button-quiet roster-new-dismiss" type="button" aria-label={`Remove ${model.name}`} onClick={() => onDismiss(model.id)}>
        ×
      </button>
      <h3>{model.name}</h3>
      {model.description ? <p>{model.description}</p> : null}
      <p>Released {model.releasedOn ?? "—"}</p>
      <p>
        Input {formatSyncPrice(model.inputUsdPerMtok)} · Output {formatSyncPrice(model.outputUsdPerMtok)}
      </p>
      <p>{href ? <a href={href} target="_blank" rel="noreferrer">{model.id}</a> : model.id}</p>
    </article>
  );
}

function addedSentence(count: number): string {
  return count === 1 ? "Added 1 model." : `Added ${count} models.`;
}

function searchAddRow(card: Card): boolean {
  return card.status === "search" && card.result.ok && card.result.models.length > 0 && card.notice?.ok !== true;
}
