import {
  computeGameMetrics,
  hasFinishedAt,
  utcDate,
  type DayCount,
  type GameFact,
  type GuessFact,
  type UsageFact,
} from "./admin-metrics";
import type { Origin, Size } from "./game";

const sizes: Size[] = ["nano", "small", "medium", "large", "xxl"];
const builtInOrigins: Origin[] = ["us", "cn", "eu"];

/** The three first origins keep their place; any origin an admin added follows, in id order. */
function originOrder(games: PublicGameFact[]): Origin[] {
  const extra = new Set<Origin>();
  for (const game of games) if (game.origin && !builtInOrigins.includes(game.origin)) extra.add(game.origin);
  return [...builtInOrigins, ...[...extra].sort()];
}

export type PublicGameFact = GameFact & {
  gameMode: string;
  size: Size | null;
  origin: Origin | null;
  /** `games.pool_key`: the company id (Company mode) or category id (Category mode). */
  poolKey: string | null;
  /** `games.difficulty`: 1 easy to 4 impossible. Null where the mode has none. */
  difficulty: number | null;
  noHint: boolean;
  score: number | null;
  /** `games.pool_model_ids`: the models the round drew from. Custom reports count them. */
  poolModelIds?: string[];
};

export type PublicGuessFact = GuessFact & {
  guessedModelId: string | null;
  guessedOrigin: string | null;
  originCorrect: boolean;
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
  medianMessages: number | null;
  tokensPerGame: number | null;
  medianTokens: number | null;
  originFoundRate: number | null;
  /** Mean and best score over finished rounds that have one. Null where the mode has no score. */
  avgScore: number | null;
  bestScore: number | null;
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
  originFoundRate: number | null;
  avgScore: number | null;
};

/** One real origin in the Origin mode: how often it was found, and what people picked instead. */
export type OriginPickRow = {
  origin: Origin;
  games: number;
  solved: number;
  givenUp: number;
  foundRate: number | null;
  picks: { origin: Origin; count: number }[];
};

/** How many models Custom rounds were played with, and which models were picked most. */
export type CustomReport = {
  /** Mean number of models in a round's pool. */
  avgModels: number | null;
  /** Rounds by pool size, in fixed buckets from small to large. */
  sizes: { label: string; rounds: number }[];
  /** Models in the most pools, most picked first. `share` is the part of the rounds that held the model. */
  picked: { modelId: string; rounds: number; share: number }[];
};

const customSizeBuckets = [
  { label: "2", min: 2, max: 2 },
  { label: "3-5", min: 3, max: 5 },
  { label: "6-10", min: 6, max: 10 },
  { label: "11-20", min: 11, max: 20 },
  { label: "21-50", min: 21, max: 50 },
  { label: "51+", min: 51, max: Infinity },
];

/** Most picked models listed on the Custom tab. */
export const customPickedLimit = 15;

function customReport(games: PublicGameFact[]): CustomReport {
  const pools = games.map((game) => game.poolModelIds ?? []).filter((pool) => pool.length > 0);
  const counts = new Map<string, number>();
  for (const pool of pools) for (const id of new Set(pool)) counts.set(id, (counts.get(id) ?? 0) + 1);
  return {
    avgModels: pools.length > 0 ? pools.reduce((sum, pool) => sum + pool.length, 0) / pools.length : null,
    sizes: customSizeBuckets.map((bucket) => ({
      label: bucket.label,
      rounds: pools.filter((pool) => pool.length >= bucket.min && pool.length <= bucket.max).length,
    })),
    picked: [...counts.entries()]
      .map(([modelId, rounds]) => ({ modelId, rounds, share: rounds / pools.length }))
      .sort((a, b) => b.rounds - a.rounds || a.modelId.localeCompare(b.modelId))
      .slice(0, customPickedLimit),
  };
}

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
  origins: TraitRow[];
  /** Easy to Impossible. Only Daily and All models have a difficulty. */
  difficulties: TraitRow[];
  /** Rounds with hints against rounds played with no hints. */
  hints: TraitRow[];
  originPicks: OriginPickRow[];
  /** Only on the Custom tab. */
  custom: CustomReport | null;
};

export const statisticModes = [
  { id: "main", name: "All modes", enabled: true },
  { id: "daily", name: "Daily", enabled: true },
  { id: "all", name: "All models", enabled: true },
  { id: "company", name: "Company", enabled: true },
  { id: "class", name: "Category", enabled: true },
  { id: "origin", name: "Origin", enabled: true },
  { id: "custom", name: "Custom", enabled: true },
] as const;

