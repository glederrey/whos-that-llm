import assert from "node:assert/strict";
import test from "node:test";
import { bestSolvedScore, cleanDay, dayWindow, isBestSolved, levelQuery, parseHistoryFilter } from "./profile-filter";

test("a bad value in the query string reads as no filter", () => {
  assert.deepEqual(parseHistoryFilter({ from: "2026-02-30", to: "tomorrow", status: "won", mode: "No Way!", level: "easy" }), {});
  assert.equal(cleanDay("2026-10-23"), "2026-10-23");
  assert.equal(cleanDay("2026-13-01"), null);
});

test("a level only counts with a game mode", () => {
  assert.deepEqual(parseHistoryFilter({ level: "easy" }), {});
  assert.deepEqual(parseHistoryFilter({ mode: "daily", level: "easy", status: "solved" }), { mode: "daily", level: "easy", status: "solved" });
});

test("the last day is included in the window", () => {
  assert.deepEqual(dayWindow({ from: "2026-10-21", to: "2026-10-23" }), {
    since: "2026-10-21T00:00:00.000Z",
    before: "2026-10-24T00:00:00.000Z",
  });
  assert.deepEqual(dayWindow({}), { since: null, before: null });
});

test("the level filter reads a difficulty, a category or a company, and nothing for Origin and Custom", () => {
  assert.deepEqual(levelQuery("daily", "hard"), { column: "difficulty", value: "3" });
  assert.equal(levelQuery("all", "nonsense"), null);
  assert.deepEqual(levelQuery("class", "nano"), { column: "pool_key", value: "nano" });
  assert.deepEqual(levelQuery("company", "openai"), { column: "pool_key", value: "openai" });
  assert.equal(levelQuery("custom", "easy"), null);
});

test("the cup goes only to a solved round, even when a failed round scored higher", () => {
  const games = [
    { status: "solved" as const, score: 900 },
    { status: "miss" as const, score: 1200 },
    { status: "given_up" as const, score: 900 },
  ];
  const best = bestSolvedScore(games);
  assert.equal(best, 900);
  assert.deepEqual(games.map((game) => isBestSolved(game, best)), [true, false, false]);
  assert.equal(bestSolvedScore([{ status: "miss" as const, score: 300 }]), null);
});
