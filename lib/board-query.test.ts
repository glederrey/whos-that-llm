import assert from "node:assert/strict";
import test from "node:test";
import { boardChoice, boardHref, boardMiddle, boardModes, boardSince, type BoardMode } from "./board-query";

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

test("this month is the current UTC calendar month", () => {
  const wednesday = new Date("2026-10-14T15:04:00.000Z");
  assert.equal(boardSince("month", wednesday), "2026-10-01T00:00:00.000Z");
  assert.equal(boardSince("week", wednesday), "2026-10-12T00:00:00.000Z");
  assert.equal(boardSince("all", wednesday), "1970-01-01T00:00:00.000Z");
  const sunday = new Date("2026-10-11T23:59:00.000Z");
  assert.equal(boardSince("week", sunday), "2026-10-05T00:00:00.000Z");
  assert.equal(boardSince("month", new Date("2026-01-01T00:00:00.000Z")), "2026-01-01T00:00:00.000Z");
});

test("the month filter is one board choice", () => {
  const month = boardChoice({ category: "all", period: "month", difficulty: "hard" }, modes);
  assert.deepEqual(month, { category: "all", period: "month", difficulty: "hard" });
  assert.equal(boardHref("/", month), "/?category=all&difficulty=hard&period=month");
  assert.equal(boardHref("/leaderboard", month), "/leaderboard?category=all&difficulty=hard&period=month");
  assert.equal(boardChoice({ period: "year" }, modes).period, "week");
  assert.equal(boardChoice({}, modes).period, "week");
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
