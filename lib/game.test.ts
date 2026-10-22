import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { currentRules, rulesForGameMode } from "./config";
import {
  buildTraits,
  gameModeAllowsHints,
  upcomingMessageNumber,
  eliminatedCompanyIds,
  filterCandidates,
  hintOffered,
  knownValues,
  missedGuesses,
  scoreRound,
  scoreSteps,
  scoreTokens,
  toPublicGame,
  tokenFactor,
  type FrozenModel,
  type HintKey,
  type RecordedGuess,
  type ScoreLine,
} from "./game";

const rules = rulesForGameMode(true);
const root = path.resolve(import.meta.dirname, "..");

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
  assert.equal(rules.tokenCap, 20);
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
  assert.equal(current.tokenCap, 20);
  assert.equal(current.hintCosts.company, 600);
  assert.equal(current.messageLimit, 12);
  assert.equal(current.hintsAllowed, false);
});

test("score tokens count the system prompt once, then only the new message", () => {
  assert.deepEqual(scoreTokens([]), { inputTokens: 0, outputTokens: 0, tokens: 0, turns: [] });

  const first = scoreTokens([{ inputTokens: 1000, outputTokens: 120 }]);
  assert.deepEqual(first, {
    inputTokens: 1000,
    outputTokens: 120,
    tokens: 1120,
    turns: [{ inputTokens: 1000, outputTokens: 120 }],
  });

  const later = scoreTokens([
    { inputTokens: 1000, outputTokens: 120 },
    { inputTokens: 1250, outputTokens: 80 },
    { inputTokens: 1480, outputTokens: 40 },
  ]);
  assert.equal(later.turns[1]?.inputTokens, 130);
  assert.equal(later.turns[2]?.inputTokens, 150);
  assert.equal(later.inputTokens, 1280);
  assert.equal(later.outputTokens, 240);
  assert.equal(later.tokens, 1520);
  assert.equal(later.tokens, 1480 + 40);
  assert.ok(later.tokens < 1000 + 120 + 1250 + 80 + 1480 + 40);
});

test("score tokens ignore reasoning and cache reads, and do not clamp a smaller later prompt", () => {
  const turns: Array<{ inputTokens: number; outputTokens: number; reasoningTokens: number; cacheReadTokens: number }> = [
    { inputTokens: 1000, outputTokens: 200, reasoningTokens: 400, cacheReadTokens: 700 },
    { inputTokens: 1050, outputTokens: 40, reasoningTokens: 10, cacheReadTokens: 900 },
  ];
  const counted = scoreTokens(turns);
  assert.equal(counted.turns[1]?.inputTokens, 1050 - 1000 - 200);
  assert.equal(counted.outputTokens, 240);
  assert.equal(counted.tokens, 1050 + 40);
  assert.equal(scoreTokens([{ inputTokens: Number.NaN, outputTokens: 10 }]).tokens, 10);
});

test("the token factor is 10,000 divided by tokens, capped at 20", () => {
  assert.equal(tokenFactor(0, rules), 20);
  assert.equal(tokenFactor(1, rules), 20);
  assert.equal(tokenFactor(500, rules), 20);
  assert.equal(tokenFactor(1000, rules), 10);
  assert.equal(tokenFactor(2000, rules), 5);
  assert.equal(tokenFactor(10000, rules), 1);
  assert.equal(tokenFactor(20000, rules), 0.5);
  assert.equal(tokenFactor(2694, rules), 10000 / 2694);
  assert.equal(scoreRound({ rules, ...none, namedModel: true, tokens: 500 }).score, 40000);
  assert.equal(scoreRound({ rules, ...none, namedModel: true, tokens: 2000 }).score, 10000);
  assert.equal(scoreRound({ rules, ...none, namedModel: true, tokens: 10000 }).score, 2000);
  assert.equal(scoreRound({ rules, ...none, namedModel: true, tokens: 20000 }).score, 1000);
});

