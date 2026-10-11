import assert from "node:assert/strict";
import test from "node:test";
import {
  anonymizePlay,
  clearedGameLink,
  clearedUsageLink,
  countedPlayerId,
  countedRounds,
  leaderboardNames,
  type BoardGame,
  type StoredPlay,
} from "./anonymize-account";

const since = "1970-01-01T00:00:00.000Z";

function round(partial: Partial<BoardGame> & Pick<BoardGame, "userId" | "username" | "score">): BoardGame {
  return {
    category: "all",
    onBoard: true,
    status: "solved",
    messageCount: 3,
    finishedAt: "2026-10-01T00:00:00.000Z",
    ...partial,
  };
}

test("deleting an account keeps the rounds and clears the person", () => {
  const before: StoredPlay = {
    games: [
      { id: "g1", userId: "ada", username: "Ada" },
      { id: "g2", userId: "bea", username: "Bea" },
    ],
    messages: [
      { id: "m1", gameId: "g1" },
      { id: "m2", gameId: "g1" },
    ],
    guesses: [{ id: "q1", gameId: "g1" }],
    usage: [{ id: "u1", gameId: "g1", userId: "ada" }],
  };
  const after = anonymizePlay(before, "ada");
  assert.deepEqual(clearedGameLink(), { user_id: null, username: null });
  assert.deepEqual(clearedUsageLink(), { user_id: null });
  assert.equal(after.games.length, 2);
  assert.equal(after.messages.length, 2);
  assert.equal(after.guesses.length, 1);
  assert.equal(after.messages[0]?.gameId, "g1");
  assert.equal(after.guesses[0]?.gameId, "g1");
  assert.equal(after.games[0]?.userId, null);
  assert.equal(after.games[0]?.username, null);
  assert.equal(after.games[0]?.id, "g1");
  assert.equal(after.usage[0]?.userId, null);
  assert.equal(after.usage[0]?.gameId, "g1");
  assert.deepEqual(after.games[1], { id: "g2", userId: "bea", username: "Bea" });
  assert.equal(countedRounds(after.games), 2);
  assert.equal(countedPlayerId(after.games[0]?.userId), null);
  assert.equal(countedPlayerId(after.games[1]?.userId), "bea");
});

test("the leaderboard omits a deleted player and does not leave a blank row", () => {
  const games = [
    round({ userId: null, username: null, score: 900, messageCount: 1, finishedAt: "2026-10-02T00:00:00.000Z" }),
    round({ userId: null, username: "Ada", score: 800, finishedAt: "2026-10-03T00:00:00.000Z" }),
    round({ userId: "bea", username: "Bea", score: 100, messageCount: 4 }),
    round({ userId: "cy", username: null, score: 700 }),
    round({ userId: "cy", username: "", score: 650 }),
    round({ userId: "blank", username: "   ", score: 640 }),
  ];
  const board = leaderboardNames(games, "all", since);
  assert.deepEqual(
    board.map((row) => row.name),
    ["Bea"],
  );
  assert.equal(
    board.some((row) => row.name.trim() === ""),
    false,
  );
  assert.equal(countedRounds(games), 6);
  const players = new Set(games.map((game) => countedPlayerId(game.userId)).filter((id) => id !== null));
  assert.equal(players.size, 3);
  assert.equal(players.has("bea"), true);
  assert.equal(players.has("cy"), true);
  assert.equal(players.has("blank"), true);
});

test("two deleted players do not collapse into one anonymous rank", () => {
  const games = [
    round({ userId: null, username: null, score: 500 }),
    round({ userId: null, username: null, score: 400, finishedAt: "2026-10-04T00:00:00.000Z" }),
  ];
  assert.deepEqual(leaderboardNames(games, "all", since), []);
  assert.equal(countedRounds(games), 2);
  assert.equal(countedPlayerId(null), null);
});
