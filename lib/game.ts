import type { Rules } from "./config";
import { difficultyLabel, type Difficulty } from "./difficulty";

export type Region = "us" | "cn" | "eu";
export type Size = "nano" | "small" | "medium" | "large" | "xxl";
export type TraitKey = "company" | "region" | "year" | "size";
export type HintKey = "company" | "region" | "year" | "size";
export type GameStatus = "active" | "solved" | "miss" | "given_up";

/** A round counts as played once it is solved, not solved, or given up. */
export const finishedGameStatuses = ["solved", "miss", "given_up"] as const satisfies readonly GameStatus[];

export function isFinishedGame(status: string): boolean {
  return (finishedGameStatuses as readonly string[]).includes(status);
}

export type FrozenModel = {
  name: string;
  companyId: string;
  companyName: string;
  region: Region;
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
  regionCorrect: boolean;
};

export type ScoreLine = {
  label: string;
  /** Point change for the base, a penalty, or the floor. Null on a multiplier row. */
  points: number | null;
  /** Set on a multiplier row. The card shows this instead of points. */
  multiplier?: string;
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
  /** Present on a region guess that names the region without a model. */
  region?: Region | null;
};

export type PastGuess = {
  id: string;
  name: string;
  companyName: string;
  logoPath: string;
  wrong: Array<"company" | "region">;
};

export type PublicGame = {
  id: string;
  category: string;
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
    region: "match" | "miss" | null;
    companyValue: string | null;
    regionValue: string | null;
  };
  hints: Record<HintKey, string | null>;
  candidates: PublicCandidate[];
  pastGuesses: PastGuess[];
  transcript: { turn: number; role: "user" | "assistant"; content: string }[];
  model?: {
    name: string;
    companyName: string;
    logoPath: string;
    region: string;
    year: number;
    size: string;
  };
  difficulty?: Difficulty | null;
  score?: number;
  breakdown?: ScoreLine[];
  explanation?: string[];
};

const traitOrder: TraitKey[] = ["company", "region", "year", "size"];

export function regionLabel(region: Region): string {
  if (region === "us") return "USA";
  if (region === "cn") return "China";
  return "Europe";
}

export function sizeLabel(size: Size): string {
  if (size === "nano") return "Nano";
  if (size === "small") return "Small";
  if (size === "medium") return "Medium";
  if (size === "large") return "Large";
  return "XXL";
}

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
  if (key === "region") return model.region;
  if (key === "year") return String(model.year);
  return model.size;
}

export function compareGuess(hidden: FrozenModel, guess: FrozenModel): GuessFlags {
  return {
    modelCorrect: false,
    companyCorrect: hidden.companyId === guess.companyId,
    regionCorrect: hidden.region === guess.region,
  };
}

export function compareModel(hiddenId: string, guessId: string, hidden: FrozenModel, guess: FrozenModel): GuessFlags {
  return { ...compareGuess(hidden, guess), modelCorrect: hiddenId === guessId };
}

