export type GameFact = {
  id: string;
  modelId: string;
  status: string;
  messageCount: number;
  startedAt: string;
};

export type UsageFact = {
  gameId: string | null;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  costUsd: number;
  failed: boolean;
};

export type GuessFact = { gameId: string; modelCorrect: boolean };

export type ModelDifficulty = {
  modelId: string;
  games: number;
  finished: number;
  solved: number;
  solveRate: number | null;
  avgMessagesWhenSolved: number | null;
  requests: number;
  failedRequests: number;
  tokens: number;
  costUsd: number;
  costPerGame: number | null;
};

export type DayCount = { date: string; games: number; solved: number };

export type GameMetrics = {
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
  guessesPerGame: number | null;
  messagesPerGame: number | null;
  tokensPerGame: number | null;
  costPerGame: number | null;
  costPerSolvedGame: number | null;
  ledgerCostUsd: number;
  ledgerTokens: number;
  ledgerRequests: number;
  failedRequests: number;
  models: ModelDifficulty[];
  days: DayCount[];
};

const OPEN = "active";
const SOLVED = "solved";
const MISSED = "miss";
const GAVE_UP = "given_up";

export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

export function utcDate(value: string | Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function lastDays(count: number, now: Date): string[] {
  const out: string[] = [];
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let back = count - 1; back >= 0; back -= 1) out.push(utcDate(new Date(base - back * 86_400_000)));
  return out;
}

export function computeGameMetrics(
  games: GameFact[],
  usage: UsageFact[],
  guesses: GuessFact[],
  now: Date = new Date(),
  dayCount = 14,
): GameMetrics {
  const byGame = new Map(games.map((game) => [game.id, game]));
  const isFinished = (status: string) => status === SOLVED || status === MISSED || status === GAVE_UP;
  const finishedIds = new Set(games.filter((game) => isFinished(game.status)).map((game) => game.id));

  const gameTokens = new Map<string, number>();
  const gameCost = new Map<string, number>();
  let ledgerCostUsd = 0;
  let ledgerTokens = 0;
  let failedRequests = 0;
  for (const row of usage) {
    const tokens = row.inputTokens + row.outputTokens;
    ledgerCostUsd += row.costUsd;
    ledgerTokens += tokens;
    if (row.failed) failedRequests += 1;
    if (row.gameId && byGame.has(row.gameId)) {
      gameTokens.set(row.gameId, (gameTokens.get(row.gameId) ?? 0) + tokens);
      gameCost.set(row.gameId, (gameCost.get(row.gameId) ?? 0) + row.costUsd);
    }
  }

  const solved = games.filter((game) => game.status === SOLVED).length;
  const missed = games.filter((game) => game.status === MISSED).length;
  const givenUp = games.filter((game) => game.status === GAVE_UP).length;
  const open = games.filter((game) => game.status === OPEN).length;
  const finished = finishedIds.size;

  const playedIds = games.filter((game) => game.messageCount > 0).map((game) => game.id);
  const sumOver = (ids: Iterable<string>, source: Map<string, number>) => {
    let total = 0;
    for (const id of ids) total += source.get(id) ?? 0;
    return total;
  };
  const finishedCost = sumOver(finishedIds, gameCost);
  const finishedTokens = sumOver(finishedIds, gameTokens);
  const finishedMessages = games.reduce((sum, game) => (isFinished(game.status) ? sum + game.messageCount : sum), 0);

  const guessesPerGame = new Map<string, number>();
  let correctGuesses = 0;
  for (const guess of guesses) {
    if (!byGame.has(guess.gameId)) continue;
    guessesPerGame.set(guess.gameId, (guessesPerGame.get(guess.gameId) ?? 0) + 1);
    if (guess.modelCorrect) correctGuesses += 1;
  }
  const totalGuesses = [...guessesPerGame.values()].reduce((sum, value) => sum + value, 0);

  return {
    games: games.length,
    open,
    finished,
    solved,
    missed,
    givenUp,
    solveRate: ratio(solved, finished),
    giveUpRate: ratio(givenUp, finished),
    guesses: totalGuesses,
    correctGuesses,
    guessAccuracy: ratio(correctGuesses, totalGuesses),
    guessesPerGame: ratio(totalGuesses, playedIds.length),
    messagesPerGame: ratio(finishedMessages, finished),
    tokensPerGame: ratio(finishedTokens, finished),
    costPerGame: ratio(finishedCost, finished),
    costPerSolvedGame: ratio(finishedCost, solved),
    ledgerCostUsd,
    ledgerTokens,
    ledgerRequests: usage.length,
    failedRequests,
    models: modelRows(games, usage),
    days: dayRows(games, lastDays(dayCount, now)),
  };

}

