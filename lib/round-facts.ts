import { difficultyFromStored, difficultyLabel, type Difficulty } from "./difficulty";

/** The game mode name stored for this round. The id is the fallback when that name is blank. */
export function modeLabel(name: string | null | undefined, id: string): string {
  const trimmed = name?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : id;
}

/** Easy, Medium, Hard, or Impossible. A round with no stored difficulty has none. */
export function difficultyText(value: Difficulty | null | undefined): string {
  return value ? difficultyLabel[value] : "—";
}

export function playedRoundFacts(input: {
  gameModeId: string;
  gameModeName: string | null | undefined;
  difficulty: unknown;
}): { mode: string; difficulty: Difficulty | null } {
  return {
    mode: modeLabel(input.gameModeName, input.gameModeId),
    difficulty: difficultyFromStored(input.difficulty),
  };
}
