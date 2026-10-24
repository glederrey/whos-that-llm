import { hintAllowedForMode } from "./game";
import { dayRows, hasFinishedAt, lastDays, utcDate, type DayCount } from "./admin-metrics";

const DAY = 86_400_000;
const SOLVED = "solved";
const MISSED = "miss";
const GAVE_UP = "given_up";
const OPEN = "active";
const hintKeys = ["year", "size", "origin", "company"] as const;

export type AdminGameFact = {
  id: string;
  /** Null for a guest or an account that was deleted. */
  userId: string | null;
  modelId: string;
  status: string;
  gameMode: string;
  startedAt: string;
  finishedAt: string | null;
  hints: string[];
  noHint: boolean;
};

export type AdminUsageFact = {
  gameId: string | null;
  modelId: string;
  costUsd: number;
  errorCode: string | null;
  createdAt: string;
};

export type AdminModelFact = { id: string; name: string; enabled: boolean; available: boolean };

export type AdminModeFact = { id: string; name: string };

export type PlayerDay = { date: string; newAccounts: number; activePlayers: number; games: number };

export type OpenRow = { id: string; name: string; fresh: number; week: number; stale: number };

export type DrawnRow = { modelId: string; name: string; games: number; lastDrawn: string | null };

export type FailureRow = {
  modelId: string;
  name: string;
  calls: number;
  failed: number;
  rate: number;
  lastFailure: string;
  topError: string;
};

export type ModeCostRow = { id: string; name: string; finished: number; spend: number; perGame: number | null };

export type HintUse = { hint: string; rounds: number; share: number | null };

export type AdminInsights = {
  /** Every game, in any mode, started per UTC day. A round still open is the rest of the bar. */
  days: DayCount[];
  playerDays: PlayerDay[];
  openRounds: OpenRow[];
  /** Every active model with how often it was drawn, most drawn first. */
  coverage: DrawnRow[];
  neverDrawn: number;
  failures: FailureRow[];
  modeCosts: ModeCostRow[];
  /** Every usage row: spend in a round and outside one, like the admin chat. */
  cost: { total: number };
  rounds: { label: string; players: number }[];
  players: number;
  returning: number;
  hints: { eligible: number; noHint: number; rows: HintUse[] };
};

export const failureLimit = 15;

const roundBuckets = [
  { label: "1", min: 1, max: 1 },
  { label: "2-5", min: 2, max: 5 },
  { label: "6-20", min: 6, max: 20 },
  { label: "21+", min: 21, max: Infinity },
];

