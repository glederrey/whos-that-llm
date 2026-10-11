import assert from "node:assert/strict";
import test from "node:test";
import { boardChoice, boardHref } from "./board-query";

const modes = ["daily", "all", "class", "company", "region", "custom"];

test("home and the leaderboard share one board choice", () => {
  const opening = boardChoice({}, modes);
  assert.deepEqual(opening, { category: "all", period: "week", difficulty: "any" });
  const picked = boardChoice({ category: "company", period: "all", difficulty: "hard" }, modes);
  assert.deepEqual(picked, { category: "company", period: "all", difficulty: "hard" });
  assert.equal(boardHref("/", picked), "/?category=company&difficulty=hard&period=all");
  assert.equal(boardHref("/leaderboard", picked), "/leaderboard?category=company&difficulty=hard&period=all");
  assert.equal(boardHref("/leaderboard", opening, 2), "/leaderboard?category=all&difficulty=any&period=week&page=2");
});
