import assert from "node:assert/strict";
import test from "node:test";
import { computeGameMetrics, percent, reasoningRows, usd, type GameFact, type UsageFact } from "./admin-metrics";
import { modeRows } from "./mode-rows";

const now = new Date("2026-10-10T12:00:00Z");

function game(id: string, modelId: string, status: string, messageCount: number, day = "2026-10-10"): GameFact {
  const finished = status === "solved" || status === "miss" || status === "given_up";
  return {
    id,
    modelId,
    status,
    messageCount,
    startedAt: `${day}T08:00:00Z`,
    finishedAt: finished ? `${day}T09:00:00Z` : null,
  };
}

function use(gameId: string, modelId: string, tokens: number, cost: number, failed = false): UsageFact {
  return { gameId, modelId, inputTokens: tokens - 10, outputTokens: 10, reasoningTokens: 0, costUsd: cost, failed };
}

test("rates use finished games and cost follows the ledger", () => {
  const games = [
    game("1", "m1", "solved", 3),
    game("2", "m1", "miss", 10, "2026-10-09"),
    game("3", "m2", "given_up", 2, "2026-10-09"),
    game("4", "m2", "solved", 5),
    game("5", "m2", "active", 1),
  ];
  const usage = [
    use("1", "m1", 100, 0.1),
    use("2", "m1", 300, 0.3),
    use("3", "m2", 100, 0.1),
    use("4", "m2", 200, 0.4),
    use("5", "m2", 50, 0.05),
    use("5", "m2", 0, 0, true),
  ];
  const guesses = [
    { gameId: "1", modelCorrect: true },
    { gameId: "2", modelCorrect: false },
    { gameId: "2", modelCorrect: false },
    { gameId: "4", modelCorrect: true },
    { gameId: "5", modelCorrect: true },
    { gameId: "gone", modelCorrect: true },
  ];
  const metrics = computeGameMetrics(games, usage, guesses, now, 3);
  assert.equal(metrics.finished, 4);
  assert.equal(metrics.solved, 2);
  assert.equal(metrics.solveRate, 0.5);
  assert.equal(metrics.giveUpRate, 0.25);
  assert.equal(metrics.open, 1);
  assert.equal(metrics.guesses, 4);
  assert.equal(metrics.correctGuesses, 2);
  assert.equal(metrics.guessAccuracy, 0.5);
  assert.equal(metrics.guessesPerGame, 1);
  assert.equal(metrics.unfinished, 1);
  assert.equal(metrics.unfinishedRate, 0.2);
  assert.equal(metrics.messagesPerGame, 5);
  assert.equal(metrics.tokensPerGame, 175);
  assert.ok(Math.abs((metrics.costPerGame ?? 0) - 0.225) < 1e-9);
  assert.ok(Math.abs((metrics.costPerSolvedGame ?? 0) - 0.45) < 1e-9);
  assert.equal(metrics.failedRequests, 1);
  assert.equal(metrics.ledgerRequests, 6);
  assert.deepEqual(metrics.days, [
    { date: "2026-10-08", games: 0, solved: 0, missed: 0, givenUp: 0 },
    { date: "2026-10-09", games: 2, solved: 0, missed: 1, givenUp: 1 },
    { date: "2026-10-10", games: 3, solved: 2, missed: 0, givenUp: 0 },
  ]);
  assert.deepEqual(metrics.models.map((row) => row.modelId), ["m1", "m2"]);
  assert.equal(metrics.models[0].solveRate, 0.5);
  assert.equal(metrics.models[1].solveRate, 0.5);
  assert.equal(metrics.models[1].avgMessagesWhenSolved, 5);
  assert.equal(metrics.models[1].failedRequests, 1);
});

test("an empty database gives n/a, not NaN", () => {
  const metrics = computeGameMetrics([], [], [], now, 2);
  assert.equal(metrics.solveRate, null);
  assert.equal(metrics.costPerSolvedGame, null);
  assert.equal(percent(metrics.solveRate), "n/a");
  assert.equal(metrics.models.length, 0);
});

test("mode rows keep every game mode, including ones with no games", () => {
  const rows = modeRows(
    [
      { gameMode: "all", status: "solved" },
      { gameMode: "all", status: "given_up" },
      { gameMode: "all", status: "active" },
      { gameMode: "custom", status: "miss" },
      { gameMode: "retired", status: "solved" },
    ],
    [
      { id: "daily", name: "Daily" },
      { id: "all", name: "All models" },
      { id: "custom", name: "Custom" },
    ],
  );
  assert.deepEqual(
    rows.map((row) => [row.id, row.games, row.solved, row.givenUp, row.open, row.solveRate]),
    [
      ["daily", 0, 0, 0, 0, null],
      ["all", 3, 1, 1, 1, 0.5],
      ["custom", 1, 0, 0, 0, 0],
      ["retired", 1, 1, 0, 0, 1],
    ],
  );
});

test("money prints with enough digits for cents of a cent", () => {
  assert.equal(usd(0), "$0.00");
  assert.equal(usd(12.345), "$12.35");
  assert.equal(usd(0.0123), "$0.012");
  assert.equal(usd(0.00123), "$0.0012");
  assert.equal(usd(null), "n/a");
});

test("reasoning rows skip failures and silent models, highest average first", () => {
  const think = (modelId: string, reasoning: number, output: number, failed = false): UsageFact => ({
    gameId: "g",
    modelId,
    inputTokens: 100,
    outputTokens: output,
    reasoningTokens: reasoning,
    costUsd: 0,
    failed,
  });
  const rows = reasoningRows([
    think("a", 100, 200),
    think("a", 300, 400),
    think("a", 5000, 5000, true),
    think("b", 1000, 1500),
    think("c", 0, 50),
  ]);
  assert.deepEqual(
    rows.map((row) => [row.modelId, row.requests, row.avgReasoningTokens, row.maxReasoningTokens]),
    [
      ["b", 1, 1000, 1000],
      ["a", 2, 200, 300],
    ],
  );
  assert.equal(rows[1].share, 400 / 600);
});
