import assert from "node:assert/strict";
import test from "node:test";
import { computeAdminInsights, type AdminGameFact, type AdminUsageFact } from "./admin-insights";

const now = new Date("2026-10-10T12:00:00Z");

function game(over: Partial<AdminGameFact>): AdminGameFact {
  return {
    id: "g",
    userId: "u1",
    modelId: "m1",
    status: "solved",
    gameMode: "all",
    startedAt: "2026-10-10T08:00:00Z",
    finishedAt: "2026-10-10T08:05:00Z",
    hints: [],
    noHint: false,
    ...over,
  };
}

function usage(over: Partial<AdminUsageFact>): AdminUsageFact {
  return { gameId: "g1", modelId: "m1", costUsd: 0.1, errorCode: null, createdAt: "2026-10-10T08:00:00Z", ...over };
}

const models = [
  { id: "m1", name: "One", enabled: true, available: true },
  { id: "m2", name: "Two", enabled: true, available: true },
  { id: "m4", name: "Four", enabled: true, available: false },
  { id: "m3", name: "Three", enabled: false, available: true },
];
const modes = [
  { id: "all", name: "All models" },
  { id: "origin", name: "Origin" },
];

test("open rounds are bucketed by age and the chart splits the three outcomes", () => {
  const games = [
    game({ id: "g1", status: "active", finishedAt: null, startedAt: "2026-10-10T06:00:00Z" }),
    game({ id: "g2", status: "active", finishedAt: null, startedAt: "2026-10-07T06:00:00Z" }),
    game({ id: "g3", status: "active", finishedAt: null, startedAt: "2026-09-20T06:00:00Z" }),
    game({ id: "g4", status: "miss" }),
    game({ id: "g5", status: "given_up" }),
  ];
  const result = computeAdminInsights(games, [], [], models, modes, now);
  assert.deepEqual(result.openRounds[0], { id: "all", name: "All models", fresh: 1, week: 1, stale: 1 });
  const today = result.days[result.days.length - 1];
  assert.equal(today.missed, 1);
  assert.equal(today.givenUp, 1);
});

test("players per day counts new accounts, active players and games", () => {
  const games = [
    game({ id: "g1", userId: "u1" }),
    game({ id: "g2", userId: "u1" }),
    game({ id: "g3", userId: null }),
  ];
  const result = computeAdminInsights(games, [], ["2026-10-10T01:00:00Z", "2026-10-01T01:00:00Z"], models, modes, now);
  const today = result.playerDays[result.playerDays.length - 1];
  assert.deepEqual(today, { date: "2026-10-10", newAccounts: 1, activePlayers: 1, games: 3 });
});

test("rounds per player buckets finished games and counts returning players", () => {
  const games = [
    game({ id: "g1", userId: "u1" }),
    game({ id: "g2", userId: "u1", startedAt: "2026-10-09T08:00:00Z", finishedAt: "2026-10-09T08:05:00Z" }),
    game({ id: "g3", userId: "u2" }),
  ];
  const result = computeAdminInsights(games, [], [], models, modes, now);
  assert.equal(result.players, 2);
  assert.equal(result.returning, 1);
  assert.deepEqual(result.rounds, [
    { label: "1", players: 1 },
    { label: "2-5", players: 1 },
    { label: "6-20", players: 0 },
    { label: "21+", players: 0 },
  ]);
});

test("roster coverage lists active models, most drawn first, and counts the never drawn", () => {
  const result = computeAdminInsights([game({ id: "g1", modelId: "m1" })], [], [], models, modes, now);
  assert.deepEqual(
    result.coverage.map((row) => [row.modelId, row.games]),
    [
      ["m1", 1],
      ["m2", 0],
    ],
  );
  assert.equal(result.neverDrawn, 1);
});

test("failed calls and cost per mode come from the ledger", () => {
  const games = [game({ id: "g1" }), game({ id: "g2", gameMode: "origin" })];
  const rows = [
    usage({ gameId: "g1", costUsd: 0.2 }),
    usage({ gameId: "g1", errorCode: "429", createdAt: "2026-10-09T08:00:00Z" }),
    usage({ gameId: "g1", errorCode: "429", createdAt: "2026-10-10T09:00:00Z" }),
    usage({ gameId: "g2", costUsd: 0.5 }),
    usage({ gameId: null, costUsd: 9 }),
  ];
  const result = computeAdminInsights(games, rows, [], models, modes, now);
  assert.deepEqual(result.failures, [
    { modelId: "m1", name: "One", calls: 5, failed: 2, rate: 0.4, lastFailure: "2026-10-10T09:00:00Z", topError: "429" },
  ]);
  const byMode = Object.fromEntries(result.modeCosts.map((row) => [row.id, row]));
  assert.ok(Math.abs(byMode.all.spend - 0.4) < 1e-9);
  assert.equal(byMode.origin.spend, 0.5);
  assert.equal(byMode.origin.perGame, 0.5);
  assert.ok(result.cost.total >= 9.7, "the total includes a call outside any round");
});

test("hint use leaves out Origin and the no-hint rounds, and reports their count", () => {
  const games = [
    game({ id: "g1", hints: ["year", "size"] }),
    game({ id: "g2", hints: [] }),
    game({ id: "g3", noHint: true }),
    game({ id: "g4", gameMode: "origin" }),
    game({ id: "g5", gameMode: "company", hints: ["year"] }),
  ];
  const result = computeAdminInsights(games, [], [], models, modes, now);
  assert.equal(result.hints.eligible, 4);
  assert.equal(result.hints.noHint, 1);
  assert.deepEqual(result.hints.rows[0], { hint: "year", rounds: 2, share: 2 / 3 });
  assert.deepEqual(result.hints.rows[2], { hint: "origin", rounds: 0, share: 0 });
});
