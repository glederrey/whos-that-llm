import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { computePublicStats, statisticModes, type PublicGameFact, type PublicGuessFact, type PublicUsageFact } from "./public-stats";

const now = new Date("2026-10-10T12:00:00Z");
const root = path.resolve(import.meta.dirname, "..");

function game(
  id: string,
  modelId: string,
  status: string,
  messageCount: number,
  extra: Partial<PublicGameFact> = {},
): PublicGameFact {
  return {
    id,
    modelId,
    status,
    messageCount,
    startedAt: "2026-10-10T08:00:00Z",
    finishedAt: status === "solved" || status === "miss" || status === "given_up" ? "2026-10-10T09:00:00Z" : null,
    gameMode: "all",
    size: "small",
    origin: "us",
    poolKey: null,
    difficulty: null,
    noHint: false,
    score: null,
    ...extra,
  };
}

test("public stats keep outcomes and drop cost", () => {
  const games = [
    game("1", "opus", "solved", 3, { size: "large", origin: "us" }),
    game("2", "opus", "miss", 10, { size: "large", origin: "us", startedAt: "2026-10-09T08:00:00Z" }),
    game("3", "haiku", "given_up", 2, { size: "small", origin: "eu", gameMode: "daily" }),
    game("4", "haiku", "solved", 4, { size: "small", origin: "cn" }),
    game("5", "secret", "active", 1, { size: "medium", origin: "cn", gameMode: "company" }),
  ];
  const usage: PublicUsageFact[] = [
    { gameId: "1", modelId: "opus", inputTokens: 80, outputTokens: 20 },
    { gameId: "2", modelId: "opus", inputTokens: 200, outputTokens: 50 },
    { gameId: "4", modelId: "haiku", inputTokens: 40, outputTokens: 10 },
    { gameId: "5", modelId: "secret", inputTokens: 90, outputTokens: 10 },
    { gameId: null, modelId: "secret", inputTokens: 500, outputTokens: 500 },
  ];
  const guesses: PublicGuessFact[] = [
    { gameId: "1", modelCorrect: false, guessedModelId: "sonnet", guessedOrigin: null, originCorrect: true },
    { gameId: "1", modelCorrect: true, guessedModelId: "opus", guessedOrigin: null, originCorrect: true },
    { gameId: "2", modelCorrect: false, guessedModelId: "sonnet", guessedOrigin: null, originCorrect: false },
    { gameId: "2", modelCorrect: false, guessedModelId: "sonnet", guessedOrigin: null, originCorrect: true },
    { gameId: "4", modelCorrect: true, guessedModelId: "haiku", guessedOrigin: null, originCorrect: true },
    { gameId: "5", modelCorrect: false, guessedModelId: "opus", guessedOrigin: null, originCorrect: false },
    { gameId: "missing", modelCorrect: false, guessedModelId: "opus", guessedOrigin: null, originCorrect: true },
  ];
  const stats = computePublicStats(
    games,
    usage,
    guesses,
    [
      { id: "daily", name: "Daily" },
      { id: "all", name: "All models" },
      { id: "company", name: "Company" },
      { id: "custom", name: "Custom" },
    ],
    {},
    now,
  );

  assert.equal(stats.outcome.finished, 4);
  assert.equal(stats.outcome.solved, 2);
  assert.equal(stats.outcome.solveRate, 0.5);
  assert.equal(stats.outcome.open, 0);
  assert.equal(stats.days.find((day) => day.date === "2026-10-10")?.games, 3);
  assert.equal(stats.days.find((day) => day.date === "2026-10-10")?.solved, 2);
  assert.equal(stats.outcome.messagesPerGame, (3 + 10 + 2 + 4) / 4);
  assert.equal(stats.outcome.tokensPerGame, (100 + 250 + 50) / 4);
  assert.equal(stats.outcome.originFoundRate, 0.75);
  assert.equal(JSON.stringify(stats).includes("cost"), false);
  assert.equal(JSON.stringify(stats).includes("usd"), false);
  assert.equal(JSON.stringify(stats).includes("secret"), false);

  assert.deepEqual(stats.models.map((row) => row.modelId).sort(), ["haiku", "opus"]);
  assert.equal(stats.models.find((row) => row.modelId === "opus")?.tokens, 350);
  assert.equal(stats.confusion.length, 1);
  assert.equal(stats.confusion[0].count, 3);
  assert.deepEqual(
    stats.sizes.map((row) => row.key),
    ["nano", "small", "medium", "large", "xxl"],
  );
  assert.equal(stats.sizes[1].finished, 1);
  assert.equal(stats.sizes[2].finished, 0);
  assert.equal(stats.sizes[2].solveRate, null);
  assert.equal(stats.sizes[3].solveRate, 0.5);
  assert.equal(stats.origins.find((row) => row.key === "eu")?.finished, 0);
  assert.equal(stats.origins.find((row) => row.key === "cn")?.games, 1);

  assert.deepEqual(
    stats.gameModes.map((row) => row.id),
    ["daily", "all", "company", "custom"],
  );
  assert.equal(stats.gameModes[0].finished, 1);
  assert.equal(stats.gameModes[1].outcome?.solveRate, 2 / 3);
  assert.equal(stats.gameModes[2].outcome, null);
  assert.equal(stats.gameModes[2].open, 0);
  assert.equal(stats.gameModes[2].games, 0);
  assert.equal(stats.gameModes[2].models.length, 0);
  assert.equal(stats.gameModes[3].finished, 0);
  assert.equal(stats.gameModes[3].outcome, null);
});

