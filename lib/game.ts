import type { Rules } from "./config";

export type Region = "us" | "cn" | "eu";
export type Size = "small" | "medium" | "large";
export type TraitKey = "company" | "family" | "region" | "year" | "size";
export type HintKey = "year" | "size";
export type GameStatus = "active" | "solved" | "miss" | "given_up";

export type FrozenModel = {
  name: string;
  companyId: string;
  companyName: string;
  familyId: string;
  familyName: string;
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
  familyCorrect: boolean;
  regionCorrect: boolean;
};

export type ScoreLine = { label: string; points: number };

export type PublicCandidate = {
  id: string;
  name: string;
  companyName: string;
  logoPath: string;
};

export type PublicGame = {
  id: string;
  category: string;
  poolLabel: string;
  noHint: boolean;
  hintsAllowed: boolean;
  hintCost: number;
  status: GameStatus;
  messageNumber: number;
  messageLimit: number;
  awaitingGuess: boolean;
  given: { key: TraitKey; label: string; value: string }[];
  feedback: null | {
    company: "match" | "miss" | null;
    region: "match" | "miss" | null;
    familySame: boolean;
    companyValue: string | null;
    regionValue: string | null;
    familyValue: string | null;
  };
  hints: { year: string | null; size: string | null };
  candidates: PublicCandidate[];
  transcript: { turn: number; role: "user" | "assistant"; content: string }[];
  model?: {
    name: string;
    companyName: string;
    logoPath: string;
    region: string;
    family: string;
    year: number;
    size: string;
  };
  score?: number;
  breakdown?: ScoreLine[];
  explanation?: string[];
};

const traitOrder: TraitKey[] = ["company", "family", "region", "year", "size"];

export function regionLabel(region: Region): string {
  if (region === "us") return "USA";
  if (region === "cn") return "China";
  return "Europe";
}

export function sizeLabel(size: Size): string {
  if (size === "small") return "Small";
  if (size === "medium") return "Medium";
  return "Large";
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
  if (key === "family") return model.familyId;
  if (key === "region") return model.region;
  if (key === "year") return String(model.year);
  return model.size;
}

export function compareGuess(hidden: FrozenModel, guess: FrozenModel): GuessFlags {
  return {
    modelCorrect: false,
    companyCorrect: hidden.companyId === guess.companyId,
    familyCorrect: hidden.familyId === guess.familyId,
    regionCorrect: hidden.region === guess.region,
  };
}

export function compareModel(hiddenId: string, guessId: string, hidden: FrozenModel, guess: FrozenModel): GuessFlags {
  return { ...compareGuess(hidden, guess), modelCorrect: hiddenId === guessId };
}

export type Known = {
  companyId?: string;
  familyId?: string;
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
  if (traits.given.includes("company")) known.companyId = hidden.companyId;
  if (traits.given.includes("family")) known.familyId = hidden.familyId;
  if (traits.given.includes("region")) known.region = hidden.region;
  if (traits.given.includes("year") || hints.includes("year")) known.year = hidden.year;
  if (traits.given.includes("size") || hints.includes("size")) known.size = hidden.size;
  if (!noHint) {
    if (guesses.some((guess) => guess.companyCorrect)) known.companyId = hidden.companyId;
    if (guesses.some((guess) => guess.familyCorrect)) known.familyId = hidden.familyId;
    if (guesses.some((guess) => guess.regionCorrect)) known.region = hidden.region;
  }
  return known;
}

