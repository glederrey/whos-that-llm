import assert from "node:assert/strict";
import test from "node:test";
import { computePublicStats } from "./public-stats";
import { expandGuesses, factsFromRows } from "./public-stats-facts";

test("expandGuesses keeps counts, wrong models and the last origin", () => {
  const guesses = expandGuesses("1", 4, 1, 2, "cn", ["m-a", "m-b"]);
  assert.equal(guesses.length, 4);
  assert.equal(guesses.filter((guess) => guess.modelCorrect).length, 1);
  assert.equal(guesses.filter((guess) => guess.originCorrect).length, 2);
  assert.deepEqual(
    guesses.filter((guess) => !guess.modelCorrect).map((guess) => guess.guessedModelId),
    ["m-a", "m-b", null],
  );
  assert.deepEqual(guesses.map((guess) => guess.guessedOrigin), [null, null, null, "cn"]);
  assert.deepEqual(expandGuesses("1", 0, 0, 0, null, []), []);
});

test("factsFromRows reads the compact rows and feeds the same figures", () => {
  const { games, usage, guesses } = factsFromRows({
    games: [
      [1, "m1", "solved", 3, "2026-10-09", "2026-10-09", "all", "small", "us", null, 2, false, 40, []],
      [2, "m1", "miss", 5, "2026-10-09", "2026-10-09", "all", "bogus", "", "", null, true, null, []],
    ],
    usage: [[1, "m1", 300], [2, "m1", 500]],
    guesses: [[1, 2, 1, 1, "us", ["m2"]], [2, 1, 0, 0, null, ["m2"]]],
  });
  assert.equal(games[1].size, null);
  assert.equal(games[1].origin, null);
  assert.equal(games[1].poolKey, null);
  assert.equal(games[0].difficulty, 2);
  assert.equal(games[1].noHint, true);
  const stats = computePublicStats(games, usage, guesses, [{ id: "all", name: "All models" }], {}, new Date("2026-10-10T12:00:00Z"));
  assert.equal(stats.outcome.games, 2);
  assert.equal(stats.outcome.solved, 1);
  assert.equal(stats.outcome.guesses, 3);
  assert.equal(stats.outcome.correctGuesses, 1);
  assert.equal(stats.outcome.tokensPerGame, 400);
  assert.deepEqual(stats.confusion, [{ hiddenModelId: "m1", guessedModelId: "m2", count: 2 }]);
});