test("an empty game mode list does not invent rows", () => {
  const stats = computePublicStats([], [], [], [], {}, now);
  assert.equal(stats.outcome.solveRate, null);
  assert.equal(stats.outcome.tokensPerGame, null);
  assert.equal(stats.models.length, 0);
  assert.equal(stats.confusion.length, 0);
  assert.equal(stats.gameModes.length, 0);
  assert.equal(stats.categories.length, 0);
  assert.equal(stats.sizes.every((row) => row.solveRate === null && row.games === 0), true);
});

test("a finished game mode outside the list is still shown", () => {
  const stats = computePublicStats(
    [game("1", "opus", "solved", 2, { gameMode: "custom", size: "medium", origin: "eu" })],
    [],
    [],
    [{ id: "all", name: "All models" }],
    {},
    now,
  );
  assert.deepEqual(
    stats.gameModes.map((row) => [row.id, row.finished]),
    [
      ["all", 0],
      ["custom", 1],
    ],
  );
  assert.equal(stats.sizes.find((row) => row.key === "unknown"), undefined);
});

test("Category and Company tables count the rounds played on each pool, not the hidden model's traits", () => {
  const stats = computePublicStats(
    [
      game("1", "opus", "solved", 2, { gameMode: "class", poolKey: "opus", score: 800 }),
      game("2", "haiku", "miss", 4, { gameMode: "class", poolKey: "haiku", score: 100 }),
      game("3", "luna", "solved", 1, { gameMode: "all", poolKey: null }),
      game("4", "opus", "solved", 3, { gameMode: "company", poolKey: "anthropic", score: 600 }),
    ],
    [],
    [],
    [],
    {
      categories: [
        { id: "empty", name: "Empty" },
        { id: "opus", name: "Opus" },
        { id: "haiku", name: "Haiku" },
      ],
      companies: [{ id: "anthropic", name: "Anthropic" }],
    },
    now,
  );
  assert.deepEqual(
    stats.categories.map((row) => [row.name, row.games, row.solveRate, row.avgScore]),
    [
      ["Empty", 0, null, null],
      ["Haiku", 1, 0, 100],
      ["Opus", 1, 1, 800],
    ],
  );
  assert.deepEqual(
    stats.companies.map((row) => [row.name, row.games, row.avgScore]),
    [["Anthropic", 1, 600]],
  );
});

