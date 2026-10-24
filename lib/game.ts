import type { Rules } from "./config";
import { difficultyLabel, type Difficulty } from "./difficulty";
import {
  displayValue,
  explainScore,
  formatFactor,
  formatInt,
  formatStepNumber,
  givenRows,
  hintNames,
  poolLabel,
  originFlag,
  originLabel,
  sizeLabel,
} from "./game-labels";

export { formatFactor, givenRows, poolLabel, originFlag, originLabel, sizeLabel };

/** An origin id from the `origins` table. The first three ship with the app; an admin can add more. */
export type Origin = string;
export type Size = "nano" | "small" | "medium" | "large" | "xxl";
export type TraitKey = "company" | "origin" | "year" | "size";
export type HintKey = "company" | "origin" | "year" | "size";
export type GameStatus = "active" | "solved" | "miss" | "given_up";

/** A round counts as played once it is solved, not solved, or given up. */
export const finishedGameStatuses = ["solved", "miss", "given_up"] as const satisfies readonly GameStatus[];

export function isFinishedGame(status: string): boolean {
  return (finishedGameStatuses as readonly string[]).includes(status);
}

/** The message about to be written. Two replies already in means the next one is 3. The tenth stays at the limit. */
export function upcomingMessageNumber(messageNumber: number, messageLimit: number): number {
  return Math.min(messageLimit, Math.max(1, messageNumber + 1));
}

export type FrozenModel = {
  name: string;
  companyId: string;
  companyName: string;
  origin: Origin;
  /** Name, flag and order of the origin, frozen with the round. Absent on a round that started before Origin. */
  originName?: string;
  originFlag?: string;
  originSort?: number;
  size: Size;
  year: number;
  logoPath: string;
};

export type Traits = {
  given: TraitKey[];
  models: Record<string, FrozenModel>;
};

export type GuessFlags = {
  modelCorrect: boolean;
  companyCorrect: boolean;
  originCorrect: boolean;
};

export type ScoreLine = {
  label: string;
  /** Point change for the base, a penalty, or the floor. Null on a multiplier row. */
  points: number | null;
  /** Set on a multiplier row. The card shows this instead of points. */
  multiplier?: string;
};

export type ScoreStep = {
  label: string;
  /** The points added, or the × factor. Blank on the subtotal and the floor. */
  change: string;
  /** The score after this line. */
  after: string;
  kind: "points" | "subtotal" | "factor" | "floor";
};

export type PublicCandidate = {
  id: string;
  name: string;
  companyName: string;
  logoPath: string;
};

export type RecordedGuess = GuessFlags & {
  modelId: string | null;
  turn: number;
  /** Present on an origin guess that names the origin without a model. */
  origin?: Origin | null;
};

export type PastGuess = {
  id: string;
  name: string;
  companyName: string;
  logoPath: string;
  message: number;
  wrong: Array<"company" | "origin">;
};

/** An origin as the Origin buttons and the result show it. */
export type OriginChoice = { id: Origin; name: string; flag: string };

/** What an Origin round shows: the buttons, then the guess and the answer once it is over. */
export type OriginView = {
  choices: OriginChoice[];
  guessed: OriginChoice | null;
  actual: OriginChoice | null;
};

export type PublicGame = {
  id: string;
  gameMode: string;
  poolKey?: string | null;
  poolLabel: string;
  noHint: boolean;
  hintsAllowed: boolean;
  hintCosts: Record<HintKey, number>;
  status: GameStatus;
  messageNumber: number;
  messageLimit: number;
  awaitingGuess: boolean;
  given: { key: TraitKey; label: string; value: string }[];
  feedback: null | {
    company: "match" | "miss" | null;
    origin: "match" | "miss" | null;
    companyValue: string | null;
    originValue: string | null;
  };
  hints: Record<HintKey, string | null>;
  candidates: PublicCandidate[];
  pastGuesses: PastGuess[];
  /** Origin rounds only. */
  origin?: OriginView;
  transcript: { turn: number; role: "user" | "assistant"; content: string }[];
  model?: {
    name: string;
    companyName: string;
    logoPath: string;
    origin: string;
    year: number;
    size: string;
  };
  difficulty?: Difficulty | null;
  score?: number;
  breakdown?: ScoreLine[];
  explanation?: string[];
};

const traitOrder: TraitKey[] = ["company", "origin", "year", "size"];

export function roundHalfUp(value: number): number {
  return Math.round(value);
}