test("naming the model starts at 2000 and penalties stay minus lines", () => {
  const result = scoreRound({ rules, ...none, namedModel: true, tokens: 500, hints: ["year"] });
  assert.equal(result.score, 38000);
  assert.deepEqual(pointValues(result.breakdown), [2000, -100, null]);
  assert.equal(result.breakdown.at(-1)?.multiplier, "×20");
  assert.equal(result.breakdown.at(-1)?.label, "Tokens · 500 tokens");
  assert.match(result.explanation[1] ?? "", /2,000 for naming the model/);
  assert.match(result.explanation.join("\n"), /Year −100/);
  assert.match(result.explanation.join("\n"), /Token factor ×20 \(10,000\/500\)\./);
  assert.match(result.explanation.join("\n"), /Wrong guesses: none/);
  assert.doesNotMatch(result.explanation.join("\n"), /Message/);
  assert.doesNotMatch(result.explanation.join("\n"), /counted as/);
});

test("naming the model pays the same on a late reply as on an early one", () => {
  const early = scoreRound({ rules, ...none, namedModel: true, tokens: 500 });
  const late = scoreRound({ rules, ...none, namedModel: true, tokens: 500, regionMatched: true, companyMatched: true });
  assert.equal(early.score, 40000);
  assert.equal(late.score, 40000);
});