test("difficulty and hint rows split the rounds, and the score figures follow the rounds that have one", () => {
  const stats = computePublicStats(
    [
      game("1", "opus", "solved", 2, { difficulty: 1, score: 900 }),
      game("2", "opus", "miss", 4, { difficulty: 1, score: 0 }),
      game("3", "haiku", "solved", 3, { difficulty: 3, noHint: true, score: 1500 }),
      game("4", "haiku", "given_up", 1, { gameMode: "company", poolKey: "x" }),
    ],
    [],
    [],
    [],
    {},
    now,
  );
  assert.deepEqual(
    stats.difficulties.map((row) => [row.key, row.games, row.solveRate]),
    [
      ["1", 2, 0.5],
      ["2", 0, null],
      ["3", 1, 1],
      ["4", 0, null],
    ],
  );
  assert.deepEqual(
    stats.hints.map((row) => [row.key, row.games, row.avgScore]),
    [
      ["hints", 3, 450],
      ["no-hints", 1, 1500],
    ],
  );
  assert.equal(stats.outcome.avgScore, 800);
  assert.equal(stats.outcome.bestScore, 1500);
  assert.equal(stats.gameModes.find((row) => row.id === "company")?.difficulties.length, 0);
});

test("a solved round with no finished_at does not count", () => {
  const stats = computePublicStats(
    [
      game("done", "opus", "solved", 2),
      game("stale", "haiku", "solved", 8, { finishedAt: null, gameMode: "daily" }),
      game("open", "secret", "active", 5, { finishedAt: null }),
    ],
    [
      { gameId: "done", modelId: "opus", inputTokens: 10, outputTokens: 10 },
      { gameId: "stale", modelId: "haiku", inputTokens: 40, outputTokens: 10 },
      { gameId: "open", modelId: "secret", inputTokens: 80, outputTokens: 20 },
    ],
    [
      { gameId: "done", modelCorrect: true, guessedModelId: "opus", guessedOrigin: null, originCorrect: true },
      { gameId: "stale", modelCorrect: true, guessedModelId: "haiku", guessedOrigin: null, originCorrect: true },
      { gameId: "open", modelCorrect: false, guessedModelId: "opus", guessedOrigin: null, originCorrect: true },
    ],
    [
      { id: "all", name: "All models" },
      { id: "daily", name: "Daily" },
    ],
    {},
    now,
  );
  assert.equal(stats.outcome.finished, 1);
  assert.equal(stats.outcome.solved, 1);
  assert.equal(stats.outcome.open, 0);
  assert.equal(stats.outcome.guesses, 1);
  assert.equal(stats.outcome.tokensPerGame, 20);
  assert.equal(stats.outcome.messagesPerGame, 2);
  assert.equal(stats.days.find((day) => day.date === "2026-10-10")?.games, 1);
  assert.equal(stats.models.length, 1);
  assert.equal(stats.gameModes.find((row) => row.id === "daily")?.finished, 0);
  assert.equal(JSON.stringify(stats).includes("haiku"), false);
  assert.equal(JSON.stringify(stats).includes("secret"), false);
});

