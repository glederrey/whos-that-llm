"use client";

import { useMemo, useState } from "react";
import { filterPickerModels, selectShown, type PickerModel } from "@/lib/admin-category";
import { CompanyLogo } from "./company-logo";

// The models of a category, in the category form: a search box, a scrollable list of every model with a
// checkbox, the selection as removable chips, and one hidden `modelId` input per selected model. The selection
// lives in state, so a model the filter hides is still submitted.
export function CategoryModelPicker({ models, defaultIds }: { models: PickerModel[]; defaultIds: string[] }) {
  const [selected, setSelected] = useState<string[]>(defaultIds);
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterPickerModels(models, query), [models, query]);
  const byId = useMemo(() => new Map(models.map((model) => [model.id, model])), [models]);
  const chosen = selected.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <fieldset className="model-picker span-2">
      <legend>Models</legend>
      {chosen.map((model) => (
        <input key={model.id} type="hidden" name="modelId" value={model.id} />
      ))}
      <div className="model-picker-bar">
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
        <button className="button-quiet" type="button" onClick={() => setSelected((current) => selectShown(current, shown))}>
          Select shown
        </button>
        <button className="button-quiet" type="button" onClick={() => setSelected([])}>
          Clear
        </button>
        <span className="muted" aria-live="polite">
          {chosen.length} selected
        </span>
      </div>
      {chosen.length > 0 ? (
        <ul className="model-chips" aria-label="Selected models">
          {chosen.map((model) => (
            <li key={model.id}>
              <button
                type="button"
                className={model.enabled ? "model-chip" : "model-chip is-off"}
                onClick={() => toggle(model.id)}
                aria-label={`Remove ${model.name}`}
              >
                {model.name} <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="model-picker-list">
        {shown.length === 0 ? <p className="muted">No model matches.</p> : null}
        {shown.map((model) => (
          <label key={model.id} className={model.enabled ? "check model-option" : "check model-option is-off"}>
            <input type="checkbox" checked={selected.includes(model.id)} onChange={() => toggle(model.id)} />
            <CompanyLogo src={model.logoUrl} />
            <span>{model.name}</span>
            <span className="muted">{model.companyName}</span>
            {model.enabled ? null : <span className="tag">off</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
