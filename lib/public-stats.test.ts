import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { computePublicStats, type PublicGameFact, type PublicGuessFact, type PublicUsageFact } from "./public-stats";

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
    category: "all",
    size: "small",
    region: "us",
    classIds: [],
    ...extra,
  };
}

test("public stats keep outcomes and drop cost", () => {
  const games = [
    game("1", "opus", "solved", 3, { size: "large", region: "us" }),
    game("2", "opus", "miss", 10, { size: "large", region: "us", startedAt: "2026-10-09T08:00:00Z" }),
    game("3", "haiku", "given_up", 2, { size: "small", region: "eu", category: "daily" }),
    game("4", "haiku", "solved", 4, { size: "small", region: "cn" }),
    game("5", "secret", "active", 1, { size: "medium", region: "cn", category: "company" }),
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
  assert.equal(stats.outcome.open, 1);
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
    ["small", "medium", "large"],
  );
  assert.equal(stats.sizes[0].finished, 2);
  assert.equal(stats.sizes[1].finished, 0);
  assert.equal(stats.sizes[1].solveRate, null);
  assert.equal(stats.sizes[2].solveRate, 0.5);
  assert.equal(stats.regions.find((row) => row.key === "eu")?.finished, 1);
  assert.equal(stats.regions.find((row) => row.key === "cn")?.games, 1);

  assert.deepEqual(
    stats.categories.map((row) => row.id),
    ["daily", "all", "company", "custom"],
  );
  assert.equal(stats.categories[0].finished, 1);
  assert.equal(stats.categories[1].outcome?.solveRate, 2 / 3);
  assert.equal(stats.categories[2].outcome, null);
  assert.equal(stats.categories[2].open, 1);
  assert.equal(stats.categories[2].models.length, 0);
  assert.equal(stats.categories[3].finished, 0);
  assert.equal(stats.categories[3].outcome, null);
});

test("an empty category list does not invent rows", () => {
  const stats = computePublicStats([], [], [], [], [], now);
  assert.equal(stats.outcome.solveRate, null);
  assert.equal(stats.outcome.tokensPerGame, null);
  assert.equal(stats.models.length, 0);
  assert.equal(stats.confusion.length, 0);
  assert.equal(stats.categories.length, 0);
  assert.equal(stats.sizes.every((row) => row.solveRate === null && row.games === 0), true);
});

test("a finished category outside the list is still shown", () => {
  const stats = computePublicStats(
    [game("1", "opus", "solved", 2, { category: "custom", size: "medium", region: "eu" })],
    [],
    [],
    [{ id: "all", name: "All models" }],
    [],
    now,
  );
  assert.deepEqual(
    stats.categories.map((row) => [row.id, row.finished]),
    [
      ["all", 0],
      ["custom", 1],
    ],
  );
  assert.equal(stats.sizes.find((row) => row.key === "unknown"), undefined);
});

test("a round counts in each class, and a model with no class adds no row", () => {
  const stats = computePublicStats(
    [
      game("1", "opus", "solved", 2, { classIds: ["opus", "latest"] }),
      game("2", "haiku", "miss", 4, { classIds: ["haiku"] }),
      game("3", "luna", "solved", 1, { classIds: [] }),
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
    stats.classes.map((row) => [row.name, row.games, row.solveRate]),
    [
      ["Empty", 0, null],
      ["Haiku", 1, 0],
      ["Latest", 1, 1],
      ["Opus", 1, 1],
    ],
  );
  assert.equal(stats.classes.some((row) => row.name === "luna" || row.key === "none"), false);
});

test("the public stats page does not read prices, billing, or account rows", () => {
  const loader = fs.readFileSync(path.join(root, "lib/public-stats-data.ts"), "utf8");
  const page = fs.readFileSync(path.join(root, "app/statistics/page.tsx"), "utf8");
  const why = fs.readFileSync(path.join(root, "app/why/page.tsx"), "utf8");
  for (const banned of ["cost_usd", "openrouter", "price", "requireOwner", "user_id", "username", "content", "usd("]) {
    assert.equal(loader.toLowerCase().includes(banned), false, banned);
    assert.equal(page.toLowerCase().includes(banned), false, banned);
  }
  assert.match(why, /Over time I think I could tell an Opus 4.5 from a 4.7 and a 4.8\. Like a wine\.\.\./);
  assert.match(page, /No finished games in this category yet/);
  assert.match(page, /<h2>Class<\/h2>/);
  assert.match(loader, /readAll\(client, "model_classes", "model_id, class_id", \["model_id", "class_id"\]\)/);
  const board = fs.readFileSync(path.join(root, "components/home-board.tsx"), "utf8");
  assert.match(board, /\["daily", "all", "class", "company", "region", "custom"\]/);
  assert.match(board, /One class of models\. Opus, or GPT vs Claude\./);
  assert.match(board, /id: "class"[\s\S]*enabled: false/);
  assert.doesNotMatch(page, /<h2>Family<\/h2>/);
  assert.doesNotMatch(page, /How the rounds have gone/);
  assert.equal(page.includes("requireOwner"), false);
  assert.doesNotMatch(loader, /\.(?:eq|neq|not|filter|is|in|gt|gte|lt|lte)\(/);
});
