import assert from "node:assert/strict";
import test from "node:test";
import { currentRules, rulesForCategory } from "./config";
import {
  buildTraits,
  categoryAllowsHints,
  eliminatedCompanyIds,
  filterCandidates,
  hintOffered,
  knownValues,
  missedGuesses,
  scoreRound,
  toPublicGame,
  tokenFactor,
  type FrozenModel,
  type HintKey,
  type RecordedGuess,
  type ScoreLine,
} from "./game";

const rules = rulesForCategory(true);

function model(
  partial: Partial<FrozenModel> & Pick<FrozenModel, "name" | "companyId"> & { id?: string },
): FrozenModel & { id: string } {
  return {
    id: partial.id ?? partial.name.toLowerCase().replace(/\s+/g, "-"),
    companyName: partial.companyId,
    region: "us",
    size: "small",
    year: 2026,
    logoPath: "logos/x.png",
    ...partial,
  };
}

const none = {
  namedModel: false,
  regionMatched: false,
  companyMatched: false,
  regionGiven: false,
  companyGiven: false,
  noHint: false,
  hints: [] as HintKey[],
};

function pointValues(lines: ScoreLine[]) {
  return lines.map((line) => line.points);
}

test("the scoring numbers are the agreed ones", () => {
  assert.equal(rules.modelBase, 2000);
  assert.equal(rules.regionPoints, 100);
  assert.equal(rules.companyPoints, 300);
  assert.equal(rules.wrongGuessCost, 100);
  assert.equal(rules.tokenScale, 10000);
  assert.equal(rules.tokenCap, 10);
  assert.equal(rules.noHintMultiplier, 2);
  assert.deepEqual(rules.hintCosts, { year: 100, size: 100, region: 400, company: 600 });
});

test("a round started under the old numbers is scored with the current ones", () => {
  const stored = { ...rules, modelBase: 1000, wrongGuessCost: 50, messageLimit: 12, hintsAllowed: false } as Record<string, unknown>;
  delete stored.hintCosts;
  delete stored.tokenFloor;
  delete stored.tokenCap;
  const current = currentRules(stored as unknown as typeof rules);
  assert.equal(current.modelBase, 2000);
  assert.equal(current.wrongGuessCost, 100);
  assert.equal(current.tokenScale, 10000);
  assert.equal(current.tokenCap, 10);
  assert.equal(current.hintCosts.company, 600);
  assert.equal(current.messageLimit, 12);
  assert.equal(current.hintsAllowed, false);
});

test("the token factor is 10,000 divided by tokens, capped at 10", () => {
  assert.equal(tokenFactor(0, rules), 10);
  assert.equal(tokenFactor(1, rules), 10);
  assert.equal(tokenFactor(1000, rules), 10);
  assert.equal(tokenFactor(2000, rules), 5);
  assert.equal(tokenFactor(10000, rules), 1);
  assert.equal(tokenFactor(20000, rules), 0.5);
  assert.equal(tokenFactor(2694, rules), 10000 / 2694);
  assert.equal(scoreRound({ rules, ...none, namedModel: true, tokens: 2000 }).score, 10000);
  assert.equal(scoreRound({ rules, ...none, namedModel: true, tokens: 10000 }).score, 2000);
  assert.equal(scoreRound({ rules, ...none, namedModel: true, tokens: 20000 }).score, 1000);
});

test("naming the model starts at 2000 and penalties stay minus lines", () => {
  const result = scoreRound({ rules, ...none, namedModel: true, tokens: 500, hints: ["year"] });
  assert.equal(result.score, 19000);
  assert.deepEqual(pointValues(result.breakdown), [2000, -100, null]);
  assert.equal(result.breakdown.at(-1)?.multiplier, "×10");
  assert.equal(result.breakdown.at(-1)?.label, "Tokens · 500 tokens");
  assert.match(result.explanation[1] ?? "", /2,000 for naming the model/);
  assert.match(result.explanation.join("\n"), /Year −100/);
  assert.match(result.explanation.join("\n"), /Token factor ×10 \(10,000\/500, capped at 10\)/);
  assert.match(result.explanation.join("\n"), /Wrong guesses: none/);
  assert.doesNotMatch(result.explanation.join("\n"), /Message/);
  assert.doesNotMatch(result.explanation.join("\n"), /counted as/);
});

test("naming the model pays the same on a late reply as on an early one", () => {
  const early = scoreRound({ rules, ...none, namedModel: true, tokens: 500 });
  const late = scoreRound({ rules, ...none, namedModel: true, tokens: 500, regionMatched: true, companyMatched: true });
  assert.equal(early.score, 20000);
  assert.equal(late.score, 20000);
});

