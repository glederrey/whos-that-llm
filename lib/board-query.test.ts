import assert from "node:assert/strict";
import test from "node:test";
import { boardChoice, boardHref, boardMiddle, boardModes, type BoardMode } from "./board-query";

const modes: BoardMode[] = [
  { id: "daily", name: "Daily", open: false },
  { id: "all", name: "All models", open: true },
  { id: "class", name: "Class", open: false },
  { id: "company", name: "Company", open: false },
];

test("home and the leaderboard share one board choice", () => {
  const opening = boardChoice({}, modes);
  assert.deepEqual(opening, { category: "all", period: "week", difficulty: "any" });
  const picked = boardChoice({ category: "all", period: "all", difficulty: "hard" }, modes);
  assert.deepEqual(picked, { category: "all", period: "all", difficulty: "hard" });
  assert.equal(boardHref("/", picked), "/?category=all&difficulty=hard&period=all");
  assert.equal(boardHref("/leaderboard", picked), "/leaderboard?category=all&difficulty=hard&period=all");
  assert.equal(boardHref("/leaderboard", opening, 2), "/leaderboard?category=all&difficulty=any&period=week&page=2");
});

test("a mode that is not open cannot be selected", () => {
  const closed = boardChoice({ category: "company", period: "all", difficulty: "hard" }, modes);
  assert.equal(closed.category, "all");
  assert.equal(closed.period, "all");
  assert.equal(closed.difficulty, "hard");
  assert.equal(boardChoice({ category: "daily" }, modes).category, "all");
  assert.equal(boardChoice({ category: "class" }, modes).category, "all");
  assert.equal(boardChoice({ category: "region" }, modes).category, "all");
});

test("region and custom stay off the leaderboard bar", () => {
  const shown = boardModes([
    { id: "custom", name: "Custom", enabled: false, sort_order: 6 },
    { id: "region", name: "Region", enabled: false, sort_order: 5 },
    { id: "company", name: "Company", enabled: false, sort_order: 4 },
    { id: "class", name: "Class", enabled: false, sort_order: 3 },
    { id: "all", name: "All models", enabled: true, sort_order: 2 },
    { id: "daily", name: "Daily", enabled: false, sort_order: 1 },
  ]);
  assert.deepEqual(
    shown.map((mode) => mode.id),
    ["daily", "all", "class", "company"],
  );
  assert.deepEqual(
    shown.map((mode) => mode.open),
    [false, true, false, false],
  );
});

test("the middle slot is the selected mode's control", () => {
  assert.deepEqual(boardMiddle("all", modes), { kind: "difficulty" });
  assert.equal(boardMiddle("daily", modes), null);
  assert.deepEqual(boardMiddle("class", modes), { kind: "class", disabled: true });
  assert.deepEqual(boardMiddle("company", modes), { kind: "company", disabled: true });

  const dailyOpen = modes.map((mode) => (mode.id === "daily" ? { ...mode, open: true } : mode));
  assert.deepEqual(boardMiddle("daily", dailyOpen), { kind: "difficulty" });
  assert.deepEqual(boardMiddle("all", dailyOpen), { kind: "difficulty" });

  const classOpen = modes.map((mode) => (mode.id === "class" ? { ...mode, open: true } : mode));
  assert.deepEqual(boardMiddle("class", classOpen), { kind: "class", disabled: false });
  assert.deepEqual(boardMiddle("all", classOpen), { kind: "difficulty" });
  assert.deepEqual(boardMiddle("company", classOpen), { kind: "company", disabled: true });
});
