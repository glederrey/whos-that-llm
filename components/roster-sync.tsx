"use client";

import { useEffect, useRef, useState } from "react";
import { addNewRosterModels, checkRosterAvailability, searchNewModels } from "@/app/admin/actions";
import {
  formatSyncPrice,
  openRouterModelHref,
  type AddModelsResult,
  type AvailabilityResult,
  type NewModelCard,
  type NewModelsResult,
} from "@/lib/roster-sync";
import { difficulties, difficultyLabel } from "@/lib/difficulty";

const sizes = [
  ["nano", "Nano"],
  ["small", "Small"],
  ["medium", "Medium"],
  ["large", "Large"],
  ["xxl", "XXL"],
] as const;

type ModelPick = { size: string; difficulty: string };

type Card =
  | { status: "availability"; result: AvailabilityResult }
  | { status: "search"; result: NewModelsResult; hidden: string[]; notice: AddModelsResult | null; picks: Record<string, ModelPick> };

export function RosterSync() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"availability" | "search" | "add" | null>(null);
  const [card, setCard] = useState<Card | null>(null);

  useEffect(() => {
    const node = cardRef.current;
    if (!card || !node || node.matches(":popover-open")) return;
    node.showPopover();
  }, [card]);

  async function checkAvailability() {
    if (busy) return;
    setBusy("availability");
    try {
      setCard({ status: "availability", result: await checkRosterAvailability() });
    } catch {
      setCard({ status: "availability", result: { ok: false, error: "Could not check availability." } });
    } finally {
      setBusy(null);
    }
  }

  async function search() {
    if (busy) return;
    setBusy("search");
    try {
      setCard({ status: "search", result: await searchNewModels(), hidden: [], notice: null, picks: {} });
    } catch {
      setCard({ status: "search", result: { ok: false, error: "Could not search for new models." }, hidden: [], notice: null, picks: {} });
    } finally {
      setBusy(null);
    }
  }

  function dismiss(id: string) {
    setCard((current) => (current?.status === "search" ? { ...current, hidden: [...current.hidden, id] } : current));
  }

  function setPick(id: string, field: keyof ModelPick, value: string) {
    setCard((current) => {
      if (current?.status !== "search") return current;
      const previous = current.picks[id] ?? { size: "", difficulty: "" };
      return { ...current, picks: { ...current.picks, [id]: { ...previous, [field]: value } } };
    });
  }

  async function addVisible(models: { id: string; size: string; difficulty: string }[]) {
    if (busy || models.length === 0 || models.some((model) => !model.size || !model.difficulty)) return;
    setBusy("add");
    try {
      const notice = await addNewRosterModels(models);
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
        <button className="button" type="button" onClick={checkAvailability} disabled={busy !== null}>
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
        {card?.status === "availability" ? <AvailabilityCard result={card.result} /> : null}
        {card?.status === "search" ? (
          <SearchCard
            result={card.result}
            hidden={card.hidden}
            notice={card.notice}
            picks={card.picks}
            adding={busy === "add"}
            onDismiss={dismiss}
            onPick={setPick}
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

function AvailabilityCard({ result }: { result: AvailabilityResult }) {
  return (
    <>
      <h2>Check availability</h2>
      {result.ok ? (
        result.newlyUnavailable.length === 0 && result.backAvailable.length === 0 ? (
          <p>Every roster model is still on OpenRouter.</p>
        ) : (
          <>
            {result.newlyUnavailable.length > 0 ? (
              <>
                <h3>No longer available</h3>
                <ul className="roster-sync-list">
                  {result.newlyUnavailable.map((model) => (
                    <li key={model.id}>
                      <strong>{model.name}</strong>
                    </li>
                  ))}
                </ul>
                <p className="muted">Moved to Unavailable on OpenRouter. They stay in the database, and past games keep them.</p>
              </>
            ) : null}
            {result.backAvailable.length > 0 ? (
              <>
                <h3>Back on OpenRouter</h3>
                <ul className="roster-sync-list">
                  {result.backAvailable.map((model) => (
                    <li key={model.id}>
                      <strong>{model.name}</strong>
                    </li>
                  ))}
                </ul>
                <p className="muted">Available again. They stay off until you turn them on.</p>
              </>
            ) : null}
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
  picks,
  adding,
  onDismiss,
  onPick,
  onAdd,
}: {
  result: NewModelsResult;
  hidden: string[];
  notice: AddModelsResult | null;
  picks: Record<string, ModelPick>;
  adding: boolean;
  onDismiss: (id: string) => void;
  onPick: (id: string, field: keyof ModelPick, value: string) => void;
  onAdd: (models: { id: string; size: string; difficulty: string }[]) => void;
}) {
  const visible = result.ok ? result.models.filter((model) => !hidden.includes(model.id)) : [];
  const added = notice?.ok ? notice.added : null;
  const ready = visible.every((model) => picks[model.id]?.size && picks[model.id]?.difficulty);
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
                <ModelCard
                  key={model.id}
                  model={model}
                  pick={picks[model.id] ?? { size: "", difficulty: "" }}
                  onDismiss={onDismiss}
                  onPick={onPick}
                />
              ))}
            </div>
            <div className="row">
              <button
                className="button"
                type="button"
                disabled={adding || visible.length === 0 || !ready}
                onClick={() => {
                  if (visible.length === 0 || !ready) return;
                  onAdd(
                    visible.flatMap((model) => {
                      const pick = picks[model.id];
                      return pick?.size && pick.difficulty ? [{ id: model.id, size: pick.size, difficulty: pick.difficulty }] : [];
                    }),
                  );
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

function ModelCard({
  model,
  pick,
  onDismiss,
  onPick,
}: {
  model: NewModelCard;
  pick: ModelPick;
  onDismiss: (id: string) => void;
  onPick: (id: string, field: keyof ModelPick, value: string) => void;
}) {
  const href = openRouterModelHref(model.id);
  return (
    <article className="card roster-new-model">
      <button className="button-quiet roster-new-dismiss" type="button" aria-label={`Remove ${model.name}`} onClick={() => onDismiss(model.id)}>
        ×
      </button>
      <h3>
        <span>{model.name}</span>
        {model.reasoning ? <span className="pill">Reasoning</span> : null}
      </h3>
      {model.description ? <p>{model.description}</p> : null}
      <div className="roster-new-foot">
        <div className="roster-new-facts">
          <p>Released {model.releasedOn ?? "—"}</p>
          <p>
            Input {formatSyncPrice(model.inputUsdPerMtok)} · Output {formatSyncPrice(model.outputUsdPerMtok)}
          </p>
          <p>{href ? <a href={href} target="_blank" rel="noreferrer">{model.id}</a> : model.id}</p>
        </div>
        <div className="roster-new-picks">
          <label>
            Size
            <select aria-label={`Size for ${model.name}`} value={pick.size} onChange={(event) => onPick(model.id, "size", event.target.value)}>
              <option value="">Choose</option>
              {sizes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Difficulty
            <select
              aria-label={`Difficulty for ${model.name}`}
              value={pick.difficulty}
              onChange={(event) => onPick(model.id, "difficulty", event.target.value)}
            >
              <option value="">Choose</option>
              {difficulties.map((value) => (
                <option key={value} value={value}>
                  {difficultyLabel[value]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </article>
  );
}

function addedSentence(count: number): string {
  return count === 1 ? "Added 1 model." : `Added ${count} models.`;
}

function searchAddRow(card: Card): boolean {
  return card.status === "search" && card.result.ok && card.result.models.length > 0 && card.notice?.ok !== true;
}