test("penalties come off the base before the token factor", () => {
  const result = scoreRound({ rules, ...none, namedModel: true, tokens: 250, wrongGuesses: 2 });
  assert.equal(result.score, 18000);
  assert.deepEqual(pointValues(result.breakdown), [2000, -200, null]);
  assert.equal(result.breakdown.at(-1)?.multiplier, "×10");
  assert.match(result.explanation.join("\n"), /Wrong guesses: 2 × −100/);
});

test("every hint has its own price", () => {
  const prices: Record<HintKey, number> = { year: 100, size: 100, region: 400, company: 600 };
  for (const [key, price] of Object.entries(prices) as [HintKey, number][]) {
    const result = scoreRound({ rules, ...none, namedModel: true, tokens: 1000, hints: [key] });
    assert.equal(result.score, (2000 - price) * 10, key);
    assert.equal(result.breakdown.find((line) => line.label.endsWith("hint"))?.points, -price, key);
  }
  const all = scoreRound({ rules, ...none, namedModel: true, tokens: 1000, hints: ["company", "region", "year", "size"] });
  assert.equal(all.score, 8000);
  assert.match(all.explanation.join("\n"), /Company −600\. Region −400\. Year −100\. Size −100/);
});

test("the no-hint multiplier applies only to a round with no hint", () => {
  const blind = scoreRound({ rules, ...none, namedModel: true, tokens: 500, noHint: true });
  assert.equal(blind.score, 40000);
  assert.deepEqual(pointValues(blind.breakdown), [2000, null, null]);
  assert.deepEqual(
    blind.breakdown.slice(1).map((line) => [line.label, line.multiplier]),
    [
      ["Tokens · 500 tokens", "×10"],
      ["No-hint", "×2"],
    ],
  );
  assert.match(blind.explanation[0] ?? "", /then by 2× if you played with no hints/);
  assert.match(blind.explanation.join("\n"), /No-hint: ×2\./);
  const hinted = scoreRound({ rules, ...none, namedModel: true, tokens: 500, noHint: true, hints: ["year"] });
  assert.equal(hinted.score, 19000);
  assert.equal(hinted.breakdown.some((line) => line.label === "No-hint"), false);
  assert.doesNotMatch(hinted.explanation.join("\n"), /No-hint/);
  const open = scoreRound({ rules, ...none, namedModel: true, tokens: 500 });
  assert.equal(open.score, 20000);
  assert.equal(open.breakdown.some((line) => line.label === "No-hint"), false);
});

test("a 2,694-token hint round scores 6682", () => {
  const result = scoreRound({
    rules,
    ...none,
    namedModel: true,
    tokens: 2694,
    hints: ["size"],
    wrongGuesses: 1,
  });
  assert.equal(result.score, 6682);
  assert.deepEqual(pointValues(result.breakdown), [2000, -100, -100, null]);
  const tokens = result.breakdown.find((line) => line.label.startsWith("Tokens"));
  assert.equal(tokens?.label, "Tokens · 2,694 tokens");
  assert.equal(tokens?.points, null);
  assert.equal(tokens?.multiplier, "×3.712");
  assert.equal(result.breakdown.some((line) => line.label === "No-hint"), false);
  assert.match(result.explanation.join("\n"), /Before the multiplier: 2,000 − 200 = 1,800/);
  assert.match(result.explanation.join("\n"), /Token factor ×3\.712 \(10,000\/2,694\)/);
});

test("a miss scores the region and company it matched", () => {
  const both = scoreRound({ rules, ...none, regionMatched: true, companyMatched: true, tokens: 2000 });
  assert.equal(both.score, 2000);
  assert.equal(both.breakdown.find((line) => line.label.startsWith("Tokens"))?.multiplier, "×5");
  const noBoost = scoreRound({ rules, ...none, regionMatched: true, companyMatched: true, tokens: 2000, noHint: true });
  assert.equal(noBoost.score, 4000);
  assert.equal(noBoost.breakdown.at(-1)?.multiplier, "×2");
  const given = scoreRound({ rules, ...none, regionMatched: true, companyMatched: true, regionGiven: true, tokens: 1000 });
  assert.equal(given.score, 3000);
  const nothing = scoreRound({ rules, ...none, tokens: 1000 });
  assert.equal(nothing.score, 0);
  assert.deepEqual(pointValues(nothing.breakdown), [0, null]);
  assert.equal(nothing.breakdown.at(-1)?.multiplier, "×10");
});

