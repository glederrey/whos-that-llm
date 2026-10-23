"use client";

import { useState } from "react";
import type { CustomModel } from "@/lib/custom-mode";
import { ModelSelector } from "./model-selector";

// The models of a category, in the category form: the same selector as the Custom card, and one hidden `modelId`
// input per selected model. The selection lives in state, so a model the search hides is still submitted.
export function CategoryModelPicker({ models, defaultIds }: { models: CustomModel[]; defaultIds: string[] }) {
  const [selected, setSelected] = useState<string[]>(defaultIds);
  const known = new Set(models.map((model) => model.id));

  return (
    <fieldset className="model-picker span-2">
      <legend>Models</legend>
      {selected
        .filter((id) => known.has(id))
        .map((id) => (
          <input key={id} type="hidden" name="modelId" value={id} />
        ))}
      <ModelSelector
        models={models}
        selected={selected}
        onChange={setSelected}
        title="Category models"
        countLabel={(count) => (count === 0 ? "No model selected" : `${count} selected`)}
      />
    </fieldset>
  );
}
