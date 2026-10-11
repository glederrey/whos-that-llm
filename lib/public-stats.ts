import {
  computeGameMetrics,
  type DayCount,
  type GameFact,
  type GuessFact,
  type UsageFact,
} from "./admin-metrics";
import type { Region, Size } from "./game";

const sizes: Size[] = ["small", "medium", "large"];
const regions: Region[] = ["us", "cn", "eu"];

export type PublicGameFact = GameFact & {
  category: string;
  size: Size | null;
  region: Region | null;
};

export type PublicGuessFact = GuessFact & {
  guessedModelId: string | null;
  regionCorrect: boolean;
};

export type PublicUsageFact = {
  gameId: string | null;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
};

export type NamedCategory = { id: string; name: string };

export type Outcome = {
  games: number;
  open: number;
  finished: number;
  solved: number;
  missed: number;
  givenUp: number;
  solveRate: number | null;
  giveUpRate: number | null;
  guesses: number;
  correctGuesses: number;
  guessAccuracy: number | null;
  messagesPerGame: number | null;
  tokensPerGame: number | null;
  regionFoundRate: number | null;
};

export type ModelOutcome = {
  modelId: string;
  games: number;
  finished: number;
  solveRate: number | null;
  avgMessagesWhenSolved: number | null;
  tokens: number;
};

export type ConfusionPair = {
  hiddenModelId: string;
  guessedModelId: string;
  count: number;
};

export type TraitRow = {
  key: string;
  games: number;
  finished: number;
  solveRate: number | null;
  avgMessagesWhenSolved: number | null;
  tokensPerGame: number | null;
  regionFoundRate: number | null;
};

export type CategoryReport = {
  id: string;
  name: string;
  games: number;
  open: number;
  finished: number;
  outcome: Outcome | null;
  models: ModelOutcome[];
  confusion: ConfusionPair[];
};

export type PublicStats = {
  outcome: Outcome;
  models: ModelOutcome[];
  days: DayCount[];
  confusion: ConfusionPair[];
  sizes: TraitRow[];
  regions: TraitRow[];
  categories: CategoryReport[];
};

const finishedStatus = new Set(["solved", "miss", "given_up"]);

function isFinished(status: string): boolean {
  return finishedStatus.has(status);
}

function tiedUsage(rows: PublicUsageFact[], ids: Set<string>): UsageFact[] {
  return rows
    .filter((row) => row.gameId !== null && ids.has(row.gameId))
    .map((row) => ({
      gameId: row.gameId,
      modelId: row.modelId,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      reasoningTokens: 0,
      costUsd: 0,
      failed: false,
    }));
}

function asGuesses(rows: PublicGuessFact[]): GuessFact[] {
  return rows.map((row) => ({ gameId: row.gameId, modelCorrect: row.modelCorrect }));
}

function regionFoundRate(games: PublicGameFact[], guesses: PublicGuessFact[]): number | null {
  if (games.length === 0) return null;
  const ids = new Set(games.map((game) => game.id));
  const found = new Set<string>();
  for (const guess of guesses) {
    if (ids.has(guess.gameId) && guess.regionCorrect) found.add(guess.gameId);
  }
  let hits = 0;
  for (const id of ids) if (found.has(id)) hits += 1;
  return hits / games.length;
}

function outcomeFrom(games: PublicGameFact[], usage: PublicUsageFact[], guesses: PublicGuessFact[], now?: Date): Outcome {
  const ids = new Set(games.map((game) => game.id));
  const metrics = computeGameMetrics(games, tiedUsage(usage, ids), asGuesses(guesses.filter((guess) => ids.has(guess.gameId))), now);
  return {
    games: metrics.games,
    open: metrics.open,
    finished: metrics.finished,
    solved: metrics.solved,
    missed: metrics.missed,
    givenUp: metrics.givenUp,
    solveRate: metrics.solveRate,
    giveUpRate: metrics.giveUpRate,
    guesses: metrics.guesses,
    correctGuesses: metrics.correctGuesses,
    guessAccuracy: metrics.guessAccuracy,
    messagesPerGame: metrics.messagesPerGame,
    tokensPerGame: metrics.tokensPerGame,
    regionFoundRate: regionFoundRate(games, guesses),
  };
}

function modelsFrom(games: PublicGameFact[], usage: PublicUsageFact[], guesses: PublicGuessFact[]): ModelOutcome[] {
  const ids = new Set(games.map((game) => game.id));
  const metrics = computeGameMetrics(games, tiedUsage(usage, ids), asGuesses(guesses.filter((guess) => ids.has(guess.gameId))));
  return metrics.models.map((row) => ({
    modelId: row.modelId,
    games: row.games,
    finished: row.finished,
    solveRate: row.solveRate,
    avgMessagesWhenSolved: row.avgMessagesWhenSolved,
    tokens: row.tokens,
  }));
}

