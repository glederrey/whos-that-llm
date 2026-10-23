import type { Rules } from "./config";
import { difficultyLabel, type Difficulty } from "./difficulty";
import type { FrozenModel, HintKey, PublicGame, Origin, ScoreInput, Size, TraitKey, Traits } from "./game";

/** Name of a built-in origin. An origin an admin added shows its id until the round's frozen name is used. */
export function originLabel(origin: Origin): string {
  if (origin === "us") return "USA";
  if (origin === "cn") return "China";
  if (origin === "eu") return "Europe";
  return origin.charAt(0).toUpperCase() + origin.slice(1);
}

export function originFlag(origin: Origin): string {
  if (origin === "us") return "🇺🇸";
  if (origin === "cn") return "🇨🇳";
  if (origin === "eu") return "🇪🇺";
  return "🏳️";
}

export function sizeLabel(size: Size): string {
  if (size === "nano") return "Nano";
  if (size === "small") return "Small";
  if (size === "medium") return "Medium";
  if (size === "large") return "Large";
  return "XXL";
}

/** Label of the score card row that counts the models a round drew from. */
export const poolSizeLabel = "Pool";

/** Value of that row: the pool size with its unit, so the number reads as the choices on offer. */
export function poolSizeValue(size: number): string {
  return `${size.toLocaleString("en-US")} ${size === 1 ? "model" : "models"}`;
}

/** Size of the pool snapshot stored on a game. Null when the snapshot is missing or empty. */
export function poolSizeFrom(ids: unknown): number | null {
  return Array.isArray(ids) && ids.length > 0 ? ids.length : null;
}

export function formatInt(value: number): string {
  return Math.trunc(value).toLocaleString("en-US");
}

export function formatStepNumber(value: number): string {
  return Math.trunc(value).toLocaleString("en-US");
}

export function formatFactor(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

export const hintNames: Record<HintKey, string> = {
  company: "Company",
  origin: "Origin",
  year: "Year",
  size: "Size",
};

export function explainScore(
  input: ScoreInput,
  base: number,
  penalties: number,
  total: number,
  noHintMode: boolean,
  difficultyFactor: number,
  bought: HintKey[],
  factor: number,
): string[] {
  const { rules } = input;
  const wrongGuesses = input.wrongGuesses ?? 0;
  const originKnown = input.originGiven || bought.includes("origin");
  const companyKnown = input.companyGiven || bought.includes("company");
  const lines = [
    `Your score starts from the base and subtracts penalties. That subtotal is multiplied by ${formatInt(rules.tokenScale)} divided by the tokens used, capped at ${formatFactor(rules.tokenCap)}, then by ${formatFactor(rules.noHintMultiplier)}× if you played with no hints, then by the difficulty. It is rounded and never goes below 0.`,
  ];
  if (input.namedModel) {
    lines.push(`Base: ${formatInt(rules.modelBase)} for naming the model.`);
  } else if (base === 0) {
    lines.push("Base: 0.");
  } else if (input.originMatched && !originKnown && input.companyMatched && !companyKnown) {
    lines.push(
      `Base: ${formatInt(base)} — origin ${formatInt(rules.originPoints)}, company ${formatInt(rules.companyPoints)}.`,
    );
  } else if (input.originMatched && !originKnown) {
    lines.push(`Base: ${formatInt(rules.originPoints)} for the origin.`);
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

  lines.push(tokenExplanation(input.tokens, rules, factor));
  if (noHintMode) lines.push(`No-hint: ×${formatFactor(rules.noHintMultiplier)}.`);
  if (input.difficulty) lines.push(`Difficulty: ${difficultyLabel[input.difficulty]} ×${formatFactor(difficultyFactor)}.`);
  if (total < 0) lines.push("The total came to less than 0, so it is shown as 0.");
  return lines;
}

function tokenExplanation(tokens: number, rules: Rules, factor: number): string {
  const shown = formatFactor(factor);
  if (tokens <= 0) return `Tokens: 0. Token factor ×${shown}.`;
  const ratio = `${formatInt(rules.tokenScale)}/${formatInt(tokens)}`;
  if (tokens * rules.tokenCap < rules.tokenScale) {
    return `Tokens: ${formatInt(tokens)}. Token factor ×${shown} (${ratio}, capped at ${formatFactor(rules.tokenCap)}).`;
  }
  return `Tokens: ${formatInt(tokens)}. Token factor ×${shown} (${ratio}).`;
}

export function poolLabel(gameMode: string, poolKey: string | null, traits: Traits, difficulty?: Difficulty | null): string {
  const first = Object.values(traits.models)[0];
  if (gameMode === "all") return difficulty ? `All models · ${difficultyLabel[difficulty]}` : "All models";
  if (gameMode === "daily") return difficulty ? `Daily · ${difficultyLabel[difficulty]}` : "Daily";
  if (gameMode === "class") return "Category";
  if (gameMode === "origin") return "Origin";
  if (gameMode === "custom") return "Custom";
  if (gameMode === "latest") return "Latest";
  if (gameMode === "company") {
    const name = Object.values(traits.models).find((model) => model.companyId === poolKey)?.companyName;
    return `Company · ${name ?? first?.companyName ?? poolKey ?? ""}`;
  }
  return gameMode;
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
  if (key === "origin") return "Origin";
  if (key === "year") return "Year";
  return "Size";
}

export function displayValue(model: FrozenModel, key: TraitKey): string {
  if (key === "company") return model.companyName;
  if (key === "origin") return originLabel(model.origin);
  if (key === "year") return String(model.year);
  return sizeLabel(model.size);
}

