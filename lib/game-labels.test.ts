import assert from "node:assert/strict";
import test from "node:test";
import { rulesForGameMode } from "./config";
import {
  buildTraits,
  formatFactor,
  givenRows,
  poolLabel,
  regionLabel,
  scoreRound,
  scoreSteps,
  sizeLabel,
  type FrozenModel,
  type HintKey,
  type Region,
  type Size,
} from "./game";

const rules = rulesForGameMode(true);

const none = {
  namedModel: false,
  regionMatched: false,
  companyMatched: false,
  regionGiven: false,
  companyGiven: false,
  noHint: false,
  hints: [] as HintKey[],
};

const intro =
  "Your score starts from the base and subtracts penalties. That subtotal is multiplied by 10,000 divided by the tokens used, capped at 20, then by 2× if you played with no hints, then by the difficulty. It is rounded and never goes below 0.";

function frozen(
  name: string,
  companyId: string,
  region: Region,
  size: Size,
  year: number,
): FrozenModel & { id: string } {
  return { id: name, name, companyId, companyName: companyId.toUpperCase(), region, size, year, logoPath: "l" };
}

test("region and size labels", () => {
  assert.deepEqual((["us", "cn", "eu"] as Region[]).map(regionLabel), ["USA", "China", "Europe"]);
  assert.deepEqual(
    (["nano", "small", "medium", "large", "xxl"] as Size[]).map(sizeLabel),
    ["Nano", "Small", "Medium", "Large", "XXL"],
  );
});

test("formatFactor keeps three decimals and drops trailing zeros", () => {
  assert.deepEqual([3.7120001, 20, 0.5, 1 / 3, 0.0004].map(formatFactor), ["3.712", "20", "0.5", "0.333", "0"]);
});

test("pool labels per game mode", () => {
  const traits = buildTraits([frozen("a", "x", "us", "small", 2026), frozen("b", "y", "us", "small", 2026)]);
  assert.equal(poolLabel("all", null, traits), "All models");
  assert.equal(poolLabel("all", null, traits, "hard"), "All models · Hard");
  assert.equal(poolLabel("daily", null, traits), "Daily");
  assert.equal(poolLabel("daily", null, traits, "easy"), "Daily · Easy");
  assert.equal(poolLabel("class", "x", traits, "hard"), "Category");
  assert.equal(poolLabel("origin", null, traits), "Origin");
  assert.equal(poolLabel("latest", null, traits), "Latest");
  assert.equal(poolLabel("company", "x", traits), "Company · X");
  assert.equal(poolLabel("company", "zz", traits), "Company · X");
  assert.equal(poolLabel("company", null, traits), "Company · X");
  assert.equal(poolLabel("company", "q", { given: [], models: {} }), "Company · q");
  assert.equal(poolLabel("company", null, { given: [], models: {} }), "Company · ");
  assert.equal(poolLabel("region", "us", traits), "Region · USA");
  assert.equal(poolLabel("region", "cn", traits), "Region · China");
  assert.equal(poolLabel("region", "eu", traits), "Region · Europe");
  assert.equal(poolLabel("region", "xx", traits), "region");
  assert.equal(poolLabel("region", null, traits), "region");
  assert.equal(poolLabel("custom", null, traits), "custom");
});

test("given rows show the label and the displayed value of each shared trait", () => {
  const shared = buildTraits([frozen("a", "x", "us", "small", 2026), frozen("b", "y", "us", "small", 2026)]);
  assert.deepEqual(givenRows(shared, shared.models.a), [
    { key: "region", label: "Region", value: "USA" },
    { key: "year", label: "Year", value: "2026" },
    { key: "size", label: "Size", value: "Small" },
  ]);
  const single = buildTraits([frozen("a", "x", "eu", "xxl", 2024)]);
  assert.deepEqual(givenRows(single, single.models.a), [
    { key: "company", label: "Company", value: "X" },
    { key: "region", label: "Region", value: "Europe" },
    { key: "year", label: "Year", value: "2024" },
    { key: "size", label: "Size", value: "XXL" },
  ]);
  const mixed = buildTraits([frozen("a", "x", "us", "small", 2026), frozen("b", "y", "cn", "large", 2025)]);
  assert.deepEqual(givenRows(mixed, mixed.models.a), []);
});

test("explanation: a miss with nothing matched and zero tokens", () => {
  const result = scoreRound({ rules, ...none, tokens: 0 });
  assert.equal(result.score, 0);
  assert.deepEqual(result.breakdown, [
    { label: "Base", points: 0 },
    { label: "Tokens · 0 tokens", points: null, multiplier: "×20" },
  ]);
  assert.deepEqual(result.explanation, [
    intro,
    "Base: 0.",
    "Hints: none.",
    "Wrong guesses: none.",
    "Before the multiplier: 0 − 0 = 0.",
    "Tokens: 0. Token factor ×20.",
  ]);
});

