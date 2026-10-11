export const difficulties = ["easy", "medium", "hard", "impossible"] as const;

export type Difficulty = (typeof difficulties)[number];

/** Stored on `models.difficulty` and `games.difficulty`. The screens show the name. */
export const difficultyNumber: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
  impossible: 4,
};

export const difficultyLabel: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  impossible: "Impossible",
};

/** The short line beside each difficulty name on the play page. */
export const difficultyBlurb: Record<Difficulty, string> = {
  easy: "famous models",
  medium: "familiar variants",
  hard: "near-duplicates",
  impossible: "the whole roster",
};

export function isDifficulty(value: string): value is Difficulty {
  return (difficulties as readonly string[]).includes(value);
}

/** Any difficulty is the combined All models board: a score from whichever difficulty was played. */
export const anyDifficulty = "any" as const;

export type BoardDifficulty = Difficulty | typeof anyDifficulty;

export function parseBoardDifficulty(value: string | null | undefined): BoardDifficulty {
  if (!value || value === anyDifficulty) return anyDifficulty;
  return parseDifficulty(value) ?? anyDifficulty;
}

/** A name from a form, a URL, or the play request. */
export function parseDifficulty(value: string | null | undefined): Difficulty | null {
  const text = value?.trim().toLowerCase() ?? "";
  return isDifficulty(text) ? text : null;
}

/** A stored smallint, or a name from a form. */
export function difficultyFromStored(value: unknown): Difficulty | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return difficulties.find((item) => difficultyNumber[item] === value) ?? null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^[1-4]$/.test(trimmed)) return difficultyFromStored(Number(trimmed));
    return parseDifficulty(trimmed);
  }
  return null;
}

/** A game at X includes every model whose stored difficulty is <= X. */
export function inDifficultyPool(model: Difficulty, game: Difficulty): boolean {
  return difficultyNumber[model] <= difficultyNumber[game];
}
