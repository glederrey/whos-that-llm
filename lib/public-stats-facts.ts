import type { Origin, Size } from "./game";
import type { PublicGameFact, PublicGuessFact, PublicUsageFact } from "./public-stats";

/** What `public.statistics_facts()` returns. The column order is documented in the migration. */
export type StatisticsFacts = {
  games: unknown[][];
  usage: unknown[][];
  guesses: unknown[][];
};

const sizeIds: readonly string[] = ["nano", "small", "medium", "large", "xxl"];

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function gameFact(row: unknown[]): PublicGameFact {
  return {
    id: String(row[0]),
    modelId: row[1] as string,
    status: row[2] as string,
    messageCount: Number(row[3] ?? 0),
    startedAt: row[4] as string,
    finishedAt: text(row[5]),
    gameMode: row[6] as string,
    size: sizeIds.includes(row[7] as string) ? (row[7] as Size) : null,
    origin: text(row[8]) as Origin | null,
    poolKey: text(row[9]),
    difficulty: row[10] === null || row[10] === undefined ? null : Number(row[10]),
    noHint: Boolean(row[11]),
    score: row[12] === null || row[12] === undefined ? null : Number(row[12]),
    poolModelIds: Array.isArray(row[13]) ? row[13].flatMap((id) => (typeof id === "string" ? [id] : [])) : [],
  };
}

/**
 * The database folds the guesses of a round into counts. The figures only read counts and, per guess, one flag,
 * the wrong model that was named, and the origin of the last guess, so a round is rebuilt with that many guesses:
 * the right ones first, then the wrong ones that named a model, and the origin on the last guess.
 */
export function expandGuesses(
  gameId: string,
  total: number,
  modelRight: number,
  originRight: number,
  lastOrigin: string | null,
  wrong: string[],
): PublicGuessFact[] {
  const guesses: PublicGuessFact[] = [];
  for (let index = 0; index < total; index += 1) {
    const wrongIndex = index - modelRight;
    guesses.push({
      gameId,
      modelCorrect: index < modelRight,
      guessedModelId: wrongIndex >= 0 && wrongIndex < wrong.length ? wrong[wrongIndex] : null,
      guessedOrigin: index === total - 1 ? lastOrigin : null,
      originCorrect: index < originRight,
    });
  }
  return guesses;
}

export function factsFromRows(facts: StatisticsFacts): {
  games: PublicGameFact[];
  usage: PublicUsageFact[];
  guesses: PublicGuessFact[];
} {
  const games = (facts.games ?? []).map(gameFact);
  const usage: PublicUsageFact[] = (facts.usage ?? []).map((row) => ({
    gameId: String(row[0]),
    modelId: row[1] as string,
    inputTokens: Number(row[2] ?? 0),
    outputTokens: 0,
  }));
  const guesses = (facts.guesses ?? []).flatMap((row) =>
    expandGuesses(
      String(row[0]),
      Number(row[1]),
      Number(row[2]),
      Number(row[3]),
      text(row[4]),
      Array.isArray(row[5]) ? row[5].flatMap((id) => (typeof id === "string" ? [id] : [])) : [],
    ),
  );
  return { games, usage, guesses };
}