test("a trait the player revealed does not pay base points", () => {
  const result = scoreRound({
    rules,
    ...none,
    regionMatched: true,
    companyMatched: true,
    hints: ["company"],
    tokens: 1000,
  });
  assert.equal(result.score, 0);
  const regionOnly = scoreRound({ rules, ...none, regionMatched: true, companyMatched: true, hints: ["region"], tokens: 1000 });
  assert.equal(regionOnly.score, 0);
  assert.equal(regionOnly.breakdown.at(-1)?.label, "Floor at 0");
});

test("1,000 tokens or fewer is 10×, including 0", () => {
  for (const tokens of [0, 1, 999, 1000]) {
    const result = scoreRound({ rules, ...none, namedModel: true, tokens });
    assert.equal(result.score, 20000, String(tokens));
    assert.equal(result.breakdown.find((line) => line.label.startsWith("Tokens"))?.multiplier, "×10", String(tokens));
  }
  const zero = scoreRound({ rules, ...none, namedModel: true, tokens: 0 });
  assert.equal(zero.breakdown.find((line) => line.label.startsWith("Tokens"))?.label, "Tokens · 0 tokens");
  assert.equal(zero.breakdown.find((line) => line.label.startsWith("Tokens"))?.points, null);
  assert.match(zero.explanation.join("\n"), /Tokens: 0\. Token factor ×10\./);
  assert.doesNotMatch(zero.explanation.join("\n"), /counted as/);
  assert.doesNotMatch(zero.explanation.join("\n"), /factor 1\./i);
  assert.equal(scoreRound({ rules, ...none, namedModel: true, tokens: 1001 }).score, 19980);
});

test("difficulty multiplies after the token factor and the no-hint multiplier", () => {
  const easy = scoreRound({ rules, ...none, namedModel: true, tokens: 500, difficulty: "easy" });
  assert.equal(easy.score, 10000);
  assert.equal(easy.breakdown.at(-1)?.label, "Difficulty · Easy");
  assert.equal(easy.breakdown.at(-1)?.points, null);
  assert.equal(easy.breakdown.at(-1)?.multiplier, "×0.5");
  assert.match(easy.explanation.join("\n"), /Difficulty: Easy ×0\.5\./);
  const medium = scoreRound({ rules, ...none, namedModel: true, tokens: 500, difficulty: "medium" });
  assert.equal(medium.score, 20000);
  assert.equal(medium.breakdown.at(-1)?.multiplier, "×1");
  const hard = scoreRound({ rules, ...none, namedModel: true, tokens: 500, difficulty: "hard" });
  assert.equal(hard.score, 40000);
  assert.equal(hard.breakdown.at(-1)?.multiplier, "×2");
  const stacked = scoreRound({ rules, ...none, namedModel: true, tokens: 500, noHint: true, difficulty: "impossible" });
  assert.equal(stacked.score, 120000);
  assert.deepEqual(
    stacked.breakdown.slice(-3).map((line) => [line.label, line.points, line.multiplier]),
    [
      ["Tokens · 500 tokens", null, "×10"],
      ["No-hint", null, "×2"],
      ["Difficulty · Impossible", null, "×3"],
    ],
  );
  const half = scoreRound({ rules, ...none, regionMatched: true, tokens: 16000, difficulty: "hard" });
  assert.equal(half.score, 125);
  assert.equal(scoreRound({ rules, ...none, namedModel: true, tokens: 500 }).breakdown.some((line) => line.label.startsWith("Difficulty")), false);
});

test("the total rounds half up once, after both multipliers", () => {
  assert.equal(scoreRound({ rules, ...none, regionMatched: true, tokens: 16000 }).score, 63);
  assert.equal(scoreRound({ rules, ...none, regionMatched: true, tokens: 15000 }).score, 67);
  const result = scoreRound({ rules, ...none, regionMatched: true, tokens: 16000 });
  assert.equal(result.breakdown.find((line) => line.label.startsWith("Tokens"))?.points, null);
  assert.equal(scoreRound({ rules, ...none, regionMatched: true, tokens: 16000, noHint: true }).score, 125);
});

test("the total never goes below 0", () => {
  const result = scoreRound({ rules, ...none, hints: ["company"], wrongGuesses: 2, tokens: 500 });
  assert.equal(result.score, 0);
  assert.equal(Object.is(result.score, 0), true);
  assert.equal(result.breakdown.at(-1)?.label, "Floor at 0");
  assert.equal(result.breakdown.at(-1)?.points, 8000);
  assert.equal(result.breakdown.find((line) => line.label.startsWith("Tokens"))?.multiplier, "×10");
  assert.match(result.explanation.join("\n"), /shown as 0/);
  const small = scoreRound({ rules, ...none, regionMatched: true, wrongGuesses: 1, tokens: 1000 });
  assert.equal(small.score, 0);
  assert.equal(small.breakdown.some((line) => line.label === "Floor at 0"), false);
});