test("today's Daily rounds stay in the totals and leave the named breakdowns", () => {
  const today = "2026-10-12";
  const clock = new Date(`${today}T18:00:00Z`);
  const stats = computePublicStats(
    [
      game("daily-today", "grok", "solved", 3, {
        gameMode: "daily",
        size: "xxl",
        origin: "us",
        startedAt: `${today}T08:00:00Z`,
        finishedAt: `${today}T09:00:00Z`,
      }),
      game("daily-today-medium", "kimi", "miss", 6, {
        gameMode: "daily",
        size: "medium",
        origin: "cn",
        startedAt: `${today}T00:05:00Z`,
        finishedAt: `${today}T01:00:00Z`,
      }),
      game("daily-yesterday", "opus", "miss", 5, {
        gameMode: "daily",
        size: "large",
        origin: "eu",
        startedAt: "2026-10-11T23:30:00Z",
        finishedAt: "2026-10-11T23:50:00Z",
      }),
      game("all-today", "haiku", "solved", 2, {
        gameMode: "all",
        size: "small",
        origin: "eu",
        startedAt: `${today}T10:00:00Z`,
        finishedAt: `${today}T11:00:00Z`,
      }),
    ],
    [{ gameId: "daily-today", modelId: "grok", inputTokens: 40, outputTokens: 10 }],
    [
      { gameId: "daily-today", modelCorrect: false, guessedModelId: "sonnet", guessedOrigin: null, originCorrect: true },
      { gameId: "daily-today-medium", modelCorrect: false, guessedModelId: "opus", guessedOrigin: null, originCorrect: false },
      { gameId: "daily-yesterday", modelCorrect: false, guessedModelId: "sonnet", guessedOrigin: null, originCorrect: false },
      { gameId: "all-today", modelCorrect: false, guessedModelId: "opus", guessedOrigin: null, originCorrect: true },
    ],
    [
      { id: "daily", name: "Daily" },
      { id: "all", name: "All models" },
      { id: "company", name: "Company" },
    ],
    {},
    clock,
  );

  assert.equal(stats.outcome.finished, 4);
  assert.equal(stats.outcome.solved, 2);
  assert.equal(stats.outcome.guesses, 4);
  assert.equal(stats.outcome.tokensPerGame, 50 / 4);
  assert.equal(stats.days.find((day) => day.date === today)?.games, 3);
  assert.equal(stats.days.find((day) => day.date === today)?.solved, 2);
  assert.equal(stats.days.find((day) => day.date === "2026-10-11")?.games, 1);

  assert.deepEqual(stats.models.map((row) => row.modelId).sort(), ["haiku", "opus"]);
  assert.equal(JSON.stringify(stats.models).includes("grok"), false);
  assert.equal(JSON.stringify(stats.models).includes("kimi"), false);
  assert.deepEqual(
    stats.confusion.map((row) => [row.hiddenModelId, row.guessedModelId, row.count]),
    [
      ["haiku", "opus", 1],
      ["opus", "sonnet", 1],
    ],
  );
  assert.equal(stats.sizes.find((row) => row.key === "xxl")?.games, 0);
  assert.equal(stats.sizes.find((row) => row.key === "medium")?.games, 0);
  assert.equal(stats.sizes.find((row) => row.key === "large")?.games, 1);
  assert.equal(stats.sizes.find((row) => row.key === "small")?.games, 1);
  assert.equal(stats.origins.find((row) => row.key === "us")?.games, 0);
  assert.equal(stats.origins.find((row) => row.key === "cn")?.games, 0);
  assert.equal(stats.origins.find((row) => row.key === "eu")?.games, 2);
  const daily = stats.gameModes.find((row) => row.id === "daily");
  assert.equal(daily?.finished, 3);
  assert.equal(daily?.outcome?.solved, 1);
  assert.equal(daily?.days.find((day) => day.date === today)?.games, 2);
  assert.deepEqual(daily?.models.map((row) => row.modelId), ["opus"]);
  assert.deepEqual(
    daily?.confusion.map((row) => [row.hiddenModelId, row.guessedModelId]),
    [["opus", "sonnet"]],
  );
  assert.equal(daily?.sizes.find((row) => row.key === "xxl")?.games, 0);
  assert.equal(daily?.sizes.find((row) => row.key === "large")?.games, 1);
  assert.equal(daily?.origins.find((row) => row.key === "us")?.games, 0);
  assert.equal(daily?.origins.find((row) => row.key === "eu")?.games, 1);

  const all = stats.gameModes.find((row) => row.id === "all");
  assert.equal(all?.finished, 1);
  assert.equal(all?.days.find((day) => day.date === today)?.games, 1);
  assert.deepEqual(all?.models.map((row) => row.modelId), ["haiku"]);
  assert.deepEqual(
    all?.confusion.map((row) => [row.hiddenModelId, row.guessedModelId]),
    [["haiku", "opus"]],
  );
  assert.equal(all?.sizes.find((row) => row.key === "small")?.games, 1);
  assert.equal(all?.origins.find((row) => row.key === "eu")?.games, 1);
});

