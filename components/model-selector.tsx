"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { filterPickerModels } from "@/lib/admin-category";
import type { CustomModel } from "@/lib/custom-mode";
import { CompanyLogo } from "./company-logo";
import { Twemoji } from "./twemoji";

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

/** Year and size. A model with no release date shows its size alone. */
const modelFacts = (model: CustomModel) => (model.year ? `${model.year} · ${model.sizeName}` : model.sizeName);

/**
 * Search, one row per model grouped by company (the company's origin sits on its header, each row shows the year
 * and size), a whole company at once, and a footer button that opens the picks in a window. The Custom card and the
 * category form both use it. The caller owns the selection. `children` sit next to the count in the footer.
 */
export function ModelSelector({
  models,
  selected,
  onChange,
  countLabel,
  title,
  children,
}: {
  models: CustomModel[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** The footer button's text for `count` picked models. */
  countLabel: (count: number) => string;
  /** The picks window's heading. */
  title: string;
  children?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const byId = useMemo(() => new Map(models.map((model) => [model.id, model])), [models]);
  const groups = useMemo(() => groupByCompany(filterPickerModels(models, query) as CustomModel[]), [models, query]);

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  const addAll = (group: Group) => onChange([...selected, ...group.models.map((model) => model.id).filter((id) => !selected.includes(id))]);
  const dropAll = (group: Group) => onChange(selected.filter((id) => !group.models.some((model) => model.id === id)));

  const chosen = selected.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));

  return (
    <>
      <div className="custom-bar">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
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
                  <Twemoji emoji={group.originFlag} /> {group.originName}
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
                        {model.enabled ? null : <span className="tag">off</span>}
                        <span className="muted custom-facts">
                          {modelFacts(model)}
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
          {countLabel(chosen.length)}
        </button>
        {children}
      </div>
      <dialog ref={dialogRef} className="dialog custom-selected">
        <h2>
          {title} ({chosen.length})
        </h2>
        {chosen.length === 0 ? (
          <p className="muted">No model picked yet.</p>
        ) : (
          <div className="custom-selected-groups">
            {groupByCompany(chosen).map((group) => (
              <section key={group.companyName} aria-label={group.companyName}>
                <header>
                  <CompanyLogo src={group.logoUrl} />
                  <strong>{group.companyName}</strong>
                  <span className="muted">{group.models.length}</span>
                </header>
                <ul className="custom-selected-list">
                  {group.models.map((model) => (
                    <li key={model.id}>
                      <span className="custom-name">{model.name}</span>
                      <span className="muted custom-facts">
                        {modelFacts(model)}
                      </span>
                      <button type="button" className="custom-remove" aria-label={`Remove ${model.name}`} onClick={() => toggle(model.id)}>
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        <div className="row">
          <button type="button" className="button-quiet" disabled={chosen.length === 0} onClick={() => onChange([])}>
            Clear all
          </button>
          <button type="button" className="button" onClick={() => dialogRef.current?.close()}>
            Done
          </button>
        </div>
      </dialog>
    </>
  );
}