test("a revealed company or region is known and narrows the list", () => {
  const models = [
    model({ id: "haiku", name: "Haiku", companyId: "anthropic", companyName: "Anthropic", region: "us" }),
    model({ id: "luna", name: "Luna", companyId: "openai", companyName: "OpenAI", region: "us" }),
    model({ id: "flash", name: "Flash", companyId: "deepseek", companyName: "DeepSeek", region: "cn" }),
  ];
  const traits = buildTraits(models);
  const hidden = traits.models.flash;
  assert.ok(hidden);
  const byRegion = knownValues({ traits, hidden, guesses: [], hints: ["region"], noHint: false });
  assert.deepEqual(filterCandidates(traits, byRegion).map((row) => row.id), ["flash"]);
  const byCompany = knownValues({ traits, hidden, guesses: [], hints: ["company"], noHint: false });
  assert.equal(byCompany.companyId, "deepseek");
});

test("a hint is not offered for a trait the round already showed", () => {
  const models = [
    model({ id: "haiku", name: "Haiku", companyId: "anthropic", companyName: "Anthropic", region: "us" }),
    model({ id: "sonnet", name: "Sonnet", companyId: "anthropic", companyName: "Anthropic", region: "us", year: 2025 }),
  ];
  const traits = buildTraits(models);
  assert.deepEqual(traits.given.sort(), ["company", "region", "size"]);
  const hidden = traits.models.haiku;
  assert.ok(hidden);
  const ask = (key: HintKey, extra: Partial<Parameters<typeof hintOffered>[0]> = {}) =>
    hintOffered({ key, traits, hidden, guesses: [], hints: [], noHint: false, ...extra });
  assert.equal(ask("company"), false);
  assert.equal(ask("region"), false);
  assert.equal(ask("size"), false);
  assert.equal(ask("year"), true);
  assert.equal(ask("year", { hints: ["year"] }), false);
  assert.equal(ask("year", { noHint: true }), false);
});

test("a match shown by a guess is not offered as a hint", () => {
  const models = [
    model({ id: "haiku", name: "Haiku", companyId: "anthropic", companyName: "Anthropic", region: "us" }),
    model({ id: "luna", name: "Luna", companyId: "openai", companyName: "OpenAI", region: "cn" }),
  ];
  const traits = buildTraits(models);
  const hidden = traits.models.haiku;
  assert.ok(hidden);
  const guesses = [{ modelCorrect: false, companyCorrect: true, regionCorrect: false }];
  const offer = (key: HintKey) => hintOffered({ key, traits, hidden, guesses, hints: [], noHint: false });
  assert.equal(offer("company"), false);
  assert.equal(offer("region"), true);
});

test("no-hint mode does not narrow the list on a match", () => {
  const models = [
    model({ id: "haiku", name: "Haiku", companyId: "anthropic", companyName: "Anthropic", region: "us" }),
    model({ id: "luna", name: "Luna", companyId: "openai", companyName: "OpenAI", region: "us" }),
    model({ id: "flash", name: "Flash", companyId: "deepseek", companyName: "DeepSeek", region: "cn" }),
  ];
  const traits = buildTraits(models);
  const hidden = traits.models.haiku;
  assert.ok(hidden);
  const guesses = [{ modelCorrect: false, companyCorrect: true, regionCorrect: true }];
  const open = knownValues({ traits, hidden, guesses, hints: [], noHint: false });
  const blind = knownValues({ traits, hidden, guesses, hints: [], noHint: true });
  assert.deepEqual(filterCandidates(traits, open).map((row) => row.id), ["haiku"]);
  assert.equal(filterCandidates(traits, blind).length, 3);
  const hinted = knownValues({ traits, hidden, guesses: [], hints: ["year"], noHint: true });
  assert.equal(filterCandidates(traits, hinted).length, 3);
  assert.deepEqual(
    filterCandidates(traits, blind, ["luna"]).map((row) => row.id),
    ["haiku", "flash"],
  );
});

