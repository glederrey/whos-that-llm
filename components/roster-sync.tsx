"use client";

import { useEffect, useRef, useState } from "react";
import { checkRosterAvailability, updateRosterPrices } from "@/app/admin/actions";
import {
  formatSyncPrice,
  type AvailabilityResult,
  type PriceChange,
  type PriceSyncResult,
} from "@/lib/roster-sync";

type Card = { status: "prices"; result: PriceSyncResult } | { status: "availability"; result: AvailabilityResult };

export function RosterSync() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"prices" | "availability" | null>(null);
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

  return (
    <>
      <div className="roster-sync">
        <button className="button" type="button" onClick={() => run("prices")} disabled={busy !== null}>
          {busy === "prices" ? "Updating prices…" : "Update prices"}
        </button>
        <button className="button" type="button" onClick={() => run("availability")} disabled={busy !== null}>
          {busy === "availability" ? "Checking availability…" : "Check availability"}
        </button>
      </div>
      <div ref={cardRef} id="roster-sync-card" popover="auto" className="roster-edit card roster-sync-card">
        {card?.status === "prices" ? <PriceCard result={card.result} /> : null}
        {card?.status === "availability" ? <AvailabilityCard result={card.result} /> : null}
        {card ? (
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
