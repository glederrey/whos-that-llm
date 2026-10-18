import type { Difficulty } from "./difficulty";

export type OpenGame = {
  id: string;
  mode: string;
  difficulty: Difficulty | null;
  companyId?: string | null;
};

/** Replaces the model count on a difficulty that still has an open round. */
export const unfinishedLine = "Game isn't finished yet. Continue?";

export function openGameOn(games: readonly OpenGame[], mode: string, difficulty: Difficulty): OpenGame | null {
  return games.find((game) => game.mode === mode && game.difficulty === difficulty) ?? null;
}

/** The mode to expand so an unfinished round is visible. Daily, then All models, then Company. */
export function modeToOpen(games: readonly OpenGame[]): string | null {
  for (const mode of ["daily", "all"]) {
    if (games.some((game) => game.mode === mode && game.difficulty)) return mode;
  }
  if (games.some((game) => game.mode === "company" && game.companyId)) return "company";
  return null;
}

export function openCompanyOn(games: readonly OpenGame[], companyId: string): OpenGame | null {
  return games.find((game) => game.mode === "company" && game.companyId === companyId) ?? null;
}

export function difficultyAside(count: number, open: boolean): string {
  if (open) return unfinishedLine;
  return count === 1 ? "1 model" : `${count} models`;
}

/**
 * A finished Daily difficulty stays closed.
 * An unfinished difficulty stays clickable so that round can resume.
 * Another difficulty can start, unless the hour is full, the game is paused, or the pool is too small.
 */
export function difficultyBlocked(input: {
  open: boolean;
  finished: boolean;
  playable: boolean;
  paused: boolean;
  busy: boolean;
  full: boolean;
  count: number;
}): boolean {
  if (input.finished) return true;
  if (input.open) return false;
  return !input.playable || input.paused || input.busy || input.count < 2 || input.full;
}