export type StatisticModeId = (typeof statisticModes)[number]["id"];

export type PublicStats = {
  outcome: Outcome;
  models: ModelOutcome[];
  days: DayCount[];
  confusion: ConfusionPair[];
  sizes: TraitRow[];
  origins: TraitRow[];
  difficulties: TraitRow[];
  hints: TraitRow[];
  categories: CategoryStat[];
  companies: CategoryStat[];
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

function originFoundRate(games: PublicGameFact[], guesses: PublicGuessFact[]): number | null {
  if (games.length === 0) return null;
  const ids = new Set(games.map((game) => game.id));
  const found = new Set<string>();
  for (const guess of guesses) {
    if (ids.has(guess.gameId) && guess.originCorrect) found.add(guess.gameId);
  }
  let hits = 0;
  for (const id of ids) if (found.has(id)) hits += 1;
  return hits / games.length;
}

function scoreStats(games: PublicGameFact[]): { avgScore: number | null; bestScore: number | null } {
  const scores = games.flatMap((game) => (game.score === null ? [] : [game.score]));
  if (scores.length === 0) return { avgScore: null, bestScore: null };
  return { avgScore: scores.reduce((sum, score) => sum + score, 0) / scores.length, bestScore: Math.max(...scores) };
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
    medianMessages: metrics.medianMessages,
    tokensPerGame: metrics.tokensPerGame,
    medianTokens: metrics.medianTokens,
    originFoundRate: originFoundRate(games, guesses),
    ...scoreStats(games),
  };
}

/** A round given up before any message says nothing about the model, so it is left out. */
function modelsFrom(all: PublicGameFact[], usage: PublicUsageFact[], guesses: PublicGuessFact[]): ModelOutcome[] {
  const games = all.filter((game) => game.messageCount > 0);
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

function originPickRows(games: PublicGameFact[], guesses: PublicGuessFact[]): OriginPickRow[] {
  const byGame = new Map<string, PublicGuessFact>();
  for (const guess of guesses) byGame.set(guess.gameId, guess);
  return originOrder(games).map((origin) => {
    const subset = games.filter((game) => game.origin === origin);
    const solved = subset.filter((game) => game.status === "solved").length;
    const counts = new Map<Origin, number>();
    for (const game of subset) {
      const picked = byGame.get(game.id)?.guessedOrigin;
      if (picked) counts.set(picked, (counts.get(picked) ?? 0) + 1);
    }
    return {
      origin,
      games: subset.length,
      solved,
      givenUp: subset.filter((game) => game.status === "given_up").length,
      foundRate: subset.length > 0 ? solved / subset.length : null,
      picks: [...counts.entries()]
        .map(([pick, count]) => ({ origin: pick, count }))
        .sort((a, b) => b.count - a.count || a.origin.localeCompare(b.origin)),
    };
  });
}

function traitRows(
  games: PublicGameFact[],
  usage: PublicUsageFact[],
  guesses: PublicGuessFact[],
  keyOf: (game: PublicGameFact) => string | null,
  order: readonly string[],
): TraitRow[] {
  const keys = [...order];
  if (games.some((game) => keyOf(game) === null)) keys.push("unknown");
  return keys.map((value) => {
    const subset = games.filter((game) => (keyOf(game) ?? "unknown") === value);
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
      originFoundRate: outcome.originFoundRate,
      avgScore: outcome.avgScore,
    };
  });
}

const difficultyKeys = ["1", "2", "3", "4"];
const hintKeys = ["hints", "no-hints"];

function difficultyRows(games: PublicGameFact[], usage: PublicUsageFact[], guesses: PublicGuessFact[]): TraitRow[] {
  const rated = games.filter((game) => game.difficulty !== null);
  return traitRows(rated, usage, guesses, (game) => String(game.difficulty), difficultyKeys);
}

function hintRows(games: PublicGameFact[], usage: PublicUsageFact[], guesses: PublicGuessFact[]): TraitRow[] {
  return traitRows(games, usage, guesses, (game) => (game.noHint ? "no-hints" : "hints"), hintKeys);
}

