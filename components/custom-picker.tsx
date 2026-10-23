"use client";

import { useEffect, useState } from "react";
import { minCustomModels, type CustomModel } from "@/lib/custom-mode";
import { unfinishedLine } from "@/lib/lobby-row";
import { ModelSelector } from "./model-selector";

const storeKey = "custom-models";

function readStored(valid: ReadonlySet<string>): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storeKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && valid.has(id)) : [];
  } catch {
    return [];
  }
}

/**
 * The Custom card on /play: the model selector and a Start button that waits for two models.
 * The last choice is remembered in this browser.
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

  const known = new Set(models.map((model) => model.id));
  const chosen = selected.filter((id) => known.has(id));
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
      <ModelSelector
        models={models}
        selected={selected}
        onChange={change}
        title="Your models"
        countLabel={(count) =>
          count === 0
            ? `Pick at least ${minCustomModels} models`
            : count >= minCustomModels
              ? `${count} models picked`
              : `${count} picked, ${minCustomModels - count} more to start`
        }
      >
        <button type="button" className="button" disabled={disabled || !ready} onClick={() => onStart(chosen)}>
          Start
        </button>
      </ModelSelector>
    </div>
  );
}
