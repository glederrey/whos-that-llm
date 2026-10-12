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
    region: "us",
    categoryIds: [],
    ...extra,
  };
}

test("public stats keep outcomes and drop cost", () => {
  const games = [
    game("1", "opus", "solved", 3, { size: "large", region: "us" }),
    game("2", "opus", "miss", 10, { size: "large", region: "us", startedAt: "2026-10-09T08:00:00Z" }),
    game("3", "haiku", "given_up", 2, { size: "small", region: "eu", gameMode: "daily" }),
    game("4", "haiku", "solved", 4, { size: "small", region: "cn" }),
    game("5", "secret", "active", 1, { size: "medium", region: "cn", gameMode: "company" }),
  ];
  const usage: PublicUsageFact[] = [
    { gameId: "1", modelId: "opus", inputTokens: 80, outputTokens: 20 },
    { gameId: "2", modelId: "opus", inputTokens: 200, outputTokens: 50 },
    { gameId: "4", modelId: "haiku", inputTokens: 40, outputTokens: 10 },
    { gameId: "5", modelId: "secret", inputTokens: 90, outputTokens: 10 },
    { gameId: null, modelId: "secret", inputTokens: 500, outputTokens: 500 },
  ];
  const guesses: PublicGuessFact[] = [
    { gameId: "1", modelCorrect: false, guessedModelId: "sonnet", regionCorrect: true },
    { gameId: "1", modelCorrect: true, guessedModelId: "opus", regionCorrect: true },
    { gameId: "2", modelCorrect: false, guessedModelId: "sonnet", regionCorrect: false },
    { gameId: "2", modelCorrect: false, guessedModelId: "sonnet", regionCorrect: true },
    { gameId: "4", modelCorrect: true, guessedModelId: "haiku", regionCorrect: true },
    { gameId: "5", modelCorrect: false, guessedModelId: "opus", regionCorrect: false },
    { gameId: "missing", modelCorrect: false, guessedModelId: "opus", regionCorrect: true },
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
    [],
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
  assert.equal(stats.outcome.regionFoundRate, 0.75);
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
  assert.equal(stats.regions.find((row) => row.key === "eu")?.finished, 0);
  assert.equal(stats.regions.find((row) => row.key === "cn")?.games, 1);

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
  const stats = computePublicStats([], [], [], [], [], now);
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
    [game("1", "opus", "solved", 2, { gameMode: "custom", size: "medium", region: "eu" })],
    [],
    [],
    [{ id: "all", name: "All models" }],
    [],
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

test("a round counts in each category, and a model with no category adds no row", () => {
  const stats = computePublicStats(
    [
      game("1", "opus", "solved", 2, { categoryIds: ["opus", "latest"] }),
      game("2", "haiku", "miss", 4, { categoryIds: ["haiku"] }),
      game("3", "luna", "solved", 1, { categoryIds: [] }),
    ],
    [],
    [],
    [],
    [
      { id: "empty", name: "Empty" },
      { id: "opus", name: "Opus" },
      { id: "latest", name: "Latest" },
      { id: "haiku", name: "Haiku" },
    ],
    now,
  );
  assert.deepEqual(
    stats.categories.map((row) => [row.name, row.games, row.solveRate]),
    [
      ["Empty", 0, null],
      ["Haiku", 1, 0],
      ["Latest", 1, 1],
      ["Opus", 1, 1],
    ],
  );
  assert.equal(stats.categories.some((row) => row.name === "luna" || row.key === "none"), false);
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
      { gameId: "done", modelCorrect: true, guessedModelId: "opus", regionCorrect: true },
      { gameId: "stale", modelCorrect: true, guessedModelId: "haiku", regionCorrect: true },
      { gameId: "open", modelCorrect: false, guessedModelId: "opus", regionCorrect: true },
    ],
    [
      { id: "all", name: "All models" },
      { id: "daily", name: "Daily" },
    ],
    [],
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
        region: "us",
        categoryIds: ["frontier"],
        startedAt: `${today}T08:00:00Z`,
        finishedAt: `${today}T09:00:00Z`,
      }),
      game("daily-today-medium", "kimi", "miss", 6, {
        gameMode: "daily",
        size: "medium",
        region: "cn",
        categoryIds: ["cn-labs"],
        startedAt: `${today}T00:05:00Z`,
        finishedAt: `${today}T01:00:00Z`,
      }),
      game("daily-yesterday", "opus", "miss", 5, {
        gameMode: "daily",
        size: "large",
        region: "eu",
        categoryIds: ["opus"],
        startedAt: "2026-10-11T23:30:00Z",
        finishedAt: "2026-10-11T23:50:00Z",
      }),
      game("all-today", "haiku", "solved", 2, {
        gameMode: "all",
        size: "small",
        region: "eu",
        categoryIds: ["haiku"],
        startedAt: `${today}T10:00:00Z`,
        finishedAt: `${today}T11:00:00Z`,
      }),
    ],
    [{ gameId: "daily-today", modelId: "grok", inputTokens: 40, outputTokens: 10 }],
    [
      { gameId: "daily-today", modelCorrect: false, guessedModelId: "sonnet", regionCorrect: true },
      { gameId: "daily-today-medium", modelCorrect: false, guessedModelId: "opus", regionCorrect: false },
      { gameId: "daily-yesterday", modelCorrect: false, guessedModelId: "sonnet", regionCorrect: false },
      { gameId: "all-today", modelCorrect: false, guessedModelId: "opus", regionCorrect: true },
    ],
    [
      { id: "daily", name: "Daily" },
      { id: "all", name: "All models" },
      { id: "company", name: "Company" },
    ],
    [
      { id: "frontier", name: "Frontier" },
      { id: "cn-labs", name: "CN labs" },
      { id: "opus", name: "Opus" },
      { id: "haiku", name: "Haiku" },
    ],
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
  assert.equal(stats.regions.find((row) => row.key === "us")?.games, 0);
  assert.equal(stats.regions.find((row) => row.key === "cn")?.games, 0);
  assert.equal(stats.regions.find((row) => row.key === "eu")?.games, 2);
  assert.deepEqual(
    stats.categories.map((row) => [row.name, row.games]),
    [
      ["CN labs", 0],
      ["Frontier", 0],
      ["Haiku", 1],
      ["Opus", 1],
    ],
  );

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
  assert.equal(daily?.regions.find((row) => row.key === "us")?.games, 0);
  assert.equal(daily?.regions.find((row) => row.key === "eu")?.games, 1);

  const all = stats.gameModes.find((row) => row.id === "all");
  assert.equal(all?.finished, 1);
  assert.equal(all?.days.find((day) => day.date === today)?.games, 1);
  assert.deepEqual(all?.models.map((row) => row.modelId), ["haiku"]);
  assert.deepEqual(
    all?.confusion.map((row) => [row.hiddenModelId, row.guessedModelId]),
    [["haiku", "opus"]],
  );
  assert.equal(all?.sizes.find((row) => row.key === "small")?.games, 1);
  assert.equal(all?.regions.find((row) => row.key === "eu")?.games, 1);
});

test("Daily can be selected, and Category, Company, Region, and Custom stay closed", () => {
  assert.deepEqual(
    statisticModes.map((mode) => [mode.name, mode.enabled]),
    [
      ["All modes", true],
      ["Daily", true],
      ["All models", true],
      ["Category", false],
      ["Company", false],
      ["Region", false],
      ["Custom", false],
    ],
  );
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
  assert.match(board, /No finished games in this game mode yet/);
  assert.match(board, /mode === "class"/);
  assert.doesNotMatch(board, /still open/);
  assert.doesNotMatch(board, /\$\{outcome\.open\}/);
  assert.doesNotMatch(board, /Unfinished games/);
  assert.match(board, /useState<StatisticModeId>\("main"\)/);
  assert.match(board, /type="button"/);
  assert.doesNotMatch(board, /href=/);
  assert.doesNotMatch(board, /useRouter|router\.push|window\.location/);
  assert.match(loader, /readAll\(client, "model_categories", "model_id, category_id", \["model_id", "category_id"\]\)/);
  assert.match(loader, /finished_at/);
  const home = fs.readFileSync(path.join(root, "components/home-board.tsx"), "utf8");
  assert.match(home, /\["daily", "all", "class", "company", "region", "custom"\]/);
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
