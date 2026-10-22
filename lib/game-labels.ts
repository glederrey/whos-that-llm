import type { Rules } from "./config";
import { difficultyLabel, type Difficulty } from "./difficulty";
import type { FrozenModel, HintKey, PublicGame, Region, ScoreInput, Size, TraitKey, Traits } from "./game";

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

/** Label of the score card row that counts the models a round drew from. */
export const poolSizeLabel = "Guessing from";

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
  region: "Region",
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
  if (gameMode === "latest") return "Latest";
  if (gameMode === "company") {
    const name = Object.values(traits.models).find((model) => model.companyId === poolKey)?.companyName;
    return `Company · ${name ?? first?.companyName ?? poolKey ?? ""}`;
  }
  if (gameMode === "region" && (poolKey === "us" || poolKey === "cn" || poolKey === "eu")) {
    return `Region · ${regionLabel(poolKey)}`;
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
  if (key === "region") return "Region";
  if (key === "year") return "Year";
  return "Size";
}

export function displayValue(model: FrozenModel, key: TraitKey): string {
  if (key === "company") return model.companyName;
  if (key === "region") return regionLabel(model.region);
  if (key === "year") return String(model.year);
  return sizeLabel(model.size);
}