test("Every mode button can be selected", () => {
  assert.deepEqual(
    statisticModes.map((mode) => [mode.name, mode.enabled]),
    [
      ["All modes", true],
      ["Daily", true],
      ["All models", true],
      ["Company", true],
      ["Category", true],
      ["Origin", true],
      ["Custom", true],
    ],
  );
});

test("Origin rounds get their own pick table and count in the all-modes figures but not in its model tables", () => {
  const stats = computePublicStats(
    [
      game("o1", "opus", "solved", 4, { gameMode: "origin", origin: "us" }),
      game("o2", "opus", "miss", 10, { gameMode: "origin", origin: "us" }),
      game("o3", "kimi", "given_up", 3, { gameMode: "origin", origin: "cn" }),
      game("o4", "kimi", "miss", 10, { gameMode: "origin", origin: "latam" }),
      game("a1", "haiku", "solved", 2),
    ],
    [],
    [
      { gameId: "o1", modelCorrect: true, guessedModelId: null, guessedOrigin: "us", originCorrect: true },
      { gameId: "o2", modelCorrect: false, guessedModelId: null, guessedOrigin: "eu", originCorrect: false },
      { gameId: "o4", modelCorrect: false, guessedModelId: null, guessedOrigin: "us", originCorrect: false },
    ],
    [{ id: "all", name: "All models" }, { id: "origin", name: "Origin" }],
    {},
    now,
  );
  assert.equal(stats.outcome.games, 5);
  assert.equal(stats.outcome.missed, 2);
  assert.equal(stats.outcome.givenUp, 1);
  assert.equal(stats.days.reduce((sum, day) => sum + day.missed, 0), 2);
  assert.deepEqual(stats.models.map((row) => row.modelId), ["haiku"]);
  assert.deepEqual(stats.hints.map((row) => row.games), [1, 0]);
  const report = stats.gameModes.find((mode) => mode.id === "origin");
  assert.equal(report?.games, 4);
  assert.deepEqual(report?.confusion, []);
  const rows = report?.originPicks ?? [];
  assert.deepEqual(rows.map((row) => row.origin), ["us", "cn", "eu", "latam"]);
  assert.equal(rows[0].foundRate, 0.5);
  assert.deepEqual(rows[0].picks, [{ origin: "eu", count: 1 }, { origin: "us", count: 1 }]);
  assert.equal(rows[1].givenUp, 1);
  assert.deepEqual(rows[1].picks, []);
  assert.equal(rows[3].games, 1);
});

test("Custom rounds get their own tab and count in the all-modes figures", () => {
  const stats = computePublicStats(
    [
      game("c1", "opus", "solved", 4, { gameMode: "custom" }),
      game("c2", "opus", "miss", 10, { gameMode: "custom" }),
      game("a1", "haiku", "solved", 2),
    ],
    [],
    [],
    [{ id: "all", name: "All models" }, { id: "custom", name: "Custom" }],
    {},
    now,
  );
  assert.equal(stats.outcome.games, 3);
  assert.deepEqual(stats.models.map((row) => row.modelId).sort(), ["haiku", "opus"]);
  assert.deepEqual(stats.hints.map((row) => row.games), [3, 0]);
  assert.equal(stats.gameModes.find((mode) => mode.id === "custom")?.games, 2);
});