export type Known = {
  companyId?: string;
  region?: Region;
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
  if (traits.given.includes("region") || hints.includes("region")) known.region = hidden.region;
  if (traits.given.includes("year") || hints.includes("year")) known.year = hidden.year;
  if (traits.given.includes("size") || hints.includes("size")) known.size = hidden.size;
  if (!noHint) {
    if (guesses.some((guess) => guess.companyCorrect)) known.companyId = hidden.companyId;
    if (guesses.some((guess) => guess.regionCorrect)) known.region = hidden.region;
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
  if (input.key === "region") return known.region === undefined;
  if (input.key === "year") return known.year === undefined;
  return known.size === undefined;
}

export function missedGuesses(traits: Traits, guesses: RecordedGuess[], noHint: boolean): PastGuess[] {
  const given = new Set(traits.given);
  return [...guesses]
    .filter((guess) => guess.modelId && !guess.modelCorrect && traits.models[guess.modelId])
    .sort((a, b) => a.turn - b.turn)
    .map((guess) => {
      const model = traits.models[guess.modelId as string] as FrozenModel;
      const wrong: PastGuess["wrong"] = [];
      if (!noHint) {
        if (!given.has("company") && !guess.companyCorrect) wrong.push("company");
        if (!given.has("region") && !guess.regionCorrect) wrong.push("region");
      }
      return {
        id: guess.modelId as string,
        name: model.name,
        companyName: model.companyName,
        logoPath: model.logoPath,
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

function isRegion(value: string | null | undefined): value is Region {
  return value === "us" || value === "cn" || value === "eu";
}

/** Regions a guess has ruled out. A model guess uses that model's region; a region guess uses its own. */
export function eliminatedRegions(
  traits: Traits,
  guesses: Array<{ modelId: string | null; regionCorrect: boolean; region?: string | null }>,
  noHint: boolean,
): Region[] {
  if (noHint) return [];
  const regions = new Set<Region>();
  for (const guess of guesses) {
    if (guess.regionCorrect) continue;
    const fromModel = guess.modelId ? traits.models[guess.modelId]?.region : undefined;
    const region = fromModel ?? (isRegion(guess.region) ? guess.region : undefined);
    if (region) regions.add(region);
  }
  return [...regions];
}

export function filterCandidates(
  traits: Traits,
  known: Known,
  excludeIds: string[] = [],
  excludeCompanyIds: string[] = [],
  excludeRegions: readonly string[] = [],
): PublicCandidate[] {
  const excluded = new Set(excludeIds);
  const excludedCompanies = new Set(excludeCompanyIds);
  const excludedRegions = new Set(excludeRegions);
  return Object.entries(traits.models)
    .filter(([id, model]) => {
      if (excluded.has(id)) return false;
      if (excludedCompanies.has(model.companyId)) return false;
      if (excludedRegions.has(model.region)) return false;
      if (known.companyId && model.companyId !== known.companyId) return false;
      if (known.region && model.region !== known.region) return false;
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

export function isCreditError(status: number | undefined, message: string): boolean {
  if (status === 402) return true;
  const text = message.toLowerCase();
  return (
    text.includes("credit") ||
    text.includes("insufficient") ||
    text.includes("payment required") ||
    text.includes("quota")
  );
}

function formatInt(value: number): string {
  return Math.trunc(value).toLocaleString("en-US");
}

export function formatFactor(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

/** min(tokenCap, tokenScale / tokens). Zero tokens is the cap, so the factor never divides by zero. */
export function tokenFactor(tokens: number, rules: Pick<Rules, "tokenScale" | "tokenCap">): number {
  if (tokens <= 0) return rules.tokenCap;
  return Math.min(rules.tokenCap, rules.tokenScale / tokens);
}

export type ScoreInput = {
  rules: Rules;
  namedModel: boolean;
  regionMatched: boolean;
  companyMatched: boolean;
  regionGiven: boolean;
  companyGiven: boolean;
  tokens: number;
  noHint: boolean;
  hints: HintKey[];
  wrongGuesses?: number;
  /** Absent on a round that started before difficulties. Those rounds are not multiplied. */
  difficulty?: Difficulty | null;
};

const hintNames: Record<HintKey, string> = {
  company: "Company",
  region: "Region",
  year: "Year",
  size: "Size",
};

const hintKeyList: readonly HintKey[] = ["company", "region", "year", "size"];

/** Hints exist only on Daily, All models, and Custom. Every other category, including class and region, has none. */
export function categoryAllowsHints(category: string): boolean {
  return category === "daily" || category === "all" || category === "custom";
}

export function playableHints(value: readonly string[] | null | undefined): HintKey[] {
  if (!value) return [];
  return value.filter((key): key is HintKey => hintKeyList.includes(key as HintKey));
}

export function scoreRound(input: ScoreInput): { score: number; breakdown: ScoreLine[]; explanation: string[] } {
  const { rules } = input;
  const wrongGuesses = input.wrongGuesses ?? 0;
  const regionKnown = input.regionGiven || input.hints.includes("region");
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
    if (input.regionMatched && !regionKnown) {
      base += rules.regionPoints;
      breakdown.push({ label: "Region", points: rules.regionPoints });
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

  return { score, breakdown, explanation: explainScore(input, base, penalties, total, noHintMode, difficultyFactor) };
}

function explainScore(
  input: ScoreInput,
  base: number,
  penalties: number,
  total: number,
  noHintMode: boolean,
  difficultyFactor: number,
): string[] {
  const { rules } = input;
  const wrongGuesses = input.wrongGuesses ?? 0;
  const bought = playableHints(input.hints);
  const regionKnown = input.regionGiven || bought.includes("region");
  const companyKnown = input.companyGiven || bought.includes("company");
  const lines = [
    `Your score starts from the base and subtracts penalties. That subtotal is multiplied by ${formatInt(rules.tokenScale)} divided by the tokens used, capped at ${formatFactor(rules.tokenCap)}, then by ${formatFactor(rules.noHintMultiplier)}× if you played with no hints, then by the difficulty. It is rounded and never goes below 0.`,
  ];
  if (input.namedModel) {
    lines.push(`Base: ${formatInt(rules.modelBase)} for naming the model.`);
  } else if (base === 0) {
    lines.push("Base: 0.");
  } else if (input.regionMatched && !regionKnown && input.companyMatched && !companyKnown) {
    lines.push(
      `Base: ${formatInt(base)} — region ${formatInt(rules.regionPoints)}, company ${formatInt(rules.companyPoints)}.`,
    );
  } else if (input.regionMatched && !regionKnown) {
    lines.push(`Base: ${formatInt(rules.regionPoints)} for the region.`);
  } else {
    lines.push(`Base: ${formatInt(rules.companyPoints)} for the company.`);
  }

  if (bought.length === 0) {
    lines.push("Hints: none.");
  } else {
    const parts = bought.map((hint) => `${hintNames[hint]} −${formatInt(rules.hintCosts[hint])}`);
    lines.push(`Hints: ${parts.join(". ")}.`);
  }
  if (wrongGuesses === 0) {
    lines.push("Wrong guesses: none.");
  } else {
    lines.push(`Wrong guesses: ${wrongGuesses} × −${formatInt(rules.wrongGuessCost)}.`);
  }
  lines.push(`Before the multiplier: ${formatInt(base)} − ${formatInt(penalties)} = ${formatInt(base - penalties)}.`);

  lines.push(tokenExplanation(input.tokens, rules));
  if (noHintMode) lines.push(`No-hint: ×${formatFactor(rules.noHintMultiplier)}.`);
  if (input.difficulty) lines.push(`Difficulty: ${difficultyLabel[input.difficulty]} ×${formatFactor(difficultyFactor)}.`);
  if (total < 0) lines.push("The total came to less than 0, so it is shown as 0.");
  return lines;
}

function tokenExplanation(tokens: number, rules: Rules): string {
  const factor = tokenFactor(tokens, rules);
  const shown = formatFactor(factor);
  if (tokens <= 0) return `Tokens: 0. Token factor ×${shown}.`;
  const ratio = `${formatInt(rules.tokenScale)}/${formatInt(tokens)}`;
  if (tokens * rules.tokenCap < rules.tokenScale) {
    return `Tokens: ${formatInt(tokens)}. Token factor ×${shown} (${ratio}, capped at ${formatFactor(rules.tokenCap)}).`;
  }
  return `Tokens: ${formatInt(tokens)}. Token factor ×${shown} (${ratio}).`;
}

export function poolLabel(category: string, poolKey: string | null, traits: Traits, difficulty?: Difficulty | null): string {
  const first = Object.values(traits.models)[0];
  if (category === "all") return difficulty ? `All models · ${difficultyLabel[difficulty]}` : "All models";
  if (category === "daily") return "Daily";
  if (category === "origin") return "Origin";
  if (category === "latest") return "Latest";
  if (category === "company") {
    const name = Object.values(traits.models).find((model) => model.companyId === poolKey)?.companyName;
    return `Company · ${name ?? first?.companyName ?? poolKey ?? ""}`;
  }
  if (category === "region" && (poolKey === "us" || poolKey === "cn" || poolKey === "eu")) {
    return `Region · ${regionLabel(poolKey)}`;
  }
  return category;
}

export function givenRows(traits: Traits, hidden: FrozenModel): PublicGame["given"] {
  return traits.given.map((key) => ({
      key,
      label: traitLabel(key),
      value: displayValue(hidden, key),
    }));
}

function traitLabel(key: TraitKey): string {
  if (key === "company") return "Company";
  if (key === "region") return "Region";
  if (key === "year") return "Year";
  return "Size";
}

function displayValue(model: FrozenModel, key: TraitKey): string {
  if (key === "company") return model.companyName;
  if (key === "region") return regionLabel(model.region);
  if (key === "year") return String(model.year);
  return sizeLabel(model.size);
}

export function toPublicGame(input: {
  id: string;
  category: string;
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
  const regionGiven = input.traits.given.includes("region");
  const companyGiven = input.traits.given.includes("company");
  const regionMatched = input.guesses.some((guess) => guess.regionCorrect);
  const companyMatched = input.guesses.some((guess) => guess.companyCorrect);
  const showFeedback = !input.noHint && input.guesses.length > 0 && input.category !== "origin";

  const game: PublicGame = {
    id: input.id,
    category: input.category,
    poolLabel: poolLabel(input.category, input.poolKey, input.traits, input.difficulty),
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
          region: regionGiven ? null : regionMatched ? "match" : "miss",
          companyValue: !companyGiven && companyMatched ? hidden.companyName : null,
          regionValue: !regionGiven && regionMatched ? regionLabel(hidden.region) : null,
        }
      : null,
    hints: {
      company: hints.includes("company") ? displayValue(hidden, "company") : null,
      region: hints.includes("region") ? displayValue(hidden, "region") : null,
      year: hints.includes("year") ? displayValue(hidden, "year") : null,
      size: hints.includes("size") ? displayValue(hidden, "size") : null,
    },
    candidates: filterCandidates(
      input.traits,
      known,
      input.guessedModelIds,
      eliminatedCompanyIds(input.traits, input.guesses, input.noHint),
      eliminatedRegions(input.traits, input.guesses, input.noHint),
    ),
    pastGuesses: missedGuesses(input.traits, input.guesses, input.noHint),
    transcript: input.transcript,
  };

  if (input.status !== "active") {
    game.model = {
      name: hidden.name,
      companyName: hidden.companyName,
      logoPath: hidden.logoPath,
      region: regionLabel(hidden.region),
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
