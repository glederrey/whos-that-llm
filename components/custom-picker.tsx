"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { filterPickerModels } from "@/lib/admin-category";
import { minCustomModels, type CustomModel } from "@/lib/custom-mode";
import { unfinishedLine } from "@/lib/lobby-row";
import { CompanyLogo } from "./company-logo";

const storeKey = "custom-models";

type Group = { companyName: string; logoUrl: string; originName: string; originFlag: string; models: CustomModel[] };

function groupByCompany(models: readonly CustomModel[]): Group[] {
  const groups = new Map<string, Group>();
  for (const model of models) {
    const group = groups.get(model.companyName) ?? {
      companyName: model.companyName,
      logoUrl: model.logoUrl,
      originName: model.originName,
      originFlag: model.originFlag,
      models: [],
    };
    group.models.push(model);
    groups.set(model.companyName, group);
  }
  return [...groups.values()].sort((a, b) => a.companyName.localeCompare(b.companyName));
}

function readStored(valid: ReadonlySet<string>): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storeKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && valid.has(id)) : [];
  } catch {
    return [];
  }
}

/**
 * The Custom card on /play: search, one row per model grouped by company (the company's origin sits on its header,
 * each row shows the year and size), a whole company at once, and a Start button that waits for two models.
 * The picks open in a window from the footer. The last choice is remembered in this browser.
 */
export function CustomPicker({
  models,
  openGameId,
  disabled,
  onStart,
  onContinue,
}: {
  models: CustomModel[];
  /** An unfinished Custom round. Starting is replaced by continuing it. */
  openGameId: string | null;
  disabled: boolean;
  onStart: (ids: string[]) => void;
  onContinue: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const byId = useMemo(() => new Map(models.map((model) => [model.id, model])), [models]);
  const groups = useMemo(() => groupByCompany(filterPickerModels(models, query) as CustomModel[]), [models, query]);

  useEffect(() => {
    setSelected(readStored(new Set(models.map((model) => model.id))));
  }, [models]);

  function change(next: string[]) {
    setSelected(next);
    try {
      window.localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {
      // The choice only lasts for this visit.
    }
  }

  const toggle = (id: string) => change(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  const addAll = (group: Group) => change([...selected, ...group.models.map((model) => model.id).filter((id) => !selected.includes(id))]);
  const dropAll = (group: Group) => change(selected.filter((id) => !group.models.some((model) => model.id === id)));

  const chosen = selected.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const ready = chosen.length >= minCustomModels;

  if (openGameId) {
    return (
      <div className="custom-picker">
        <p className="difficulty-resume">{unfinishedLine}</p>
        <button type="button" className="button" onClick={() => onContinue(openGameId)}>
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="custom-picker">
      <p className="difficulty-heading">Choose your models</p>
      <div className="custom-bar">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search models or companies"
          aria-label="Search models"
        />
      </div>
      <div className="custom-groups">
        {groups.length === 0 ? <p className="muted custom-empty">No model matches.</p> : null}
        {groups.map((group) => {
          const picked = group.models.filter((model) => selected.includes(model.id)).length;
          const all = picked === group.models.length;
          return (
            <section key={group.companyName} className="custom-group" aria-label={group.companyName}>
              <header>
                <CompanyLogo src={group.logoUrl} />
                <strong>{group.companyName}</strong>
                <span className="muted custom-origin">
                  {group.originFlag} {group.originName}
                </span>
                <span className="muted">
                  {picked}/{group.models.length}
                </span>
                <button
                  className="button-quiet"
                  type="button"
                  aria-label={`${all ? "Drop all" : "Add all"} ${group.companyName} models`}
                  onClick={() => (all ? dropAll(group) : addAll(group))}
                >
                  {all ? "Drop all" : "Add all"}
                </button>
              </header>
              <ul className="custom-models">
                {group.models.map((model) => {
                  const on = selected.includes(model.id);
                  return (
                    <li key={model.id}>
                      <button type="button" className="custom-model" aria-pressed={on} onClick={() => toggle(model.id)}>
                        <span className="custom-tick" aria-hidden="true">
                          {on ? "✓" : ""}
                        </span>
                        <span className="custom-name">{model.name}</span>
                        <span className="muted custom-facts">
                          {model.year} · {model.sizeName}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="custom-foot">
        <button
          type="button"
          className="button-quiet custom-count"
          disabled={chosen.length === 0}
          onClick={() => dialogRef.current?.showModal()}
          aria-live="polite"
        >
          {chosen.length === 0
            ? `Pick at least ${minCustomModels} models`
            : ready
              ? `${chosen.length} models picked`
              : `${chosen.length} picked, ${minCustomModels - chosen.length} more to start`}
        </button>
        <button type="button" className="button" disabled={disabled || !ready} onClick={() => onStart(chosen.map((model) => model.id))}>
          Start
        </button>
      </div>
      <dialog ref={dialogRef} className="dialog custom-selected">
        <h2>Your models ({chosen.length})</h2>
        {chosen.length === 0 ? (
          <p className="muted">No model picked yet.</p>
        ) : (
          <ul className="custom-selected-list">
            {chosen.map((model) => (
              <li key={model.id}>
                <span className="custom-name">{model.name}</span>
                <span className="muted custom-facts">{model.companyName}</span>
                <button type="button" className="button-quiet" aria-label={`Remove ${model.name}`} onClick={() => toggle(model.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="row">
          <button type="button" className="button-quiet" disabled={chosen.length === 0} onClick={() => change([])}>
            Clear all
          </button>
          <button type="button" className="button" onClick={() => dialogRef.current?.close()}>
            Done
          </button>
        </div>
      </dialog>
    </div>
  );
}