test("penalties come off the base before the token factor", () => {
  const result = scoreRound({ rules, ...none, namedModel: true, tokens: 250, wrongGuesses: 2 });
  assert.equal(result.score, 36000);
  assert.deepEqual(pointValues(result.breakdown), [2000, -200, null]);
  assert.equal(result.breakdown.at(-1)?.multiplier, "×20");
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
  assert.equal(blind.score, 80000);
  assert.deepEqual(pointValues(blind.breakdown), [2000, null, null]);
  assert.deepEqual(
    blind.breakdown.slice(1).map((line) => [line.label, line.multiplier]),
    [
      ["Tokens · 500 tokens", "×20"],
      ["No-hint", "×2"],
    ],
  );
  assert.match(blind.explanation[0] ?? "", /then by 2× if you played with no hints/);
  assert.match(blind.explanation.join("\n"), /No-hint: ×2\./);
  const hinted = scoreRound({ rules, ...none, namedModel: true, tokens: 500, noHint: true, hints: ["year"] });
  assert.equal(hinted.score, 38000);
  assert.equal(hinted.breakdown.some((line) => line.label === "No-hint"), false);
  assert.doesNotMatch(hinted.explanation.join("\n"), /No-hint/);
  const open = scoreRound({ rules, ...none, namedModel: true, tokens: 500 });
  assert.equal(open.score, 40000);
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
  assert.deepEqual(
    scoreSteps(result.breakdown, result.score).map((step) => [step.label, step.change, step.after]),
    [
      ["Named the model", "2,000", "2,000"],
      ["Size hint", "-100", "1,900"],
      ["Wrong guesses · 1", "-100", "1,800"],
      ["Before the multiplier", "", "1,800"],
      ["Tokens · 2,694 tokens", "×3.712", "6,682"],
    ],
  );
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

test("500 tokens or fewer is 20×, and 1,000 tokens is still 10×", () => {
  for (const tokens of [0, 1, 499, 500]) {
    const result = scoreRound({ rules, ...none, namedModel: true, tokens });
    assert.equal(result.score, 40000, String(tokens));
    assert.equal(result.breakdown.find((line) => line.label.startsWith("Tokens"))?.multiplier, "×20", String(tokens));
  }
  const under = scoreRound({ rules, ...none, namedModel: true, tokens: 499 });
  assert.match(under.explanation.join("\n"), /Token factor ×20 \(10,000\/499, capped at 20\)/);
  const thousand = scoreRound({ rules, ...none, namedModel: true, tokens: 1000 });
  assert.equal(thousand.score, 20000);
  assert.equal(thousand.breakdown.find((line) => line.label.startsWith("Tokens"))?.multiplier, "×10");
  const zero = scoreRound({ rules, ...none, namedModel: true, tokens: 0 });
  assert.equal(zero.breakdown.find((line) => line.label.startsWith("Tokens"))?.label, "Tokens · 0 tokens");
  assert.equal(zero.breakdown.find((line) => line.label.startsWith("Tokens"))?.points, null);
  assert.match(zero.explanation.join("\n"), /Tokens: 0\. Token factor ×20\./);
  assert.doesNotMatch(zero.explanation.join("\n"), /counted as/);
  assert.doesNotMatch(zero.explanation.join("\n"), /factor 1\./i);
  assert.equal(scoreRound({ rules, ...none, namedModel: true, tokens: 1001 }).score, 19980);
});

test("difficulty multiplies after the token factor and the no-hint multiplier", () => {
  const easy = scoreRound({ rules, ...none, namedModel: true, tokens: 500, difficulty: "easy" });
  assert.equal(easy.score, 20000);
  assert.equal(easy.breakdown.at(-1)?.label, "Difficulty · Easy");
  assert.equal(easy.breakdown.at(-1)?.points, null);
  assert.equal(easy.breakdown.at(-1)?.multiplier, "×0.5");
  const easySteps = scoreSteps(easy.breakdown, easy.score);
  assert.equal(easySteps.find((step) => step.kind === "subtotal")?.after, "2,000");
  assert.equal(easySteps.at(-1)?.after, "20,000");
  assert.match(easy.explanation.join("\n"), /Difficulty: Easy ×0\.5\./);
  const medium = scoreRound({ rules, ...none, namedModel: true, tokens: 500, difficulty: "medium" });
  assert.equal(medium.score, 40000);
  assert.equal(medium.breakdown.at(-1)?.multiplier, "×1");
  const hard = scoreRound({ rules, ...none, namedModel: true, tokens: 500, difficulty: "hard" });
  assert.equal(hard.score, 80000);
  assert.equal(hard.breakdown.at(-1)?.multiplier, "×2");
  const stacked = scoreRound({ rules, ...none, namedModel: true, tokens: 500, noHint: true, difficulty: "impossible" });
  assert.equal(stacked.score, 240000);
  assert.deepEqual(
    stacked.breakdown.slice(-3).map((line) => [line.label, line.points, line.multiplier]),
    [
      ["Tokens · 500 tokens", null, "×20"],
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
  assert.equal(result.breakdown.at(-1)?.points, 16000);
  assert.equal(result.breakdown.find((line) => line.label.startsWith("Tokens"))?.multiplier, "×20");
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
      gameMode: "all",
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
    regionCorrect: traits.models[modelId]?.region === hidden.region,
  });

  assert.deepEqual(listed([guess("luna", false)], false), ["haiku", "opus", "sonnet"]);
  assert.deepEqual(eliminatedCompanyIds(traits, [guess("luna", false)], false), ["openai"]);
  assert.deepEqual(listed([guess("sonnet", true)], false), ["haiku", "opus"]);
  assert.deepEqual(eliminatedCompanyIds(traits, [guess("sonnet", true)], false), []);
  assert.deepEqual(listed([guess("luna", false)], true), ["haiku", "opus", "sonnet", "flash", "gpt"]);
  assert.deepEqual(eliminatedCompanyIds(traits, [guess("luna", false)], true), []);
});

test("a wrong region removes that region's models from the list", () => {
  const models = [
    model({ id: "haiku", name: "Haiku", companyId: "anthropic", companyName: "Anthropic", region: "us" }),
    model({ id: "luna", name: "Luna", companyId: "openai", companyName: "OpenAI", region: "us" }),
    model({ id: "flash", name: "Flash", companyId: "deepseek", companyName: "DeepSeek", region: "cn" }),
    model({ id: "qwen", name: "Qwen", companyId: "alibaba", companyName: "Alibaba", region: "cn" }),
    model({ id: "mistral", name: "Mistral", companyId: "mistral", companyName: "Mistral", region: "eu" }),
  ];
  const traits = buildTraits(models);
  const listed = (guesses: RecordedGuess[], noHint = false) =>
    toPublicGame({
      id: "game",
      gameMode: "all",
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
  const regionsLeft = (ids: string[]) => ids.map((id) => traits.models[id]?.region);

  const afterModel = listed([
    {
      turn: 1,
      modelId: "flash",
      modelCorrect: false,
      companyCorrect: false,
      regionCorrect: false,
    },
  ]);
  assert.equal(regionsLeft(afterModel).includes("cn"), false);
  assert.deepEqual(afterModel, ["haiku", "mistral", "luna"]);

  const afterRegion = listed([
    {
      turn: 1,
      modelId: null,
      region: "eu",
      modelCorrect: false,
      companyCorrect: false,
      regionCorrect: false,
    },
  ]);
  assert.equal(regionsLeft(afterRegion).includes("eu"), false);
  assert.deepEqual(afterRegion, ["qwen", "haiku", "flash", "luna"]);

  const blind = listed(
    [
      {
        turn: 1,
        modelId: "flash",
        modelCorrect: false,
        companyCorrect: false,
        regionCorrect: false,
      },
    ],
    true,
  );
  assert.equal(blind.includes("qwen"), true);
  assert.equal(blind.includes("flash"), false);
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
    ["flash", "luna"],
  );
  assert.deepEqual(named[0]?.wrong, ["company", "region"]);
  assert.equal(named[0]?.message, 2);
  assert.deepEqual(named[1]?.wrong, ["company"]);
  assert.equal(named[1]?.message, 1);
  assert.deepEqual(missedGuesses(traits, guesses, true)[0]?.wrong, []);
  const history = fs.readFileSync(path.join(root, "components/guess-history.tsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(history, /!noHint && index === 0/);
  assert.match(history, /className="past-message">Message \{guess\.message\}/);
  assert.match(css, /\.past-message \{ margin-left: auto;/);
  assert.match(history, /Wrong model/);
});

test("the header counts the message about to be written", () => {
  assert.equal(upcomingMessageNumber(0, 10), 1);
  assert.equal(upcomingMessageNumber(2, 10), 3);
  assert.equal(upcomingMessageNumber(9, 10), 10);
  assert.equal(upcomingMessageNumber(10, 10), 10);
  const board = fs.readFileSync(path.join(root, "components/round-board.tsx"), "utf8");
  const fit = fs.readFileSync(path.join(root, "components/use-guess-fit.ts"), "utf8");
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(board, /upcomingMessageNumber\(game\.messageNumber, game\.messageLimit\)/);
  assert.match(board, /className="round-pool muted"/);
  assert.match(css, /\.round-pool \{ display: block; \}/);
  assert.match(css, /\.round-pool-sep \{ display: none; \}/);
  assert.match(css, /\.give-up \{ grid-column: 2; grid-row: 1; \}/);
  assert.match(css, /\.progress \{ grid-column: 1 \/ -1; grid-row: 2; width: 100%; \}/);
  assert.match(board, /Guess for message \{guessFor\}/);
  assert.match(board, /You already guessed for this message\./);
  assert.match(board, /It's your last guess!/);
  assert.match(board, /disabled=\{!canGuess \|\| !selected \|\| guessBusy \|\| busy\}/);
  assert.match(board, /placeholder="Search models"/);
  assert.doesNotMatch(board, /game\.awaitingGuess \? \(/);
  assert.match(css, /max-height: calc\(100dvh - 32px\)/);
  assert.match(css, /\.guess-history \{ flex: none; overflow: hidden; \}/);
  assert.match(css, /\.guess-history \{ --fit: 1; \}/);
  assert.match(css, /\.guess-history h2 \{ font-size: 16px; margin-bottom: 4px; \}/);
  assert.doesNotMatch(css, /\.guess-history h2 \{[^}]*var\(--fit\)/);
  assert.match(fit, /setProperty\("--fit"/);
  assert.doesNotMatch(fit, /side\.style\.height/);
  assert.match(fit, /Math\.max\(stickyTop, threadTop\)/);
  assert.match(fit, /Math\.min\(window\.innerHeight - gap, composerBottom\)/);
  assert.match(css, /\.page \{ flex: 1; padding: 20px 0 0; \}/);
});

test("hints are possible on daily, all models, company, category, and custom", () => {
  assert.equal(gameModeAllowsHints("daily"), true);
  assert.equal(gameModeAllowsHints("all"), true);
  assert.equal(gameModeAllowsHints("company"), true);
  assert.equal(gameModeAllowsHints("class"), true);
  assert.equal(gameModeAllowsHints("custom"), true);
  for (const gameMode of ["region", "latest"]) {
    assert.equal(gameModeAllowsHints(gameMode), false, gameMode);
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
    gameMode: "all",
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
