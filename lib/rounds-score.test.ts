import assert from "node:assert/strict";
import { test } from "node:test";
import { rulesForGameMode } from "./config";
import { scoreRound, scoreTokens } from "./game";
import { guessFinish, scoreGame } from "./rounds-score";
import type { GameRow } from "./rounds-shape";

function gameRow(overrides: Partial<GameRow> = {}): GameRow {
  return {
    id: "g1",
    user_id: "u1",
    username: "ann",
    game_mode: "all",
    pool_key: null,
    pool_model_ids: [],
    model_id: "m1",
    traits: { given: ["origin"], models: {} },
    status: "active",
    no_hint: false,
    rules: rulesForGameMode(true),
    hints: [],
    difficulty: 2,
    message_count: 3,
    awaiting_guess: true,
    score: null,
    score_breakdown: null,
    score_explanation: null,
    ...overrides,
  };
}

test("guessFinish: a correct model solves, even on the last message", () => {
  assert.equal(guessFinish(true, 10, 5), "solved");
  assert.equal(guessFinish(true, 1, 5), "solved");
});

test("guessFinish: a wrong guess misses only once the message limit is reached", () => {
  assert.equal(guessFinish(false, 4, 5), "continue");
  assert.equal(guessFinish(false, 5, 5), "miss");
  assert.equal(guessFinish(false, 6, 5), "miss");
});

test("scoreGame matches scoreRound on the same input", () => {
  const game = gameRow();
  const guesses = [
    { modelCorrect: false, companyCorrect: true, originCorrect: true },
    { modelCorrect: true, companyCorrect: true, originCorrect: true },
  ];
  const usage = [
    { input_tokens: 100, output_tokens: 50 },
    { input_tokens: "20", output_tokens: null },
  ];
  const expected = scoreRound({
    rules: game.rules,
    namedModel: true,
    originMatched: true,
    companyMatched: true,
    originGiven: true,
    companyGiven: false,
    tokens: scoreTokens([{ inputTokens: 100, outputTokens: 50 }, { inputTokens: 20, outputTokens: 0 }]).tokens,
    noHint: false,
    hints: [],
    wrongGuesses: 1,
    difficulty: "medium",
  });
  const got = scoreGame(game, guesses, true, usage);
  assert.ok(got.score > 0);
  assert.equal(got.score, expected.score);
  assert.deepEqual(got.breakdown, expected.breakdown);
});

test("scoreGame reads missing token counts as 0 and gives no score for a pure give-up", () => {
  const game = gameRow();
  const none = scoreGame(game, [], false, []);
  const zeros = scoreGame(game, [], false, [{}, { input_tokens: null, output_tokens: undefined }]);
  assert.deepEqual(zeros, none);
});

test("scoreGame counts hints and wrong guesses from the row and the guesses", () => {
  const game = gameRow();
  const clean = scoreGame(game, [{ modelCorrect: true, companyCorrect: true, originCorrect: true }], true, []);
  const worse = scoreGame(
    gameRow({ hints: ["year"] }),
    [
      { modelCorrect: false, companyCorrect: false, originCorrect: false },
      { modelCorrect: true, companyCorrect: true, originCorrect: true },
    ],
    true,
    [],
  );
  assert.ok(worse.score < clean.score, `${worse.score} < ${clean.score}`);
});