export function computeAdminInsights(
  games: AdminGameFact[],
  usage: AdminUsageFact[],
  profileDates: string[],
  models: AdminModelFact[],
  modes: AdminModeFact[],
  now: Date = new Date(),
): AdminInsights {
  const names = new Map(models.map((model) => [model.id, model.name]));
  const finished = games.filter((game) => hasFinishedAt(game));
  const dates = lastDays(14, now);
  const mostRecent = (a: string | null, b: string) => (a === null || b > a ? b : a);

  const drawn = new Map<string, { games: number; last: string | null }>();
  for (const game of games) {
    const row = drawn.get(game.modelId) ?? { games: 0, last: null };
    row.games += 1;
    row.last = mostRecent(row.last, game.startedAt);
    drawn.set(game.modelId, row);
  }
  const enabled = models.filter((model) => model.enabled && model.available);
  const coverage: DrawnRow[] = enabled
    .map((model) => ({
      modelId: model.id,
      name: model.name,
      games: drawn.get(model.id)?.games ?? 0,
      lastDrawn: drawn.get(model.id)?.last ?? null,
    }))
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));

  const byModel = new Map<string, { calls: number; failed: number; last: string; errors: Map<string, number> }>();
  for (const row of usage) {
    const entry = byModel.get(row.modelId) ?? { calls: 0, failed: 0, last: "", errors: new Map() };
    entry.calls += 1;
    if (row.errorCode !== null) {
      entry.failed += 1;
      if (row.createdAt > entry.last) entry.last = row.createdAt;
      entry.errors.set(row.errorCode, (entry.errors.get(row.errorCode) ?? 0) + 1);
    }
    byModel.set(row.modelId, entry);
  }
  const failures: FailureRow[] = [...byModel.entries()]
    .filter(([, entry]) => entry.failed > 0)
    .map(([modelId, entry]) => ({
      modelId,
      name: names.get(modelId) ?? modelId,
      calls: entry.calls,
      failed: entry.failed,
      rate: entry.failed / entry.calls,
      lastFailure: entry.last,
      topError: [...entry.errors.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
    }))
    .sort((a, b) => b.failed - a.failed || b.rate - a.rate || a.name.localeCompare(b.name))
    .slice(0, failureLimit);

  const modeOf = new Map(games.map((game) => [game.id, game.gameMode]));
  const spend = new Map<string, number>();
  for (const row of usage) {
    const mode = row.gameId ? modeOf.get(row.gameId) : undefined;
    if (mode) spend.set(mode, (spend.get(mode) ?? 0) + row.costUsd);
  }
  const modeIds = modes.map((mode) => mode.id);
  for (const game of games) if (!modeIds.includes(game.gameMode)) modeIds.push(game.gameMode);
  const modeNames = new Map(modes.map((mode) => [mode.id, mode.name]));
  const modeCosts: ModeCostRow[] = modeIds.map((id) => {
    const done = finished.filter((game) => game.gameMode === id).length;
    const total = spend.get(id) ?? 0;
    return { id, name: modeNames.get(id) ?? id, finished: done, spend: total, perGame: done > 0 ? total / done : null };
  });

  const openRounds: OpenRow[] = modeIds.map((id) => {
    const rows = games.filter((game) => game.gameMode === id && game.status === OPEN);
    const age = (game: AdminGameFact) => now.getTime() - new Date(game.startedAt).getTime();
    return {
      id,
      name: modeNames.get(id) ?? id,
      fresh: rows.filter((game) => age(game) < DAY).length,
      week: rows.filter((game) => age(game) >= DAY && age(game) < 7 * DAY).length,
      stale: rows.filter((game) => age(game) >= 7 * DAY).length,
    };
  });

  const playerDays: PlayerDay[] = dates.map((date) => {
    const day = games.filter((game) => utcDate(game.startedAt) === date);
    return {
      date,
      newAccounts: profileDates.filter((created) => utcDate(created) === date).length,
      activePlayers: new Set(day.flatMap((game) => (game.userId ? [game.userId] : []))).size,
      games: day.length,
    };
  });

  const finishedBy = new Map<string, number>();
  const daysBy = new Map<string, Set<string>>();
  for (const game of games) {
    if (!game.userId || !hasFinishedAt(game)) continue;
    const seen = daysBy.get(game.userId) ?? new Set<string>();
    seen.add(utcDate(game.startedAt));
    daysBy.set(game.userId, seen);
    finishedBy.set(game.userId, (finishedBy.get(game.userId) ?? 0) + 1);
  }
  const counts = [...finishedBy.values()];

  // A mode with no hints (Origin) is not in the share, and Company only sells the year and the size.
  const eligible = games.filter((game) => hintAllowedForMode(game.gameMode, "year"));
  const noHint = eligible.filter((game) => game.noHint).length;

  return {
    days: dayRows(games, dates),
    playerDays,
    openRounds,
    coverage,
    neverDrawn: coverage.filter((row) => row.games === 0).length,
    failures,
    modeCosts,
    cost: { total: usage.reduce((sum, row) => sum + row.costUsd, 0) },
    rounds: roundBuckets.map((bucket) => ({
      label: bucket.label,
      players: counts.filter((count) => count >= bucket.min && count <= bucket.max).length,
    })),
    players: counts.length,
    returning: [...daysBy.values()].filter((seen) => seen.size >= 2).length,
    hints: {
      eligible: eligible.length,
      noHint,
      rows: hintKeys.map((hint) => {
        const sold = eligible.filter((game) => !game.noHint && hintAllowedForMode(game.gameMode, hint));
        const rounds = sold.filter((game) => game.hints.includes(hint)).length;
        return { hint, rounds, share: sold.length > 0 ? rounds / sold.length : null };
      }),
    },
  };
}