test("a wrong company leaves the guess search only in hint mode", () => {
  const models = [
    model({ id: "haiku", name: "Haiku", companyId: "anthropic", companyName: "Anthropic" }),
    model({ id: "sonnet", name: "Sonnet", companyId: "anthropic", companyName: "Anthropic" }),
    model({ id: "opus", name: "Opus", companyId: "anthropic", companyName: "Anthropic" }),
    model({ id: "luna", name: "Luna", companyId: "openai", companyName: "OpenAI" }),
    model({ id: "gpt", name: "GPT", companyId: "openai", companyName: "OpenAI" }),
    model({ id: "flash", name: "Flash", companyId: "deepseek", companyName: "DeepSeek", region: "cn" }),
  ];
  const traits = buildTraits(models);
  const hidden = traits.models.haiku;
  assert.ok(hidden);
  const listed = (guesses: RecordedGuess[], noHint: boolean) =>
    toPublicGame({
      id: "game",
      category: "all",
      poolKey: null,
      noHint,
      status: "active",
      messageCount: 1,
      awaitingGuess: true,
      rules,
      traits,
      modelId: "haiku",
      hints: [],
      guesses,
      guessedModelIds: guesses.flatMap((guess) => (guess.modelId ? [guess.modelId] : [])),
      transcript: [],
      score: null,
      breakdown: null,
      explanation: null,
    }).candidates.map((row) => row.id);
  const guess = (modelId: string, companyCorrect: boolean): RecordedGuess => ({
    turn: 1,
    modelId,
    modelCorrect: false,
    companyCorrect,
    regionCorrect: false,
  });

  assert.deepEqual(listed([guess("luna", false)], false), ["haiku", "opus", "sonnet", "flash"]);
  assert.deepEqual(eliminatedCompanyIds(traits, [guess("luna", false)], false), ["openai"]);
  assert.deepEqual(listed([guess("sonnet", true)], false), ["haiku", "opus"]);
  assert.deepEqual(eliminatedCompanyIds(traits, [guess("sonnet", true)], false), []);
  assert.deepEqual(listed([guess("luna", false)], true), ["haiku", "opus", "sonnet", "flash", "gpt"]);
  assert.deepEqual(eliminatedCompanyIds(traits, [guess("luna", false)], true), []);
});

test("a wrong guess keeps the model and names the traits it missed", () => {
  const models = [
    model({ id: "haiku", name: "Haiku", companyId: "anthropic", companyName: "Anthropic", region: "us" }),
    model({ id: "luna", name: "Luna", companyId: "openai", companyName: "OpenAI", region: "us" }),
    model({ id: "flash", name: "Flash", companyId: "deepseek", companyName: "DeepSeek", region: "cn" }),
  ];
  const traits = buildTraits(models);
  const guesses = [
    {
      turn: 2,
      modelId: "flash",
      modelCorrect: false,
      companyCorrect: false,
      regionCorrect: false,
    },
    {
      turn: 1,
      modelId: "luna",
      modelCorrect: false,
      companyCorrect: false,
      regionCorrect: true,
    },
    {
      turn: 3,
      modelId: "haiku",
      modelCorrect: true,
      companyCorrect: true,
      regionCorrect: true,
    },
  ];
  const named = missedGuesses(traits, guesses, false);
  assert.deepEqual(
    named.map((guess) => guess.id),
    ["luna", "flash"],
  );
  assert.deepEqual(named[0]?.wrong, ["company"]);
  assert.deepEqual(named[1]?.wrong, ["company", "region"]);
  assert.deepEqual(missedGuesses(traits, guesses, true)[0]?.wrong, []);
});

test("hints are only possible on daily, all models, and custom", () => {
  assert.equal(categoryAllowsHints("daily"), true);
  assert.equal(categoryAllowsHints("all"), true);
  assert.equal(categoryAllowsHints("custom"), true);
  for (const category of ["class", "region", "company", "latest"]) {
    assert.equal(categoryAllowsHints(category), false, category);
  }
});

test("a finished round lists company, region, year, and size", () => {
  const models = [
    model({ id: "haiku", name: "Haiku", companyId: "anthropic", companyName: "Anthropic" }),
    model({ id: "luna", name: "Luna", companyId: "openai", companyName: "OpenAI" }),
  ];
  const traits = buildTraits(models);
  const game = toPublicGame({
    id: "game",
    category: "all",
    poolKey: null,
    noHint: false,
    status: "solved",
    messageCount: 1,
    awaitingGuess: false,
    rules,
    traits,
    modelId: "haiku",
    hints: [],
    guesses: [],
    guessedModelIds: [],
    transcript: [],
    score: 1,
    breakdown: [],
    explanation: [],
  });
  assert.deepEqual(
    game.model && [game.model.companyName, game.model.region, game.model.year, game.model.size],
    ["Anthropic", "USA", 2026, "Small"],
  );
  assert.equal(game.model && "family" in game.model, false);
  assert.equal("family" in game.hints, false);
});