/** One row per company (Company mode) or category (Category mode): the rounds played on that pool. */
function poolRows(
  games: PublicGameFact[],
  usage: PublicUsageFact[],
  guesses: PublicGuessFact[],
  items: NamedCategory[],
  gameMode: string,
): CategoryStat[] {
  return [...items]
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map((item) => {
      const subset = games.filter((game) => game.gameMode === gameMode && game.poolKey === item.id);
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
        originFoundRate: outcome.originFoundRate,
        avgScore: outcome.avgScore,
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
      origins: [],
      difficulties: [],
      hints: [],
      originPicks: [],
      custom: null,
    };
  }
  const ids = new Set(rows.map((game) => game.id));
  const named = withoutTodayDaily(rows, today);
  const originMode = gameMode.id === "origin";
  // An Origin guess is an origin, so it is right when the origin is.
  const modeGuesses = guesses
    .filter((guess) => ids.has(guess.gameId))
    .map((guess) => (originMode ? { ...guess, modelCorrect: guess.originCorrect } : guess));
  const metrics = computeGameMetrics(rows, tiedUsage(usage, ids), asGuesses(modeGuesses), now);
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
      medianMessages: metrics.medianMessages,
      tokensPerGame: metrics.tokensPerGame,
      medianTokens: metrics.medianTokens,
      originFoundRate: originFoundRate(rows, guesses),
      ...scoreStats(rows),
    },
    models: modelsFrom(named, usage, guesses),
    confusion: originMode ? [] : confusionPairs(named, guesses),
    days: metrics.days,
    sizes: originMode ? [] : traitRows(named, usage, guesses, (game) => game.size, sizes),
    origins: originMode ? [] : traitRows(named, usage, guesses, (game) => game.origin, originOrder(named)),
    difficulties: gameMode.id === "daily" || gameMode.id === "all" ? difficultyRows(named, usage, guesses) : [],
    hints: originMode ? [] : hintRows(named, usage, guesses),
    originPicks: originMode ? originPickRows(rows, guesses) : [],
    custom: gameMode.id === "custom" ? customReport(rows) : null,
  };
}

export function computePublicStats(
  games: PublicGameFact[],
  usage: PublicUsageFact[],
  guesses: PublicGuessFact[],
  gameModes: NamedGameMode[],
  pools: { categories?: NamedCategory[]; companies?: NamedCategory[] } = {},
  now: Date = new Date(),
): PublicStats {
  const finished = games.filter((game) => hasFinishedAt(game));
  // Every mode counts in All modes. Origin rounds guess an origin, not a model, so they stay out of the guess
  // figures and of every table that names a model.
  const scored = finished;
  const counted = scored.filter((game) => game.gameMode !== "origin");
  const hinted = withoutTodayDaily(counted, utcDate(now));
  const today = utcDate(now);
  const named = withoutTodayDaily(counted, today);
  const playable = gameModes.filter((gameMode) => gameMode.id !== "family");
  const known = new Set(playable.map((gameMode) => gameMode.id));
  const extra = [...new Set(finished.map((game) => game.gameMode).filter((id) => id !== "family" && !known.has(id)))].sort();
  const listed = [...playable, ...extra.map((id) => ({ id, name: id }))];
  const countedIds = new Set(counted.map((game) => game.id));
  const scoredIds = new Set(scored.map((game) => game.id));
  const overall = computeGameMetrics(
    scored,
    tiedUsage(usage, scoredIds),
    asGuesses(guesses.filter((guess) => countedIds.has(guess.gameId))),
    now,
  );
  return {
    outcome: {
      games: scored.length,
      open: 0,
      finished: scored.length,
      solved: overall.solved,
      missed: overall.missed,
      givenUp: overall.givenUp,
      solveRate: scored.length > 0 ? overall.solved / scored.length : null,
      giveUpRate: scored.length > 0 ? overall.givenUp / scored.length : null,
      guesses: overall.guesses,
      correctGuesses: overall.correctGuesses,
      guessAccuracy: overall.guessAccuracy,
      messagesPerGame: overall.messagesPerGame,
      medianMessages: overall.medianMessages,
      tokensPerGame: overall.tokensPerGame,
      medianTokens: overall.medianTokens,
      originFoundRate: originFoundRate(counted, guesses),
      ...scoreStats(scored),
    },
    models: modelsFrom(named, usage, guesses),
    days: overall.days,
    confusion: confusionPairs(named, guesses),
    sizes: traitRows(named, usage, guesses, (game) => game.size, sizes),
    origins: traitRows(named, usage, guesses, (game) => game.origin, originOrder(named)),
    difficulties: difficultyRows(named, usage, guesses),
    hints: hintRows(hinted, usage, guesses),
    categories: poolRows(named, usage, guesses, pools.categories ?? [], "class"),
    companies: poolRows(named, usage, guesses, pools.companies ?? [], "company"),
    gameModes: listed.map((gameMode) => gameModeReport(gameMode, finished, usage, guesses, today, now)),
  };
}