export function buildTraits(models: Array<FrozenModel & { id: string }>): Traits {
  const record: Record<string, FrozenModel> = {};
  for (const model of models) {
    const { id, ...rest } = model;
    record[id] = rest;
  }
  const given = traitOrder.filter((key) => {
    const values = models.map((model) => traitValue(model, key));
    return new Set(values).size === 1;
  });
  return { given, models: record };
}

function traitValue(model: FrozenModel, key: TraitKey): string {
  if (key === "company") return model.companyId;
  if (key === "origin") return model.origin;
  if (key === "year") return String(model.year);
  return model.size;
}

export function compareGuess(hidden: FrozenModel, guess: FrozenModel): GuessFlags {
  return {
    modelCorrect: false,
    companyCorrect: hidden.companyId === guess.companyId,
    originCorrect: hidden.origin === guess.origin,
  };
}

export function compareModel(hiddenId: string, guessId: string, hidden: FrozenModel, guess: FrozenModel): GuessFlags {
  return { ...compareGuess(hidden, guess), modelCorrect: hiddenId === guessId };
}

export type Known = {
  companyId?: string;
  origin?: Origin;
  year?: number;
  size?: Size;
};

export function knownValues(input: {
  traits: Traits;
  hidden: FrozenModel;
  guesses: GuessFlags[];
  hints: HintKey[];
  noHint: boolean;
}): Known {
  const known: Known = {};
  const { traits, hidden, guesses, hints, noHint } = input;
  if (traits.given.includes("company") || hints.includes("company")) known.companyId = hidden.companyId;
  if (traits.given.includes("origin") || hints.includes("origin")) known.origin = hidden.origin;
  if (traits.given.includes("year") || hints.includes("year")) known.year = hidden.year;
  if (traits.given.includes("size") || hints.includes("size")) known.size = hidden.size;
  if (!noHint) {
    if (guesses.some((guess) => guess.companyCorrect)) known.companyId = hidden.companyId;
    if (guesses.some((guess) => guess.originCorrect)) known.origin = hidden.origin;
  }
  return known;
}

export function hintOffered(input: {
  key: HintKey;
  traits: Traits;
  hidden: FrozenModel;
  guesses: GuessFlags[];
  hints: HintKey[];
  noHint: boolean;
}): boolean {
  if (input.noHint || input.hints.includes(input.key)) return false;
  const known = knownValues(input);
  if (input.key === "company") return known.companyId === undefined;
  if (input.key === "origin") return known.origin === undefined;
  if (input.key === "year") return known.year === undefined;
  return known.size === undefined;
}

export function missedGuesses(traits: Traits, guesses: RecordedGuess[], noHint: boolean): PastGuess[] {
  const given = new Set(traits.given);
  return [...guesses]
    .filter((guess) => guess.modelId && !guess.modelCorrect && traits.models[guess.modelId])
    .sort((a, b) => b.turn - a.turn)
    .map((guess) => {
      const model = traits.models[guess.modelId as string] as FrozenModel;
      const wrong: PastGuess["wrong"] = [];
      if (!noHint) {
        if (!given.has("company") && !guess.companyCorrect) wrong.push("company");
        if (!given.has("origin") && !guess.originCorrect) wrong.push("origin");
      }
      return {
        id: guess.modelId as string,
        name: model.name,
        companyName: model.companyName,
        logoPath: model.logoPath,
        message: guess.turn,
        wrong,
      };
    });
}

export function eliminatedCompanyIds(
  traits: Traits,
  guesses: Array<{ modelId: string | null; companyCorrect: boolean }>,
  noHint: boolean,
): string[] {
  if (noHint) return [];
  const companies = new Set<string>();
  for (const guess of guesses) {
    if (guess.companyCorrect || !guess.modelId) continue;
    const companyId = traits.models[guess.modelId]?.companyId;
    if (companyId) companies.add(companyId);
  }
  return [...companies];
}

function isOrigin(value: string | null | undefined): value is Origin {
  return typeof value === "string" && value !== "";
}

/** Origins a guess has ruled out. A model guess uses that model's origin; an origin guess uses its own. */
export function eliminatedOrigins(
  traits: Traits,
  guesses: Array<{ modelId: string | null; originCorrect: boolean; origin?: string | null }>,
  noHint: boolean,
): Origin[] {
  if (noHint) return [];
  const origins = new Set<Origin>();
  for (const guess of guesses) {
    if (guess.originCorrect) continue;
    const fromModel = guess.modelId ? traits.models[guess.modelId]?.origin : undefined;
    const origin = fromModel ?? (isOrigin(guess.origin) ? guess.origin : undefined);
    if (origin) origins.add(origin);
  }
  return [...origins];
}

