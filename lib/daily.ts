import { difficultyNumber, inDifficultyPool, type Difficulty } from "./difficulty";

export type DailyModel = {
  id: string;
  difficulty: Difficulty;
};

/** The hidden model for one difficulty on one UTC day. */
export type DailyPick = {
  day: string;
  difficulty: Difficulty;
  modelId: string;
};

export type DailyRound = {
  id: string;
  day: string;
  status: "active" | "solved" | "miss" | "given_up";
  modelId: string;
  difficulty: Difficulty;
};

export type DailyStart =
  | { kind: "resume"; gameId: string; modelId: string; picks: DailyPick[] }
  | { kind: "done"; picks: DailyPick[] }
  | { kind: "start"; modelId: string; picks: DailyPick[] }
  | { kind: "empty"; picks: DailyPick[] };

/** The Daily card on `/play`. This replaces the stored blurb. */
export const dailyCardBlurb =
  "One round per difficulty. Everyone at that level gets the same model. A new puzzle tomorrow.";

/** Daily, All models, Company, Category, Origin, and Custom. */
export function canStartMode(id: string): boolean {
  return id === "all" || id === "daily" || id === "company" || id === "class" || id === "origin" || id === "custom";
}

/**
 * Daily is open on the lobby. The card uses `dailyCardBlurb`.
 * A stored `enabled = false` and the old blurb do not put Coming soon back.
 */
export function presentDailyCard<T extends { id: string; blurb: string; enabled: boolean }>(mode: T): T {
  if (mode.id !== "daily") return mode;
  return { ...mode, blurb: dailyCardBlurb, enabled: true };
}

/** UTC calendar day, `YYYY-MM-DD`. Tomorrow is a different key. */
export function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The models All models can already draw at this difficulty:
 * enabled rows whose stored difficulty is less than or equal to the chosen level.
 */
export function dailyRoster(models: readonly DailyModel[], difficulty: Difficulty): DailyModel[] {
  return models.filter((model) => inDifficultyPool(model.difficulty, difficulty));
}

/**
 * One hidden model per difficulty per UTC day.
 * The first call stores a draw from that difficulty's roster.
 * A later call the same day returns the stored model and does not draw again.
 */
export function dailyModel(
  picks: readonly DailyPick[],
  day: string,
  difficulty: Difficulty,
  roster: readonly DailyModel[],
  roll: (count: number) => number,
): { modelId: string; picks: DailyPick[] } | null {
  const existing = picks.find((pick) => pick.day === day && pick.difficulty === difficulty);
  if (existing) return { modelId: existing.modelId, picks: [...picks] };
  const pool = dailyRoster(roster, difficulty);
  if (pool.length === 0) return null;
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(roll(pool.length))));
  const model = pool[index];
  if (!model) return null;
  if (difficultyNumber[model.difficulty] > difficultyNumber[difficulty]) return null;
  return { modelId: model.id, picks: [...picks, { day, difficulty, modelId: model.id }] };
}

/**
 * The value stored in `games.daily_key`.
 * The unique `(user_id, daily_key)` pair then allows Easy and Medium on the same day
 * and still refuses a second Easy. `1` is easy through `4` impossible.
 */
export function dailyRoundKey(day: string, difficulty: Difficulty): string {
  return `${day}:${difficultyNumber[difficulty]}`;
}

/** A finished difficulty is closed. Not started, and an unfinished round, stay open. */
export function dailyLevelClosed(status: DailyRound["status"] | null): boolean {
  return status !== null && status !== "active";
}

/**
 * One Daily round per difficulty per UTC day.
 * An open round of this difficulty resumes.
 * A finished round of this difficulty stays finished until tomorrow.
 * Another difficulty is a different round.
 */
export function startDailyRound(input: {
  day: string;
  difficulty: Difficulty;
  roster: readonly DailyModel[];
  picks: readonly DailyPick[];
  round: DailyRound | null;
  roll: (count: number) => number;
}): DailyStart {
  if (input.round && input.round.day === input.day && input.round.difficulty === input.difficulty) {
    if (input.round.status === "active") {
      return {
        kind: "resume",
        gameId: input.round.id,
        modelId: input.round.modelId,
        picks: [...input.picks],
      };
    }
    return { kind: "done", picks: [...input.picks] };
  }
  const drawn = dailyModel(input.picks, input.day, input.difficulty, input.roster, input.roll);
  if (!drawn) return { kind: "empty", picks: [...input.picks] };
  return { kind: "start", modelId: drawn.modelId, picks: drawn.picks };
}
