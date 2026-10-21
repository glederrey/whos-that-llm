import assert from "node:assert/strict";
import { test } from "node:test";
import { boardSeed } from "./board-seed";
import { boardSince } from "./board-query";
import { bestOwnGame, boardFilters, boardRows, markLegacyRows, parseStats, toBoardRow, utcDayWindow } from "./rounds-board-rows";

const base = { rank: 1, name: "ann", score: 900 };

test("toBoardRow fills the optional columns with safe defaults", () => {
  const row = toBoardRow(base, false);
  assert.equal(row.rank, 1);
  assert.equal(row.score, 900);
  assert.equal(row.mine, false);
  assert.equal(row.difficulty, null);
  assert.equal(row.noHint, false);
  assert.equal(row.companyId, null);
  assert.equal(row.companyName, null);
  assert.equal(row.companyLogo, null);
  assert.equal(row.seed, "ann");
});

test("toBoardRow coerces numeric strings and reads stored difficulty", () => {
  const row = toBoardRow({ ...base, rank: "2" as unknown as number, score: "55" as unknown as number, difficulty: "3", no_hint: true }, true);
  assert.equal(row.rank, 2);
  assert.equal(row.score, 55);
  assert.equal(row.difficulty, "hard");
  assert.equal(row.noHint, true);
  assert.equal(row.mine, true);
});

test("toBoardRow seeds the avatar from the account id for the viewer, a hash for others", () => {
  assert.equal(toBoardRow({ ...base, user_id: "u-1" }, true).seed, boardSeed("u-1", "ann", true));
  const other = toBoardRow({ ...base, user_id: "u-1" }, false).seed;
  assert.equal(other, boardSeed("u-1", "ann", false));
  assert.notEqual(other, "u-1");
});

test("toBoardRow shows the company logo only when both id and logo are strings", () => {
  const withBoth = toBoardRow({ ...base, company_id: "acme", company_name: "Acme", company_logo: "https://cdn.example/a.png" }, false);
  assert.equal(withBoth.companyId, "acme");
  assert.equal(withBoth.companyName, "Acme");
  assert.equal(withBoth.companyLogo, "https://cdn.example/a.png");
  assert.equal(toBoardRow({ ...base, company_logo: "x.png" }, false).companyLogo, null);
  assert.equal(toBoardRow({ ...base, company_id: "acme" }, false).companyLogo, null);
});

test("toBoardRow gives no avatar url without an avatar path", () => {
  assert.equal(toBoardRow(base, false).avatarUrl, null);
  assert.ok(toBoardRow({ ...base, avatar_path: "u/a.png" }, false).avatarUrl?.endsWith("/storage/v1/object/public/avatars/u/a.png"));
});

test("boardRows trusts the mine flag from the database and accepts null", () => {
  const rows = boardRows([{ ...base, mine: true }, { ...base, rank: 2, name: "bob" }]);
  assert.deepEqual(rows.map((r) => r.mine), [true, false]);
  assert.deepEqual(boardRows(null), []);
});

test("boardFilters falls back to the week for an unknown period", () => {
  assert.equal(boardFilters("all", "weird").since, boardSince("week"));
  assert.equal(boardFilters("all", "all").since, boardSince("all"));
  assert.equal(boardFilters("all", "month").since, boardSince("month"));
});

test("boardFilters: difficulty applies outside the company mode, company only inside it", () => {
  const all = boardFilters("all", "week", "hard", "acme");
  assert.equal(all.difficulty, 3);
  assert.equal(all.company, null);
  const company = boardFilters("company", "week", "hard", "acme");
  assert.equal(company.difficulty, null);
  assert.equal(company.company, "acme");
  assert.equal(boardFilters("all", "week", "any").difficulty, null);
  assert.equal(boardFilters("all", "week", null).difficulty, null);
  assert.equal(boardFilters("company", "week", null, "").company, null);
});

test("bestOwnGame needs a numeric score in the first row", () => {
  assert.deepEqual(bestOwnGame([{ username: "ann", score: 10 }]), { username: "ann", score: 10 });
  assert.equal(bestOwnGame([{ username: "ann", score: "10" }]), null);
  assert.equal(bestOwnGame([]), null);
  assert.equal(bestOwnGame(null), null);
});

test("markLegacyRows marks only the row with the viewer's best name and score", () => {
  const data = [base, { ...base, rank: 2, score: 800 }, { ...base, rank: 3, name: "bob", score: 900 }];
  assert.deepEqual(markLegacyRows(data, { username: "ann", score: 900 }).map((r) => r.mine), [true, false, false]);
  assert.deepEqual(markLegacyRows(data, null).map((r) => r.mine), [false, false, false]);
});

test("parseStats defaults missing counts to 0 and keeps companies null unless numeric", () => {
  assert.deepEqual(parseStats({ models: 5, gamesToday: "2", players: 9, companies: 4 }), { models: 5, gamesToday: 2, players: 9, companies: 4 });
  assert.deepEqual(parseStats({}), { models: 0, gamesToday: 0, players: 0, companies: null });
  assert.equal(parseStats({ companies: "4" as unknown as number }).companies, null);
});

test("utcDayWindow spans the UTC day of the given time", () => {
  assert.deepEqual(utcDayWindow(new Date("2026-03-05T23:59:59Z")), {
    start: "2026-03-05T00:00:00.000Z",
    end: "2026-03-06T00:00:00.000Z",
  });
});