/** The origin of a frozen model, with the name and flag frozen on it or the built-in ones. */
export function originChoiceOf(model: FrozenModel): OriginChoice {
  return {
    id: model.origin,
    name: model.originName ?? originLabel(model.origin),
    flag: model.originFlag ?? originFlag(model.origin),
  };
}

/** Every origin the pool holds, in the order the admin set. */
export function originChoices(traits: Traits): OriginChoice[] {
  const byId = new Map<Origin, { choice: OriginChoice; sort: number }>();
  for (const model of Object.values(traits.models)) {
    if (!byId.has(model.origin)) byId.set(model.origin, { choice: originChoiceOf(model), sort: model.originSort ?? 100 });
  }
  return [...byId.values()]
    .sort((a, b) => a.sort - b.sort || a.choice.name.localeCompare(b.choice.name))
    .map((entry) => entry.choice);
}

export function originChoiceFor(traits: Traits, id: Origin): OriginChoice {
  return (
    originChoices(traits).find((choice) => choice.id === id) ?? { id, name: originLabel(id), flag: originFlag(id) }
  );
}

export function filterCandidates(
  traits: Traits,
  known: Known,
  excludeIds: string[] = [],
  excludeCompanyIds: string[] = [],
  excludeOrigins: readonly string[] = [],
): PublicCandidate[] {
  const excluded = new Set(excludeIds);
  const excludedCompanies = new Set(excludeCompanyIds);
  const excludedOrigins = new Set(excludeOrigins);
  return Object.entries(traits.models)
    .filter(([id, model]) => {
      if (excluded.has(id)) return false;
      if (excludedCompanies.has(model.companyId)) return false;
      if (excludedOrigins.has(model.origin)) return false;
      if (known.companyId && model.companyId !== known.companyId) return false;
      if (known.origin && model.origin !== known.origin) return false;
      if (known.year !== undefined && model.year !== known.year) return false;
      if (known.size && model.size !== known.size) return false;
      return true;
    })
    .map(([id, model]) => ({
      id,
      name: model.name,
      companyName: model.companyName,
      logoPath: model.logoPath,
    }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName) || a.name.localeCompare(b.name));
}

/**
 * Only an HTTP 402 pauses the game for everyone. Matching words in the message
 * or body would let one user pause it with a crafted prompt echoed in an error.
 */
export function isCreditError(status: number | undefined): boolean {
  return status === 402;
}

/**
 * The breakdown plus a running total. Point lines add up. The first multiplier
 * is preceded by the score before any factor. Later factors multiply that
 * subtotal. The last factor matches the stored score when rounding drifts.
 */
export function scoreSteps(lines: ScoreLine[], score: number): ScoreStep[] {
  const steps: ScoreStep[] = [];
  let sum = 0;
  let product = 1;
  let multiplying = false;
  for (const line of lines) {
    if (line.label === "Floor at 0") {
      steps.push({ label: line.label, change: "", after: formatStepNumber(Math.max(0, score)), kind: "floor" });
      continue;
    }
    if (line.multiplier) {
      if (!multiplying) {
        steps.push({ label: "Before the multiplier", change: "", after: formatStepNumber(sum), kind: "subtotal" });
        multiplying = true;
      }
      const factor = Number(line.multiplier.replace(/^×/, ""));
      if (Number.isFinite(factor)) product *= factor;
      steps.push({
        label: line.label,
        change: line.multiplier,
        after: formatStepNumber(roundHalfUp(sum * product)),
        kind: "factor",
      });
      continue;
    }
    sum += line.points ?? 0;
    steps.push({
      label: line.label,
      change: formatStepNumber(line.points ?? 0),
      after: formatStepNumber(sum),
      kind: "points",
    });
  }
  const lastFactor = [...steps].reverse().find((step) => step.kind === "factor");
  if (lastFactor && !steps.some((step) => step.kind === "floor")) lastFactor.after = formatStepNumber(score);
  return steps;
}

/** min(tokenCap, tokenScale / tokens). Zero tokens is the cap, so the factor never divides by zero. */
export function tokenFactor(tokens: number, rules: Pick<Rules, "tokenScale" | "tokenCap">): number {
  if (tokens <= 0) return rules.tokenCap;
  return Math.min(rules.tokenCap, rules.tokenScale / tokens);
}

/** One successful reply, in the order it was played. `inputTokens` is the full prompt count OpenRouter returned. */
export type ScoreUsageTurn = {
  inputTokens: number;
  outputTokens: number;
};

export type ScoredUsageTurn = {
  /** Prompt tokens that count on this turn. The first turn is the full prompt. Later turns are the new player message. */
  inputTokens: number;
  /** Completion tokens for this reply. */
  outputTokens: number;
};

