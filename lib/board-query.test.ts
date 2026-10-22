import assert from "node:assert/strict";
import test from "node:test";
import { boardChoice, boardHref, boardMiddle, boardModes, boardPool, boardSince, isPoolBoard, selectedCategory, type BoardMode } from "./board-query";

const modes: BoardMode[] = [
  { id: "daily", name: "Daily", open: false },
  { id: "all", name: "All models", open: true },
  { id: "class", name: "Category", open: false },
  { id: "company", name: "Company", open: false },
];

test("home and the leaderboard share one board choice", () => {
  const opening = boardChoice({}, modes);
  assert.deepEqual(opening, { gameMode: "all", period: "week", difficulty: "any", company: "all", category: "all" });
  const picked = boardChoice({ gameMode: "all", period: "all", difficulty: "hard" }, modes);
  assert.deepEqual(picked, { gameMode: "all", period: "all", difficulty: "hard", company: "all", category: "all" });
  assert.equal(boardHref("/", picked), "/?gameMode=all&difficulty=hard&period=all");
  assert.equal(boardHref("/leaderboard", picked), "/leaderboard?gameMode=all&difficulty=hard&period=all");
  assert.equal(boardHref("/leaderboard", opening, 2), "/leaderboard?gameMode=all&difficulty=any&period=week&page=2");
});

test("a mode that is not open cannot be selected", () => {
  const closed = boardChoice({ gameMode: "company", period: "all", difficulty: "hard" }, modes);
  assert.equal(closed.gameMode, "all");
  assert.equal(closed.period, "all");
  assert.equal(closed.difficulty, "hard");
  assert.equal(closed.company, "all");
  assert.equal(boardChoice({ gameMode: "daily" }, modes).gameMode, "all");
  assert.equal(boardChoice({ gameMode: "class" }, modes).gameMode, "all");
  assert.equal(boardChoice({ gameMode: "region" }, modes).gameMode, "all");
});

test("region and custom stay off the leaderboard bar", () => {
  const shown = boardModes([
    { id: "custom", name: "Custom", enabled: false, sort_order: 6 },
    { id: "region", name: "Region", enabled: false, sort_order: 5 },
    { id: "company", name: "Company", enabled: false, sort_order: 4 },
    { id: "class", name: "Category", enabled: false, sort_order: 3 },
    { id: "all", name: "All models", enabled: true, sort_order: 2 },
    { id: "daily", name: "Daily", enabled: false, sort_order: 1 },
  ]);
  assert.deepEqual(
    shown.map((mode) => mode.id),
    ["daily", "all", "company", "class"],
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
  const month = boardChoice({ gameMode: "all", period: "month", difficulty: "hard" }, modes);
  assert.deepEqual(month, { gameMode: "all", period: "month", difficulty: "hard", company: "all", category: "all" });
  assert.equal(boardHref("/", month), "/?gameMode=all&difficulty=hard&period=month");
  assert.equal(boardHref("/leaderboard", month), "/leaderboard?gameMode=all&difficulty=hard&period=month");
  assert.equal(boardChoice({ period: "year" }, modes).period, "week");
  assert.equal(boardChoice({}, modes).period, "week");
});

test("an open daily can be selected", () => {
  const open = modes.map((mode) => (mode.id === "daily" ? { ...mode, open: true } : mode));
  assert.deepEqual(boardChoice({ gameMode: "daily", difficulty: "hard", period: "week" }, open), {
    gameMode: "daily",
    period: "week",
    difficulty: "hard",
    company: "all",
    category: "all",
  });
  assert.equal(boardModes([
    { id: "daily", name: "Daily", enabled: true, sort_order: 1 },
    { id: "all", name: "All models", enabled: true, sort_order: 2 },
    { id: "class", name: "Category", enabled: false, sort_order: 3 },
    { id: "company", name: "Company", enabled: false, sort_order: 4 },
  ]).find((mode) => mode.id === "daily")?.open, true);
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

  const companyOpen = modes.map((mode) => (mode.id === "company" ? { ...mode, open: true } : mode));
  assert.deepEqual(boardChoice({ gameMode: "company", company: "anthropic", period: "month" }, companyOpen), {
    gameMode: "company",
    period: "month",
    difficulty: "any",
    company: "anthropic",
    category: "all",
  });
  assert.equal(
    boardHref("/leaderboard", boardChoice({ gameMode: "company", company: "anthropic" }, companyOpen)),
    "/leaderboard?gameMode=company&difficulty=any&period=week&company=anthropic",
  );
  assert.equal(boardHref("/", boardChoice({ gameMode: "company" }, companyOpen)), "/?gameMode=company&difficulty=any&period=week");
  assert.deepEqual(boardMiddle("company", companyOpen), { kind: "company", disabled: false });
  assert.deepEqual(boardMiddle("all", companyOpen), { kind: "difficulty" });
});

test("a category board narrows to one category and unknown ids fall back to all", () => {
  const open = modes.map((mode) => (mode.id === "class" ? { ...mode, open: true } : mode));
  const picked = boardChoice({ gameMode: "class", category: "opus" }, open);
  assert.equal(picked.category, "opus");
  assert.equal(boardPool(picked), "opus");
  assert.equal(boardHref("/leaderboard", picked), "/leaderboard?gameMode=class&difficulty=any&period=week&category=opus");
  assert.equal(boardPool(boardChoice({ gameMode: "class" }, open)), null);
  assert.equal(selectedCategory("nope", [{ id: "opus" }]), "all");
  assert.equal(selectedCategory("opus", [{ id: "opus" }]), "opus");
  assert.equal(isPoolBoard("class"), true);
  assert.equal(isPoolBoard("all"), false);
});
