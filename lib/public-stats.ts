import {
  computeGameMetrics,
  hasFinishedAt,
  utcDate,
  type DayCount,
  type GameFact,
  type GuessFact,
  type UsageFact,
} from "./admin-metrics";
import type { Region, Size } from "./game";

const sizes: Size[] = ["nano", "small", "medium", "large", "xxl"];
const regions: Region[] = ["us", "cn", "eu"];

export type PublicGameFact = GameFact & {
  gameMode: string;
  size: Size | null;
  region: Region | null;
  categoryIds: string[];
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

export type NamedGameMode = { id: string; name: string };

export type NamedCategory = { id: string; name: string };

export type CategoryStat = TraitRow & { name: string };

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

export type GameModeReport = {
  id: string;
  name: string;
  games: number;
  open: number;
  finished: number;
  outcome: Outcome | null;
  models: ModelOutcome[];
  confusion: ConfusionPair[];
  days: DayCount[];
  sizes: TraitRow[];
  regions: TraitRow[];
};

export const statisticModes = [
  { id: "main", name: "All modes", enabled: true },
  { id: "daily", name: "Daily", enabled: true },
  { id: "all", name: "All models", enabled: true },
  { id: "class", name: "Category", enabled: false },
  { id: "company", name: "Company", enabled: false },
  { id: "region", name: "Region", enabled: false },
  { id: "custom", name: "Custom", enabled: false },
] as const;

export type StatisticModeId = (typeof statisticModes)[number]["id"];

export type PublicStats = {
  outcome: Outcome;
  models: ModelOutcome[];
  days: DayCount[];
  confusion: ConfusionPair[];
  sizes: TraitRow[];
  regions: TraitRow[];
  categories: CategoryStat[];
  gameModes: GameModeReport[];
};

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

function categoryRows(
  games: PublicGameFact[],
  usage: PublicUsageFact[],
  guesses: PublicGuessFact[],
  categories: NamedCategory[],
): CategoryStat[] {
  return [...categories]
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map((item) => {
      const subset = games.filter((game) => game.categoryIds.includes(item.id));
      const outcome = outcomeFrom(subset, usage, guesses);
      const solved = subset.filter((game) => game.status === "solved").length;
      const solvedMessages = subset.reduce((sum, game) => (game.status === "solved" ? sum + game.messageCount : sum), 0);
      return {
        key: item.id,
        name: item.name,
        games: subset.length,
        finished: outcome.finished,
        solveRate: outcome.solveRate,
        avgMessagesWhenSolved: solved > 0 ? solvedMessages / solved : null,
        tokensPerGame: outcome.tokensPerGame,
        regionFoundRate: outcome.regionFoundRate,
      };
    });
}

/** A finished Daily round started today. Naming it would show today's hidden model. */
function isTodayDaily(game: PublicGameFact, today: string): boolean {
  return game.gameMode === "daily" && utcDate(game.startedAt) === today;
}

function withoutTodayDaily(games: PublicGameFact[], today: string): PublicGameFact[] {
  return games.filter((game) => !isTodayDaily(game, today));
}

function gameModeReport(
  gameMode: NamedGameMode,
  games: PublicGameFact[],
  usage: PublicUsageFact[],
  guesses: PublicGuessFact[],
  today: string,
  now?: Date,
): GameModeReport {
  const rows = games.filter((game) => game.gameMode === gameMode.id);
  if (rows.length === 0) {
    return {
      id: gameMode.id,
      name: gameMode.name,
      games: 0,
      open: 0,
      finished: 0,
      outcome: null,
      models: [],
      confusion: [],
      days: [],
      sizes: [],
      regions: [],
    };
  }
  const ids = new Set(rows.map((game) => game.id));
  const named = withoutTodayDaily(rows, today);
  const metrics = computeGameMetrics(
    rows,
    tiedUsage(usage, ids),
    asGuesses(guesses.filter((guess) => ids.has(guess.gameId))),
    now,
  );
  return {
    id: gameMode.id,
    name: gameMode.name,
    games: rows.length,
    open: 0,
    finished: rows.length,
    outcome: {
      games: rows.length,
      open: 0,
      finished: rows.length,
      solved: metrics.solved,
      missed: metrics.missed,
      givenUp: metrics.givenUp,
      solveRate: rows.length > 0 ? metrics.solved / rows.length : null,
      giveUpRate: rows.length > 0 ? metrics.givenUp / rows.length : null,
      guesses: metrics.guesses,
      correctGuesses: metrics.correctGuesses,
      guessAccuracy: metrics.guessAccuracy,
      messagesPerGame: metrics.messagesPerGame,
      tokensPerGame: metrics.tokensPerGame,
      regionFoundRate: regionFoundRate(rows, guesses),
    },
    models: modelsFrom(named, usage, guesses),
    confusion: confusionPairs(named, guesses),
    days: metrics.days,
    sizes: traitRows(named, usage, guesses, "size", sizes),
    regions: traitRows(named, usage, guesses, "region", regions),
  };
}

export function computePublicStats(
  games: PublicGameFact[],
  usage: PublicUsageFact[],
  guesses: PublicGuessFact[],
  gameModes: NamedGameMode[],
  categories: NamedCategory[] = [],
  now: Date = new Date(),
): PublicStats {
  const counted = games.filter((game) => hasFinishedAt(game));
  const today = utcDate(now);
  const named = withoutTodayDaily(counted, today);
  const playable = gameModes.filter((gameMode) => gameMode.id !== "family");
  const known = new Set(playable.map((gameMode) => gameMode.id));
  const extra = [...new Set(counted.map((game) => game.gameMode).filter((id) => id !== "family" && !known.has(id)))].sort();
  const listed = [...playable, ...extra.map((id) => ({ id, name: id }))];
  const countedIds = new Set(counted.map((game) => game.id));
  const overall = computeGameMetrics(
    counted,
    tiedUsage(usage, countedIds),
    asGuesses(guesses.filter((guess) => countedIds.has(guess.gameId))),
    now,
  );
  return {
    outcome: {
      games: counted.length,
      open: 0,
      finished: counted.length,
      solved: overall.solved,
      missed: overall.missed,
      givenUp: overall.givenUp,
      solveRate: counted.length > 0 ? overall.solved / counted.length : null,
      giveUpRate: counted.length > 0 ? overall.givenUp / counted.length : null,
      guesses: overall.guesses,
      correctGuesses: overall.correctGuesses,
      guessAccuracy: overall.guessAccuracy,
      messagesPerGame: overall.messagesPerGame,
      tokensPerGame: overall.tokensPerGame,
      regionFoundRate: regionFoundRate(counted, guesses),
    },
    models: modelsFrom(named, usage, guesses),
    days: overall.days,
    confusion: confusionPairs(named, guesses),
    sizes: traitRows(named, usage, guesses, "size", sizes),
    regions: traitRows(named, usage, guesses, "region", regions),
    categories: categoryRows(named, usage, guesses, categories),
    gameModes: listed.map((gameMode) => gameModeReport(gameMode, counted, usage, guesses, today, now)),
  };
}
