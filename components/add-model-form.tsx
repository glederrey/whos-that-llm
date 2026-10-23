"use client";

import { useState } from "react";
import { addModel } from "@/app/admin/actions";
import { lookupOpenRouterModel } from "@/app/admin/model-lookup";
import type { OriginOption } from "@/lib/admin-origin";
import { validOpenRouterId } from "@/lib/admin-model";
import type { ModelDraft } from "@/lib/openrouter-draft";
import type { RosterSort } from "@/lib/roster-list";
import { ModelFields, type ModelFieldCategory } from "./model-fields";
import { RosterReturnFields } from "./roster-return-fields";

export function AddModelForm({
  categories,
  origins,
  query,
  sort,
  activePage,
  inactivePage,
  unavailablePage,
}: {
  categories: ModelFieldCategory[];
  origins: OriginOption[];
  query: string;
  sort: RosterSort;
  activePage: number;
  inactivePage: number;
  unavailablePage: number;
}) {
  const [openrouterId, setOpenrouterId] = useState("");
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<ModelDraft | null>(null);
  const [lookupKey, setLookupKey] = useState(0);

  async function lookUp() {
    const id = openrouterId.trim();
    if (!validOpenRouterId(id)) {
      setNote("Check the OpenRouter id. It looks like openai/gpt-5.6-luna.");
      setDraft(null);
      return;
    }
    setPending(true);
    setNote("");
    try {
      const result = await lookupOpenRouterModel(id);
      if (!result.ok) {
        setDraft(emptyDraft());
        setNote("OpenRouter did not answer. Fill in the form.");
      } else if (!result.found) {
        setDraft(emptyDraft());
        setNote("OpenRouter has no model with that id. Fill in the form.");
      } else {
        setDraft(result.draft);
        setNote("Size, difficulty, and categories stay blank. OpenRouter does not set the difficulty. Change anything before you save.");
      }
      setLookupKey((current) => current + 1);
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={addModel} className="stack">
      <RosterReturnFields query={query} sort={sort} activePage={activePage} inactivePage={inactivePage} unavailablePage={unavailablePage} />
      <div className="roster-lookup">
        <label>
          OpenRouter id
          <input
            name="openrouterId"
            value={openrouterId}
            placeholder="openai/gpt-5.6-luna"
            required
            onChange={(event) => setOpenrouterId(event.target.value)}
          />
        </label>
        <button className="button" type="button" onClick={lookUp} disabled={pending}>
          {pending ? "Looking up…" : "Look up"}
        </button>
      </div>
      {note ? <p className="muted">{note}</p> : <p className="muted">Enter the OpenRouter id first.</p>}
      {draft ? (
        <>
          <div className="roster-form">
            <ModelFields
              key={lookupKey}
              omitOpenRouterId
              name={draft.name}
              company={draft.company}
              origin={draft.origin}
              origins={origins}
              releasedOn={draft.releasedOn}
              size=""
              categories={categories}
            />
          </div>
          <p className="muted">
            A new model stays off until you turn it on. A new company name is added to the list.
          </p>
          <div>
            <button className="button" type="submit">
              Add model
            </button>
          </div>
        </>
      ) : null}
    </form>
  );
}

function emptyDraft(): ModelDraft {
  return { name: "", company: "", origin: "", releasedOn: "" };
}
