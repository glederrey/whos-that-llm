import assert from "node:assert/strict";
import test from "node:test";
import { currentRules, rulesForCategory } from "./config";
import {
  buildTraits,
  eliminatedCompanyIds,
  filterCandidates,
  hintOffered,
  knownValues,
  missedGuesses,
  scoreRound,
  toPublicGame,
  type FrozenModel,
  type HintKey,
  type RecordedGuess,
} from "./game";

const rules = rulesForCategory(true);

function model(
  partial: Partial<FrozenModel> & Pick<FrozenModel, "name" | "companyId" | "familyId"> & { id?: string },
): FrozenModel & { id: string } {
  return {
    id: partial.id ?? partial.name.toLowerCase().replace(/\s+/g, "-"),
    companyName: partial.companyId,
    familyName: partial.familyId,
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

function sum(lines: { points: number }[]) {
  return lines.reduce((total, line) => total + line.points, 0);
}

test("the scoring numbers are the agreed ones", () => {
  assert.equal(rules.modelBase, 2000);
  assert.equal(rules.regionPoints, 100);
  assert.equal(rules.companyPoints, 300);
  assert.equal(rules.wrongGuessCost, 100);
  assert.equal(rules.tokenScale, 1000);
  assert.equal(rules.tokenFloor, 100);
  assert.equal(rules.noHintMultiplier, 1.5);
  assert.deepEqual(rules.hintCosts, { year: 100, size: 100, region: 400, company: 600, family: 600 });
});

test("a round started under the old numbers is scored with the current ones", () => {
  const stored = { ...rules, modelBase: 1000, wrongGuessCost: 50, messageLimit: 12, hintsAllowed: false } as Record<string, unknown>;
  delete stored.hintCosts;
  delete stored.tokenFloor;
  const current = currentRules(stored as unknown as typeof rules);
  assert.equal(current.modelBase, 2000);
  assert.equal(current.wrongGuessCost, 100);
  assert.equal(current.tokenFloor, 100);
  assert.equal(current.hintCosts.company, 600);
  assert.equal(current.messageLimit, 12);
  assert.equal(current.hintsAllowed, false);
});

test("naming the model starts at 2000 and the breakdown adds up", () => {
  const result = scoreRound({ rules, ...none, namedModel: true, tokens: 500, hints: ["year"] });
  assert.equal(result.score, 3800);
  assert.deepEqual(
    result.breakdown.map((line) => line.points),
    [2000, -100, 1900],
  );
  assert.equal(sum(result.breakdown), 3800);
  assert.match(result.explanation[1] ?? "", /2,000 for naming the model/);
  assert.match(result.explanation.join("\n"), /Year −100/);
  assert.match(result.explanation.join("\n"), /Token factor 1,000\/500/);
  assert.match(result.explanation.join("\n"), /Wrong guesses: none/);
  assert.doesNotMatch(result.explanation.join("\n"), /Message/);
});

test("naming the model pays the same on a late reply as on an early one", () => {
  const early = scoreRound({ rules, ...none, namedModel: true, tokens: 500 });
  const late = scoreRound({ rules, ...none, namedModel: true, tokens: 500, regionMatched: true, companyMatched: true });
  assert.equal(early.score, 4000);
  assert.equal(late.score, 4000);
});

test("penalties come off the base before the token factor", () => {
  const result = scoreRound({ rules, ...none, namedModel: true, tokens: 250, wrongGuesses: 2 });
  assert.equal(result.score, 7200);
  assert.deepEqual(
    result.breakdown.map((line) => line.points),
    [2000, -200, 5400],
  );
  assert.equal(sum(result.breakdown), 7200);
  assert.match(result.explanation.join("\n"), /Wrong guesses: 2 × −100/);
});

test("every hint has its own price", () => {
  const prices: Record<HintKey, number> = { year: 100, size: 100, region: 400, company: 600, family: 600 };
  for (const [key, price] of Object.entries(prices) as [HintKey, number][]) {
    const result = scoreRound({ rules, ...none, namedModel: true, tokens: 1000, hints: [key] });
    assert.equal(result.score, 2000 - price, key);
    assert.equal(sum(result.breakdown), result.score, key);
  }
  const all = scoreRound({ rules, ...none, namedModel: true, tokens: 1000, hints: ["company", "family", "region", "year", "size"] });
  assert.equal(all.score, 2000 - 1800);
  assert.match(all.explanation.join("\n"), /Company −600\. Family −600\. Region −400\. Year −100\. Size −100/);
});

test("the no-hint multiplier applies only to a round with no hint", () => {
  const blind = scoreRound({ rules, ...none, namedModel: true, tokens: 500, noHint: true });
  assert.equal(blind.score, 6000);
  assert.deepEqual(
    blind.breakdown.map((line) => line.points),
    [2000, 2000, 2000],
  );
  assert.equal(blind.breakdown.at(-1)?.label.startsWith("No-hint"), true);
  assert.match(blind.explanation.join("\n"), /No-hint: ×1\.5/);
  const hinted = scoreRound({ rules, ...none, namedModel: true, tokens: 500, noHint: true, hints: ["year"] });
  assert.equal(hinted.score, 3800);
  assert.doesNotMatch(hinted.explanation.join("\n"), /No-hint/);
  const open = scoreRound({ rules, ...none, namedModel: true, tokens: 500 });
  assert.equal(open.score, 4000);
});

test("a miss scores the region and company it matched", () => {
  const both = scoreRound({ rules, ...none, regionMatched: true, companyMatched: true, tokens: 2000 });
  assert.equal(both.score, 200);
  assert.equal(sum(both.breakdown), 200);
  const noBoost = scoreRound({ rules, ...none, regionMatched: true, companyMatched: true, tokens: 2000, noHint: true });
  assert.equal(noBoost.score, 300);
  const given = scoreRound({ rules, ...none, regionMatched: true, companyMatched: true, regionGiven: true, tokens: 1000 });
  assert.equal(given.score, 300);
  const nothing = scoreRound({ rules, ...none, tokens: 1000 });
  assert.equal(nothing.score, 0);
  assert.deepEqual(nothing.breakdown.map((line) => line.points), [0, 0]);
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
  assert.equal(sum(regionOnly.breakdown), 0);
});

test("fewer than 100 tokens count as 100 and the factor stops at 10", () => {
  for (const tokens of [0, 1, 99, 100]) {
    const result = scoreRound({ rules, ...none, namedModel: true, tokens });
    assert.equal(result.score, 20000, String(tokens));
    assert.equal(sum(result.breakdown), 20000);
  }
  const zero = scoreRound({ rules, ...none, namedModel: true, tokens: 0 });
  assert.match(zero.breakdown.find((line) => line.label.startsWith("Tokens"))?.label ?? "", /0 tokens, counted as 100 · ×10/);
  assert.match(zero.explanation.join("\n"), /Tokens: 0, counted as 100\. Token factor 1,000\/100/);
  assert.doesNotMatch(zero.explanation.join("\n"), /factor 1\./i);
  assert.equal(scoreRound({ rules, ...none, namedModel: true, tokens: 101 }).score, 19802);
});

test("the total rounds half up", () => {
  assert.equal(scoreRound({ rules, ...none, regionMatched: true, tokens: 1600 }).score, 63);
  assert.equal(scoreRound({ rules, ...none, regionMatched: true, tokens: 1500 }).score, 67);
  const result = scoreRound({ rules, ...none, regionMatched: true, tokens: 1600 });
  assert.equal(sum(result.breakdown), result.score);
});

test("the total never goes below 0", () => {
  const result = scoreRound({ rules, ...none, hints: ["company"], wrongGuesses: 2, tokens: 500 });
  assert.equal(result.score, 0);
  assert.equal(Object.is(result.score, 0), true);
  assert.equal(sum(result.breakdown), 0);
  assert.equal(result.breakdown.at(-1)?.label, "Floor at 0");
  assert.match(result.explanation.join("\n"), /shown as 0/);
  const small = scoreRound({ rules, ...none, regionMatched: true, wrongGuesses: 1, tokens: 1000 });
  assert.equal(small.score, 0);
});

test("a revealed company, family, or region is known and narrows the list", () => {
  const models = [
    model({ id: "haiku", name: "Haiku", companyId: "anthropic", companyName: "Anthropic", familyId: "haiku", region: "us" }),
    model({ id: "luna", name: "Luna", companyId: "openai", companyName: "OpenAI", familyId: "gpt", region: "us" }),
    model({ id: "flash", name: "Flash", companyId: "deepseek", companyName: "DeepSeek", familyId: "deepseek", region: "cn" }),
  ];
  const traits = buildTraits(models);
  const hidden = traits.models.flash;
  assert.ok(hidden);
  const byRegion = knownValues({ traits, hidden, guesses: [], hints: ["region"], noHint: false });
  assert.deepEqual(filterCandidates(traits, byRegion).map((row) => row.id), ["flash"]);
  const byCompany = knownValues({ traits, hidden, guesses: [], hints: ["company"], noHint: false });
  assert.equal(byCompany.companyId, "deepseek");
  const byFamily = knownValues({ traits, hidden, guesses: [], hints: ["family"], noHint: false });
  assert.equal(byFamily.familyId, "deepseek");
});

test("a hint is not offered for a trait the round already showed", () => {
  const models = [
    model({ id: "haiku", name: "Haiku", companyId: "anthropic", companyName: "Anthropic", familyId: "haiku", region: "us" }),
    model({ id: "sonnet", name: "Sonnet", companyId: "anthropic", companyName: "Anthropic", familyId: "sonnet", region: "us", year: 2025 }),
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
  assert.equal(ask("family"), true);
  assert.equal(ask("year"), true);
  assert.equal(ask("family", { hints: ["family"] }), false);
  assert.equal(ask("year", { noHint: true }), false);
  const matched = [{ modelCorrect: false, companyCorrect: false, familyCorrect: true, regionCorrect: true }];
  assert.equal(ask("family", { guesses: matched }), false);
  assert.equal(ask("family", { guesses: matched, noHint: true }), false);
});

test("a match shown by a guess is not offered as a hint", () => {
  const models = [
    model({ id: "haiku", name: "Haiku", companyId: "anthropic", companyName: "Anthropic", familyId: "haiku", region: "us" }),
    model({ id: "luna", name: "Luna", companyId: "openai", companyName: "OpenAI", familyId: "gpt", region: "cn" }),
  ];
  const traits = buildTraits(models);
  const hidden = traits.models.haiku;
  assert.ok(hidden);
  const guesses = [{ modelCorrect: false, companyCorrect: true, familyCorrect: false, regionCorrect: false }];
  const offer = (key: HintKey) => hintOffered({ key, traits, hidden, guesses, hints: [], noHint: false });
  assert.equal(offer("company"), false);
  assert.equal(offer("region"), true);
  assert.equal(offer("family"), true);
});

test("no-hint mode does not narrow the list on a match", () => {
  const models = [
    model({ id: "haiku", name: "Haiku", companyId: "anthropic", companyName: "Anthropic", familyId: "haiku", region: "us" }),
    model({ id: "luna", name: "Luna", companyId: "openai", companyName: "OpenAI", familyId: "gpt", region: "us" }),
    model({ id: "flash", name: "Flash", companyId: "deepseek", companyName: "DeepSeek", familyId: "deepseek", region: "cn" }),
  ];
  const traits = buildTraits(models);
  const hidden = traits.models.haiku;
  assert.ok(hidden);
  const guesses = [{ modelCorrect: false, companyCorrect: true, familyCorrect: false, regionCorrect: true }];
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
    model({ id: "haiku", name: "Haiku", companyId: "anthropic", companyName: "Anthropic", familyId: "haiku" }),
    model({ id: "sonnet", name: "Sonnet", companyId: "anthropic", companyName: "Anthropic", familyId: "sonnet" }),
    model({ id: "opus", name: "Opus", companyId: "anthropic", companyName: "Anthropic", familyId: "opus" }),
    model({ id: "luna", name: "Luna", companyId: "openai", companyName: "OpenAI", familyId: "gpt" }),
    model({ id: "gpt", name: "GPT", companyId: "openai", companyName: "OpenAI", familyId: "gpt" }),
    model({ id: "flash", name: "Flash", companyId: "deepseek", companyName: "DeepSeek", familyId: "deepseek", region: "cn" }),
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
    familyCorrect: false,
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
    model({ id: "haiku", name: "Haiku", companyId: "anthropic", companyName: "Anthropic", familyId: "haiku", region: "us" }),
    model({ id: "luna", name: "Luna", companyId: "openai", companyName: "OpenAI", familyId: "gpt", region: "us" }),
    model({ id: "flash", name: "Flash", companyId: "deepseek", companyName: "DeepSeek", familyId: "deepseek", region: "cn" }),
  ];
  const traits = buildTraits(models);
  const guesses = [
    {
      turn: 2,
      modelId: "flash",
      modelCorrect: false,
      companyCorrect: false,
      familyCorrect: false,
      regionCorrect: false,
    },
    {
      turn: 1,
      modelId: "luna",
      modelCorrect: false,
      companyCorrect: false,
      familyCorrect: false,
      regionCorrect: true,
    },
    {
      turn: 3,
      modelId: "haiku",
      modelCorrect: true,
      companyCorrect: true,
      familyCorrect: true,
      regionCorrect: true,
    },
  ];
  const named = missedGuesses(traits, guesses, false);
  assert.deepEqual(
    named.map((guess) => guess.id),
    ["luna", "flash"],
  );
  assert.deepEqual(named[0]?.wrong, ["company", "family"]);
  assert.deepEqual(named[1]?.wrong, ["company", "region", "family"]);
  assert.deepEqual(missedGuesses(traits, guesses, true)[0]?.wrong, []);
});