test("Custom rounds report pool sizes and the most picked models", () => {
  const stats = computePublicStats(
    [
      game("c1", "opus", "solved", 4, { gameMode: "custom", poolModelIds: ["opus", "haiku"] }),
      game("c2", "opus", "miss", 10, { gameMode: "custom", poolModelIds: ["opus", "haiku", "kimi", "gpt", "grok", "llama"] }),
      game("c3", "kimi", "solved", 3, { gameMode: "custom", poolModelIds: ["kimi", "opus"] }),
      game("c4", "kimi", "solved", 3, { gameMode: "custom" }),
    ],
    [],
    [],
    [{ id: "all", name: "All models" }, { id: "custom", name: "Custom" }],
    {},
    now,
  );
  const custom = stats.gameModes.find((mode) => mode.id === "custom")?.custom;
  assert.equal(custom?.avgModels, (2 + 6 + 2) / 3);
  assert.deepEqual(
    custom?.sizes.map((bucket) => [bucket.label, bucket.rounds]),
    [["2", 2], ["3-5", 0], ["6-10", 1], ["11-20", 0], ["21-50", 0], ["51+", 0]],
  );
  assert.deepEqual(custom?.picked.slice(0, 2).map((row) => [row.modelId, row.rounds]), [["opus", 3], ["haiku", 2]]);
  assert.equal(custom?.picked[0].share, 3 / 3);
  assert.equal(stats.gameModes.find((mode) => mode.id === "all")?.custom ?? null, null);
});

test("the public stats page does not read prices, billing, or account rows", () => {
  const loader = fs.readFileSync(path.join(root, "lib/public-stats-data.ts"), "utf8");
  const page = fs.readFileSync(path.join(root, "app/statistics/page.tsx"), "utf8");
  const board = fs.readFileSync(path.join(root, "components/statistics-board.tsx"), "utf8");
  const why = fs.readFileSync(path.join(root, "app/why/page.tsx"), "utf8");
  for (const banned of ["cost_usd", "openrouter", "price", "requireOwner", "user_id", "username", "content", "usd("]) {
    assert.equal(loader.toLowerCase().includes(banned), false, banned);
    assert.equal(page.toLowerCase().includes(banned), false, banned);
    assert.equal(board.toLowerCase().includes(banned), false, banned);
  }
  assert.match(why, /Over time I think I could tell an Opus 4.5 from a 4.7 and a 4.8\. Like a wine\.\.\./);
  assert.match(board, /No games in this game mode yet/);
  assert.match(board, /mode === "class"/);
  assert.doesNotMatch(board, /still open/);
  assert.doesNotMatch(board, /\$\{outcome\.open\}/);
  assert.doesNotMatch(board, /Unfinished games/);
  assert.match(board, /useState<StatisticModeId>\("main"\)/);
  assert.match(board, /type="button"/);
  assert.doesNotMatch(board, /href=/);
  assert.doesNotMatch(board, /useRouter|router\.push|window\.location/);
  assert.match(loader, /readAll\(client, "companies", "id, name"\)/);
  assert.match(loader, /finished_at/);
  const home = fs.readFileSync(path.join(root, "components/home-board.tsx"), "utf8");
  assert.match(home, /\["daily", "all", "company", "class", "origin", "custom"\]/);
  assert.match(home, /A set we define, not a lab's line\. Only Opus, only the nano models, or obscure ones\./);
  assert.match(home, /id: "class"[\s\S]*enabled: false/);
  assert.doesNotMatch(board, /<h2>Family<\/h2>/);
  assert.doesNotMatch(page, /How the rounds have gone/);
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(css, /\.stat-modes \{[^}]*grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.stat-modes > :nth-child\(-n \+ 4\) \{ grid-column: span 3; \}/);
  assert.match(css, /\.stat-modes > :nth-child\(n \+ 5\) \{ grid-column: span 4; \}/);
  assert.equal(page.includes("requireOwner"), false);
  assert.doesNotMatch(loader, /\.(?:eq|neq|not|filter|is|in|gt|gte|lt|lte)\(/);
});

test("the public day bars count a given-up round and leave an open one out", () => {
  const stats = computePublicStats(
    [game("1", "opus", "given_up", 0), game("2", "opus", "solved", 3), game("3", "opus", "active", 1)],
    [],
    [],
    [],
    {},
    now,
  );
  const today = stats.days.find((day) => day.date === "2026-10-10");
  assert.deepEqual(today, { date: "2026-10-10", games: 2, solved: 1, missed: 0, givenUp: 1, open: 0 });
});