export type ScoreTokenCount = {
  inputTokens: number;
  outputTokens: number;
  /** Input plus output. This is the token total the score uses. */
  tokens: number;
  turns: ScoredUsageTurn[];
};

function finiteTokenCount(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * Tokens the score counts, from full prompt counts.
 *
 * The first turn counts its full prompt, so the system prompt is included once.
 * Each later turn counts this prompt minus the previous prompt minus the previous reply's output.
 * Each reply's completion tokens are added.
 * Reasoning tokens are not an input. Cache-read tokens are not added or subtracted.
 * Pass successful turns in play order. Leave failed calls out.
 */
export function scoreTokens(turns: readonly ScoreUsageTurn[]): ScoreTokenCount {
  const scored: ScoredUsageTurn[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  for (let index = 0; index < turns.length; index += 1) {
    const prompt = finiteTokenCount(turns[index].inputTokens);
    const output = finiteTokenCount(turns[index].outputTokens);
    const previous = index === 0 ? null : turns[index - 1];
    const input = previous
      ? prompt - finiteTokenCount(previous.inputTokens) - finiteTokenCount(previous.outputTokens)
      : prompt;
    scored.push({ inputTokens: input, outputTokens: output });
    inputTokens += input;
    outputTokens += output;
  }
  return { inputTokens, outputTokens, tokens: inputTokens + outputTokens, turns: scored };
}

export type ScoreInput = {
  rules: Rules;
  namedModel: boolean;
  originMatched: boolean;
  companyMatched: boolean;
  originGiven: boolean;
  companyGiven: boolean;
  tokens: number;
  noHint: boolean;
  hints: HintKey[];
  wrongGuesses?: number;
  /** Absent on a round that started before difficulties. Those rounds are not multiplied. */
  difficulty?: Difficulty | null;
};

const hintKeyList: readonly HintKey[] = ["company", "origin", "year", "size"];

/** Hints exist on Daily, All models, Company, Category, and Custom. Origin has none. */
export function gameModeAllowsHints(gameMode: string): boolean {
  return gameMode === "daily" || gameMode === "all" || gameMode === "company" || gameMode === "class" || gameMode === "custom";
}

/** Company already names the lab and its origin, so only the year and the size can be bought. */
export function hintAllowedForMode(gameMode: string, key: HintKey): boolean {
  if (!gameModeAllowsHints(gameMode)) return false;
  if (gameMode === "company") return key === "year" || key === "size";
  return true;
}

export function playableHints(value: readonly string[] | null | undefined): HintKey[] {
  if (!value) return [];
  return value.filter((key): key is HintKey => hintKeyList.includes(key as HintKey));
}

export function scoreRound(input: ScoreInput): { score: number; breakdown: ScoreLine[]; explanation: string[] } {
  const { rules } = input;
  const wrongGuesses = input.wrongGuesses ?? 0;
  const originKnown = input.originGiven || input.hints.includes("origin");
  const companyKnown = input.companyGiven || input.hints.includes("company");
  const factor = tokenFactor(input.tokens, rules);
  const boughtHints = playableHints(input.hints);
  const noHintMode = input.noHint && boughtHints.length === 0;
  const noHintFactor = noHintMode ? rules.noHintMultiplier : 1;
  const difficultyFactor = input.difficulty ? rules.difficultyMultipliers[input.difficulty] : 1;

  let base = 0;
  const breakdown: ScoreLine[] = [];
  if (input.namedModel) {
    base = rules.modelBase;
    breakdown.push({ label: "Named the model", points: rules.modelBase });
  } else {
    if (input.originMatched && !originKnown) {
      base += rules.originPoints;
      breakdown.push({ label: "Origin", points: rules.originPoints });
    }
    if (input.companyMatched && !companyKnown) {
      base += rules.companyPoints;
      breakdown.push({ label: "Company", points: rules.companyPoints });
    }
    if (base === 0) breakdown.push({ label: "Base", points: 0 });
  }

  let penalties = 0;
  for (const hint of boughtHints) {
    const cost = rules.hintCosts[hint];
    penalties += cost;
    breakdown.push({ label: `${hintNames[hint]} hint`, points: -cost });
  }
  if (wrongGuesses > 0) {
    const cost = rules.wrongGuessCost * wrongGuesses;
    penalties += cost;
    breakdown.push({ label: `Wrong guesses · ${wrongGuesses}`, points: -cost });
  }

  const subtotal = base - penalties;
  const total = roundHalfUp(subtotal * factor * noHintFactor * difficultyFactor);
  breakdown.push({
    label: `Tokens · ${formatInt(input.tokens)} tokens`,
    points: null,
    multiplier: `×${formatFactor(factor)}`,
  });
  if (noHintMode) {
    breakdown.push({ label: "No-hint", points: null, multiplier: `×${formatFactor(noHintFactor)}` });
  }
  if (input.difficulty) {
    breakdown.push({
      label: `Difficulty · ${difficultyLabel[input.difficulty]}`,
      points: null,
      multiplier: `×${formatFactor(difficultyFactor)}`,
    });
  }
  const score = Math.max(0, total);
  if (total < 0) breakdown.push({ label: "Floor at 0", points: score - total });

  return {
    score,
    breakdown,
    explanation: explainScore(input, base, penalties, total, noHintMode, difficultyFactor, boughtHints, factor),
  };
}

export function toPublicGame(input: {
  id: string;
  gameMode: string;
  poolKey: string | null;
  difficulty?: Difficulty | null;
  noHint: boolean;
  status: GameStatus;
  messageCount: number;
  awaitingGuess: boolean;
  rules: Rules;
  traits: Traits;
  modelId: string;
  hints: HintKey[];
  guesses: RecordedGuess[];
  guessedModelIds: string[];
  transcript: PublicGame["transcript"];
  score: number | null;
  breakdown: ScoreLine[] | null;
  explanation: string[] | null;
}): PublicGame {
  const hidden = input.traits.models[input.modelId];
  if (!hidden) throw new Error("Frozen traits are missing the hidden model.");
  const known = knownValues({
    traits: input.traits,
    hidden,
    guesses: input.guesses,
    hints: input.hints,
    noHint: input.noHint,
  });
  const hints = playableHints(input.hints);
  const originGiven = input.traits.given.includes("origin");
  const companyGiven = input.traits.given.includes("company");
  const originMatched = input.guesses.some((guess) => guess.originCorrect);
  const companyMatched = input.guesses.some((guess) => guess.companyCorrect);
  const showFeedback = !input.noHint && input.guesses.length > 0 && input.gameMode !== "origin";

  const game: PublicGame = {
    id: input.id,
    gameMode: input.gameMode,
    poolKey: input.poolKey,
    poolLabel: poolLabel(input.gameMode, input.poolKey, input.traits, input.difficulty),
    difficulty: input.difficulty ?? null,
    noHint: input.noHint,
    hintsAllowed: input.rules.hintsAllowed,
    hintCosts: input.rules.hintCosts,
    status: input.status,
    messageNumber: input.messageCount,
    messageLimit: input.rules.messageLimit,
    awaitingGuess: input.awaitingGuess,
    given: givenRows(input.traits, hidden),
    feedback: showFeedback
      ? {
          company: companyGiven ? null : companyMatched ? "match" : "miss",
          origin: originGiven ? null : originMatched ? "match" : "miss",
          companyValue: !companyGiven && companyMatched ? hidden.companyName : null,
          originValue: !originGiven && originMatched ? originLabel(hidden.origin) : null,
        }
      : null,
    hints: {
      company: hints.includes("company") ? displayValue(hidden, "company") : null,
      origin: hints.includes("origin") ? displayValue(hidden, "origin") : null,
      year: hints.includes("year") ? displayValue(hidden, "year") : null,
      size: hints.includes("size") ? displayValue(hidden, "size") : null,
    },
    candidates:
      input.gameMode === "origin"
        ? []
        : filterCandidates(
            input.traits,
            known,
            input.guessedModelIds,
            eliminatedCompanyIds(input.traits, input.guesses, input.noHint),
            eliminatedOrigins(input.traits, input.guesses, input.noHint),
          ),
    pastGuesses: input.gameMode === "origin" ? [] : missedGuesses(input.traits, input.guesses, input.noHint),
    transcript: input.transcript,
  };

  if (input.gameMode === "origin") {
    const guessedId = input.guesses.find((guess) => guess.origin)?.origin ?? null;
    game.origin = {
      choices: originChoices(input.traits),
      guessed: guessedId ? originChoiceFor(input.traits, guessedId) : null,
      actual: input.status !== "active" ? originChoiceOf(hidden) : null,
    };
  }

  if (input.status !== "active") {
    game.model = {
      name: hidden.name,
      companyName: hidden.companyName,
      logoPath: hidden.logoPath,
      origin: originLabel(hidden.origin),
      year: hidden.year,
      size: sizeLabel(hidden.size),
    };
    if (input.score !== null && input.breakdown && input.explanation) {
      game.score = input.score;
      game.breakdown = input.breakdown;
      game.explanation = input.explanation;
    }
  }
  return game;
}