function confusionPairs(games: PublicGameFact[], guesses: PublicGuessFact[]): ConfusionPair[] {
  const byId = new Map(games.map((game) => [game.id, game]));
  const counts = new Map<string, ConfusionPair>();
  for (const guess of guesses) {
    if (guess.modelCorrect || !guess.guessedModelId) continue;
    const game = byId.get(guess.gameId);
    if (!game || guess.guessedModelId === game.modelId) continue;
    const key = `${game.modelId}\0${guess.guessedModelId}`;
    const row = counts.get(key) ?? { hiddenModelId: game.modelId, guessedModelId: guess.guessedModelId, count: 0 };
    row.count += 1;
    counts.set(key, row);
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.hiddenModelId.localeCompare(b.hiddenModelId) || a.guessedModelId.localeCompare(b.guessedModelId),
  );
}

function traitRows(
  games: PublicGameFact[],
  usage: PublicUsageFact[],
  guesses: PublicGuessFact[],
  key: "size" | "region",
  order: readonly string[],
): TraitRow[] {
  const keys = [...order];
  if (games.some((game) => game[key] === null)) keys.push("unknown");
  return keys.map((value) => {
    const subset = games.filter((game) => (game[key] ?? "unknown") === value);
    const outcome = outcomeFrom(subset, usage, guesses);
    const solvedMessages = subset.reduce((sum, game) => (game.status === "solved" ? sum + game.messageCount : sum), 0);
    const solved = subset.filter((game) => game.status === "solved").length;
    return {
      key: value,
      games: subset.length,
      finished: outcome.finished,
      solveRate: outcome.solveRate,
      avgMessagesWhenSolved: solved > 0 ? solvedMessages / solved : null,
      tokensPerGame: outcome.tokensPerGame,
      regionFoundRate: outcome.regionFoundRate,
    };
  });
}

function categoryReport(
  category: NamedCategory,
  games: PublicGameFact[],
  usage: PublicUsageFact[],
  guesses: PublicGuessFact[],
): CategoryReport {
  const rows = games.filter((game) => game.category === category.id);
  const finished = rows.filter((game) => isFinished(game.status));
  const open = rows.filter((game) => game.status === "active").length;
  if (finished.length === 0) {
    return { id: category.id, name: category.name, games: rows.length, open, finished: 0, outcome: null, models: [], confusion: [] };
  }
  return {
    id: category.id,
    name: category.name,
    games: rows.length,
    open,
    finished: finished.length,
    outcome: outcomeFrom(finished, usage, guesses),
    models: modelsFrom(finished, usage, guesses),
    confusion: confusionPairs(finished, guesses),
  };
}

export function computePublicStats(
  games: PublicGameFact[],
  usage: PublicUsageFact[],
  guesses: PublicGuessFact[],
  categories: NamedCategory[],
  now: Date = new Date(),
): PublicStats {
  const finished = games.filter((game) => isFinished(game.status));
  const known = new Set(categories.map((category) => category.id));
  const extra = [...new Set(finished.map((game) => game.category).filter((id) => !known.has(id)))].sort();
  const listed = [...categories, ...extra.map((id) => ({ id, name: id }))];
  const finishedIds = new Set(finished.map((game) => game.id));
  const overall = computeGameMetrics(
    games,
    tiedUsage(usage, finishedIds),
    asGuesses(guesses.filter((guess) => finishedIds.has(guess.gameId))),
    now,
  );
  return {
    outcome: {
      games: overall.games,
      open: overall.open,
      finished: overall.finished,
      solved: overall.solved,
      missed: overall.missed,
      givenUp: overall.givenUp,
      solveRate: overall.solveRate,
      giveUpRate: overall.giveUpRate,
      guesses: overall.guesses,
      correctGuesses: overall.correctGuesses,
      guessAccuracy: overall.guessAccuracy,
      messagesPerGame: overall.messagesPerGame,
      tokensPerGame: overall.tokensPerGame,
      regionFoundRate: regionFoundRate(finished, guesses),
    },
    models: modelsFrom(finished, usage, guesses),
    days: overall.days,
    confusion: confusionPairs(finished, guesses),
    sizes: traitRows(finished, usage, guesses, "size", sizes),
    regions: traitRows(finished, usage, guesses, "region", regions),
    categories: listed.map((category) => categoryReport(category, games, usage, guesses)),
  };
}