test("explanation: base line for region and company, region only, company only", () => {
  const both = scoreRound({ rules, ...none, regionMatched: true, companyMatched: true, tokens: 2000 });
  assert.equal(both.explanation[1], "Base: 400 — region 100, company 300.");
  assert.equal(both.explanation[5], "Tokens: 2,000. Token factor ×5 (10,000/2,000).");
  const region = scoreRound({ rules, ...none, regionMatched: true, tokens: 2000 });
  assert.equal(region.explanation[1], "Base: 100 for the region.");
  const company = scoreRound({ rules, ...none, companyMatched: true, tokens: 2000 });
  assert.equal(company.explanation[1], "Base: 300 for the company.");
  assert.equal(company.score, 1500);
  assert.deepEqual(company.breakdown, [
    { label: "Company", points: 300 },
    { label: "Tokens · 2,000 tokens", points: null, multiplier: "×5" },
  ]);
  const given = scoreRound({ rules, ...none, regionMatched: true, companyMatched: true, regionGiven: true, tokens: 2000 });
  assert.equal(given.explanation[1], "Base: 300 for the company.");
  const bothKnown = scoreRound({
    rules,
    ...none,
    regionMatched: true,
    companyMatched: true,
    regionGiven: true,
    hints: ["company"],
    tokens: 2000,
  });
  assert.equal(bothKnown.explanation[1], "Base: 0.");
});

test("explanation: very large token counts show a tiny factor", () => {
  const huge = scoreRound({ rules, ...none, namedModel: true, tokens: 1_000_000 });
  assert.equal(huge.score, 20);
  assert.equal(huge.breakdown[1].multiplier, "×0.01");
  assert.equal(huge.explanation[5], "Tokens: 1,000,000. Token factor ×0.01 (10,000/1,000,000).");
  const bigger = scoreRound({ rules, ...none, namedModel: true, tokens: 12_345_678 });
  assert.equal(bigger.explanation[5], "Tokens: 12,345,678. Token factor ×0.001 (10,000/12,345,678).");
});

test("explanation: hints, wrong guesses, no-hint-with-hint, difficulty", () => {
  const result = scoreRound({
    rules,
    ...none,
    namedModel: true,
    noHint: true,
    hints: ["year"],
    difficulty: "hard",
    wrongGuesses: 3,
    tokens: 2694,
  });
  assert.equal(result.score, 11878);
  assert.deepEqual(result.breakdown, [
    { label: "Named the model", points: 2000 },
    { label: "Year hint", points: -100 },
    { label: "Wrong guesses · 3", points: -300 },
    { label: "Tokens · 2,694 tokens", points: null, multiplier: "×3.712" },
    { label: "Difficulty · Hard", points: null, multiplier: "×2" },
  ]);
  assert.deepEqual(result.explanation, [
    intro,
    "Base: 2,000 for naming the model.",
    "Hints: Year −100.",
    "Wrong guesses: 3 × −100.",
    "Before the multiplier: 2,000 − 400 = 1,600.",
    "Tokens: 2,694. Token factor ×3.712 (10,000/2,694).",
    "Difficulty: Hard ×2.",
  ]);
});

test("score steps for a floored round and for stacked multipliers", () => {
  const floored = scoreRound({ rules, ...none, hints: ["company"], wrongGuesses: 2, tokens: 500 });
  assert.deepEqual(scoreSteps(floored.breakdown, floored.score), [
    { label: "Base", change: "0", after: "0", kind: "points" },
    { label: "Company hint", change: "-600", after: "-600", kind: "points" },
    { label: "Wrong guesses · 2", change: "-200", after: "-800", kind: "points" },
    { label: "Before the multiplier", change: "", after: "-800", kind: "subtotal" },
    { label: "Tokens · 500 tokens", change: "×20", after: "-16,000", kind: "factor" },
    { label: "Floor at 0", change: "", after: "0", kind: "floor" },
  ]);
  const stacked = scoreRound({ rules, ...none, namedModel: true, noHint: true, difficulty: "hard", tokens: 2694 });
  assert.deepEqual(scoreSteps(stacked.breakdown, stacked.score), [
    { label: "Named the model", change: "2,000", after: "2,000", kind: "points" },
    { label: "Before the multiplier", change: "", after: "2,000", kind: "subtotal" },
    { label: "Tokens · 2,694 tokens", change: "×3.712", after: "7,424", kind: "factor" },
    { label: "No-hint", change: "×2", after: "14,848", kind: "factor" },
    { label: "Difficulty · Hard", change: "×2", after: "29,696", kind: "factor" },
  ]);
});
