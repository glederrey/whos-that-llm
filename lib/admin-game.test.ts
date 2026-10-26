import assert from "node:assert/strict";
import test from "node:test";
import { likePattern, orderTranscript, pageNumber, parseGameSearch, scoreLines, utcStamp } from "./admin-game";

test("a game id is an exact search, other text is a username", () => {
  assert.deepEqual(parseGameSearch(undefined), { kind: "all" });
  assert.deepEqual(parseGameSearch("   "), { kind: "all" });
  assert.deepEqual(parseGameSearch(" 3F2504E0-4F89-41D3-9A0C-0305E82C3301 "), {
    kind: "id",
    id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  });
  assert.deepEqual(parseGameSearch("gael"), { kind: "username", text: "gael" });
});

test("wildcards in a username search are escaped", () => {
  assert.equal(likePattern("a_b%c"), "%a\\_b\\%c%");
});

test("the transcript reads turn by turn, player first", () => {
  const rows = [
    { turn: 2, role: "assistant" },
    { turn: 1, role: "assistant" },
    { turn: 2, role: "user" },
    { turn: 1, role: "user" },
  ];
  assert.deepEqual(
    orderTranscript(rows).map((row) => `${row.turn}${row.role[0]}`),
    ["1u", "1a", "2u", "2a"],
  );
});

test("a bad page number is page 1", () => {
  assert.equal(pageNumber("3"), 3);
  for (const raw of [undefined, "", "0", "-2", "1.5", "abc", "999999999"]) assert.equal(pageNumber(raw), 1);
});

test("timestamps read as UTC and a bad one is left alone", () => {
  assert.equal(utcStamp("2026-10-24T16:39:46.359601+00:00"), "2026-10-24 16:39:46 UTC");
  assert.equal(utcStamp("nope"), "nope");
});

test("score lines keep the well-formed entries", () => {
  assert.deepEqual(scoreLines([{ label: "Base", points: 2000 }, { label: "Tokens", points: null, multiplier: "×20" }, { points: 1 }, 5]), [
    { label: "Base", points: 2000, multiplier: null },
    { label: "Tokens", points: null, multiplier: "×20" },
  ]);
  assert.deepEqual(scoreLines(null), []);
});