export function filterCandidates(
  traits: Traits,
  known: Known,
  excludeIds: string[] = [],
): PublicCandidate[] {
  const excluded = new Set(excludeIds);
  return Object.entries(traits.models)
    .filter(([id, model]) => {
      if (excluded.has(id)) return false;
      if (known.companyId && model.companyId !== known.companyId) return false;
      if (known.familyId && model.familyId !== known.familyId) return false;
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

function formatFactor(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

export function scoreRound(input: {
  rules: Rules;
  namedModel: boolean;
  regionMatched: boolean;
  companyMatched: boolean;
  regionGiven: boolean;
  companyGiven: boolean;
  tokens: number;
  messages: number;
  noHint: boolean;
  hints: HintKey[];
}): { score: number; breakdown: ScoreLine[]; explanation: string[] } {
  const { rules } = input;
  const messages = input.messages;
  const tokenFactor = input.tokens === 0 ? 1 : rules.tokenScale / input.tokens;
  const messageFactor = rules.messageLimit / messages;
  const noHintFactor = input.noHint ? rules.noHintMultiplier : 1;

  let base = 0;
  const breakdown: ScoreLine[] = [];
  if (input.namedModel) {
    base = rules.modelBase;
    breakdown.push({ label: "Named the model", points: rules.modelBase });
  } else {
    if (input.regionMatched && !input.regionGiven) {
      base += rules.regionPoints;
      breakdown.push({ label: "Region", points: rules.regionPoints });
    }
    if (input.companyMatched && !input.companyGiven) {
      base += rules.companyPoints;
      breakdown.push({ label: "Company", points: rules.companyPoints });
    }
    if (base === 0) breakdown.push({ label: "Base", points: 0 });
  }

  const p0 = base;
  const p1 = roundHalfUp(base * tokenFactor);
  const p2 = roundHalfUp(base * tokenFactor * messageFactor);
  const p3 = roundHalfUp(base * tokenFactor * messageFactor * noHintFactor);

  breakdown.push({
    label: `Tokens · ${formatInt(input.tokens)} tokens · ×${formatFactor(tokenFactor)}`,
    points: p1 - p0,
  });
  breakdown.push({
    label: `Messages · ${messages} ${messages === 1 ? "reply" : "replies"} · ×${formatFactor(messageFactor)}`,
    points: p2 - p1,
  });
  if (input.noHint) {
    breakdown.push({
      label: `No-hint · ×${formatFactor(noHintFactor)}`,
      points: p3 - p2,
    });
  }
  for (const hint of input.hints) {
    breakdown.push({
      label: hint === "year" ? "Year" : "Size",
      points: -rules.hintCost,
    });
  }

  const score = p3 - rules.hintCost * input.hints.length;
  const explanation = explainScore(input, base);
  return { score, breakdown, explanation };
}

function explainScore(
  input: {
    rules: Rules;
    namedModel: boolean;
    regionMatched: boolean;
    companyMatched: boolean;
    regionGiven: boolean;
    companyGiven: boolean;
    tokens: number;
    messages: number;
    noHint: boolean;
    hints: HintKey[];
  },
  base: number,
): string[] {
  const { rules } = input;
  const lines = [
    "Your score starts from the base, multiplies by the token factor and the message factor, then by 1.5 if you played with no hints, then subtracts 100 for each hint.",
  ];
  if (input.namedModel) {
    lines.push(`Base: ${formatInt(rules.modelBase)} for naming the model.`);
  } else if (base === 0) {
    lines.push("Base: 0.");
  } else if (input.regionMatched && !input.regionGiven && input.companyMatched && !input.companyGiven) {
    lines.push(
      `Base: ${formatInt(base)} — region ${formatInt(rules.regionPoints)}, company ${formatInt(rules.companyPoints)}.`,
    );
  } else if (input.regionMatched && !input.regionGiven) {
    lines.push(`Base: ${formatInt(rules.regionPoints)} for the region.`);
  } else {
    lines.push(`Base: ${formatInt(rules.companyPoints)} for the company.`);
  }

  if (input.tokens === 0) {
    lines.push("Tokens: 0. Token factor 1.");
  } else {
    lines.push(
      `Tokens: ${formatInt(input.tokens)}. Token factor ${formatInt(rules.tokenScale)}/${formatInt(input.tokens)}.`,
    );
  }
  lines.push(
    `Messages: ${input.messages} ${input.messages === 1 ? "reply" : "replies"}. Message factor ${rules.messageLimit}/${input.messages}.`,
  );
  if (input.noHint) lines.push(`No-hint: ×${formatFactor(rules.noHintMultiplier)}.`);
  if (input.hints.length === 0) {
    lines.push("Hints: none.");
  } else {
    const parts = input.hints.map(
      (hint) => `${hint === "year" ? "Year" : "Size"} −${formatInt(rules.hintCost)}`,
    );
    lines.push(`Hints: ${parts.join(". ")}.`);
  }
  return lines;
}

export function poolLabel(category: string, poolKey: string | null, traits: Traits): string {
  const first = Object.values(traits.models)[0];
  if (category === "all") return "All models";
  if (category === "daily") return "Daily";
  if (category === "origin") return "Origin";
  if (category === "latest") return "Latest";
  if (category === "company") {
    const name = Object.values(traits.models).find((model) => model.companyId === poolKey)?.companyName;
    return `Company · ${name ?? first?.companyName ?? poolKey ?? ""}`;
  }
  if (category === "family") {
    const name = Object.values(traits.models).find((model) => model.familyId === poolKey)?.familyName;
    return `Family · ${name ?? first?.familyName ?? poolKey ?? ""}`;
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
  if (key === "family") return "Family";
  if (key === "region") return "Region";
  if (key === "year") return "Year";
  return "Size";
}

function displayValue(model: FrozenModel, key: TraitKey): string {
  if (key === "company") return model.companyName;
  if (key === "family") return model.familyName;
  if (key === "region") return regionLabel(model.region);
  if (key === "year") return String(model.year);
  return sizeLabel(model.size);
}

export function toPublicGame(input: {
  id: string;
  category: string;
  poolKey: string | null;
  noHint: boolean;
  status: GameStatus;
  messageCount: number;
  awaitingGuess: boolean;
  rules: Rules;
  traits: Traits;
  modelId: string;
  hints: HintKey[];
  guesses: GuessFlags[];
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
  const regionGiven = input.traits.given.includes("region");
  const companyGiven = input.traits.given.includes("company");
  const familyGiven = input.traits.given.includes("family");
  const regionMatched = input.guesses.some((guess) => guess.regionCorrect);
  const companyMatched = input.guesses.some((guess) => guess.companyCorrect);
  const familyMatched = input.guesses.some((guess) => guess.familyCorrect);
  const showFeedback = !input.noHint && input.guesses.length > 0 && input.category !== "origin";

  const game: PublicGame = {
    id: input.id,
    category: input.category,
    poolLabel: poolLabel(input.category, input.poolKey, input.traits),
    noHint: input.noHint,
    hintsAllowed: input.rules.hintsAllowed,
    hintCost: input.rules.hintCost,
    status: input.status,
    messageNumber: input.messageCount,
    messageLimit: input.rules.messageLimit,
    awaitingGuess: input.awaitingGuess,
    given: givenRows(input.traits, hidden),
    feedback: showFeedback
      ? {
          company: companyGiven ? null : companyMatched ? "match" : "miss",
          region: regionGiven ? null : regionMatched ? "match" : "miss",
          familySame: !familyGiven && familyMatched,
          companyValue: !companyGiven && companyMatched ? hidden.companyName : null,
          regionValue: !regionGiven && regionMatched ? regionLabel(hidden.region) : null,
          familyValue: !familyGiven && familyMatched ? hidden.familyName : null,
        }
      : null,
    hints: {
      year: input.hints.includes("year") ? String(hidden.year) : null,
      size: input.hints.includes("size") ? sizeLabel(hidden.size) : null,
    },
    candidates: filterCandidates(input.traits, known, input.guessedModelIds),
    transcript: input.transcript,
  };

  if (input.status !== "active") {
    game.model = {
      name: hidden.name,
      companyName: hidden.companyName,
      logoPath: hidden.logoPath,
      region: regionLabel(hidden.region),
      family: hidden.familyName,
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