function modelRows(games: GameFact[], usage: UsageFact[]): ModelDifficulty[] {
  const rows = new Map<string, ModelDifficulty & { solvedMessages: number }>();
  const row = (modelId: string) => {
    let value = rows.get(modelId);
    if (!value) {
      value = {
        modelId,
        games: 0,
        finished: 0,
        solved: 0,
        solveRate: null,
        avgMessagesWhenSolved: null,
        requests: 0,
        failedRequests: 0,
        tokens: 0,
        costUsd: 0,
        costPerGame: null,
        solvedMessages: 0,
      };
      rows.set(modelId, value);
    }
    return value;
  };
  for (const game of games) {
    const value = row(game.modelId);
    value.games += 1;
    if (game.status === SOLVED || game.status === MISSED || game.status === GAVE_UP) value.finished += 1;
    if (game.status === SOLVED) {
      value.solved += 1;
      value.solvedMessages += game.messageCount;
    }
  }
  for (const entry of usage) {
    const value = row(entry.modelId);
    value.requests += 1;
    if (entry.failed) value.failedRequests += 1;
    value.tokens += entry.inputTokens + entry.outputTokens;
    value.costUsd += entry.costUsd;
  }
  return [...rows.values()]
    .map(({ solvedMessages, ...value }) => ({
      ...value,
      solveRate: ratio(value.solved, value.finished),
      avgMessagesWhenSolved: ratio(solvedMessages, value.solved),
      costPerGame: ratio(value.costUsd, value.games),
    }))
    .sort(compareDifficulty);
}

export type ModeRow = {
  id: string;
  name: string;
  games: number;
  open: number;
  finished: number;
  solved: number;
  solveRate: number | null;
  givenUp: number;
};

const finishedStatus = new Set([SOLVED, MISSED, GAVE_UP]);

export function modeRows(games: { category: string; status: string }[], categories: { id: string; name: string }[]): ModeRow[] {
  const ids = categories.map((category) => category.id);
  for (const game of games) {
    if (game.category && !ids.includes(game.category)) ids.push(game.category);
  }
  const names = new Map(categories.map((category) => [category.id, category.name]));
  return ids.map((id) => {
    const rows = games.filter((game) => game.category === id);
    const finished = rows.filter((game) => finishedStatus.has(game.status)).length;
    const solved = rows.filter((game) => game.status === SOLVED).length;
    return {
      id,
      name: names.get(id) ?? id,
      games: rows.length,
      open: rows.filter((game) => game.status === OPEN).length,
      finished,
      solved,
      solveRate: ratio(solved, finished),
      givenUp: rows.filter((game) => game.status === GAVE_UP).length,
    };
  });
}

export function compareDifficulty(a: ModelDifficulty, b: ModelDifficulty): number {
  if (a.solveRate === null && b.solveRate === null) return b.games - a.games || a.modelId.localeCompare(b.modelId);
  if (a.solveRate === null) return 1;
  if (b.solveRate === null) return -1;
  return a.solveRate - b.solveRate || b.finished - a.finished || a.modelId.localeCompare(b.modelId);
}

function dayRows(games: GameFact[], days: string[]): DayCount[] {
  const rows = new Map(days.map((date) => [date, { date, games: 0, solved: 0 }]));
  for (const game of games) {
    const row = rows.get(utcDate(game.startedAt));
    if (!row) continue;
    row.games += 1;
    if (game.status === SOLVED) row.solved += 1;
  }
  return days.map((date) => rows.get(date)!);
}

export function usd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  if (value === 0) return "$0.00";
  const abs = Math.abs(value);
  if (abs >= 100) return `$${value.toFixed(0)}`;
  if (abs >= 0.1) return `$${value.toFixed(2)}`;
  if (abs >= 0.01) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(4)}`;
}

export function percent(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(value === 1 || value === 0 ? 0 : 1)}%`;
}

export function compact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString("en-US");
}

export function decimal(value: number | null, digits = 1): string {
  return value === null ? "n/a" : value.toFixed(digits);
}
