import { difficultyFromStored } from "./difficulty";
import { scoreRound, scoreTokens, type GuessFlags } from "./game";
import type { GameRow } from "./rounds-shape";

/** Where a guess leaves the round: solved, out of messages, or still going. */
export function guessFinish(modelCorrect: boolean, messageCount: number, messageLimit: number): "continue" | "solved" | "miss" {
  return modelCorrect ? "solved" : messageCount >= messageLimit ? "miss" : "continue";
}

/** Score a round from its game row, the guesses made and the successful usage rows (oldest first). */
export function scoreGame(
  game: GameRow,
  guesses: GuessFlags[],
  namedModel: boolean,
  usage: Array<{ input_tokens?: unknown; output_tokens?: unknown }>,
) {
  const tokens = scoreTokens(
    usage.map((row) => ({
      inputTokens: Number(row.input_tokens ?? 0),
      outputTokens: Number(row.output_tokens ?? 0),
    })),
  ).tokens;
  return scoreRound({
    rules: game.rules,
    namedModel,
    regionMatched: guesses.some((guess) => guess.regionCorrect),
    companyMatched: guesses.some((guess) => guess.companyCorrect),
    regionGiven: game.traits.given.includes("region"),
    companyGiven: game.traits.given.includes("company"),
    tokens,
    noHint: game.no_hint,
    hints: game.hints ?? [],
    wrongGuesses: guesses.filter((guess) => !guess.modelCorrect).length,
    difficulty: difficultyFromStored(game.difficulty),
  });
}
