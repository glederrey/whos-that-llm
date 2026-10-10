import assert from "node:assert/strict";
import test from "node:test";
import { rulesForCategory } from "./config";
import {
  buildTraits,
  filterCandidates,
  knownValues,
  missedGuesses,
  scoreRound,
  type FrozenModel,
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

test("solved example scores 9900 before a wrong guess", () => {
  const result = scoreRound({
    rules,
    namedModel: true,
    regionMatched: true,
    companyMatched: true,
    regionGiven: false,
    companyGiven: false,
    tokens: 500,
    messages: 2,
    noHint: false,
    hints: ["year"],
  });
  assert.equal(result.score, 9900);
  assert.deepEqual(
    result.breakdown.map((line) => line.points),
    [1000, 1000, 8000, -100],
  );
  assert.equal(result.breakdown.reduce((sum, line) => sum + line.points, 0), 9900);
  assert.match(result.explanation[1] ?? "", /1,000 for naming the model/);
  assert.match(result.explanation.join("\n"), /Token factor 1,000\/500/);
  assert.match(result.explanation.join("\n"), /Message factor 10\/2/);
  assert.match(result.explanation.join("\n"), /Year −100/);
  assert.match(result.explanation.join("\n"), /Wrong guesses: none/);
});

test("one wrong guess subtracts 50 after the multipliers", () => {
  const result = scoreRound({
    rules,
    namedModel: true,
    regionMatched: true,
    companyMatched: true,
    regionGiven: false,
    companyGiven: false,
    tokens: 500,
    messages: 2,
    noHint: false,
    hints: ["year"],
    wrongGuesses: 1,
  });
  assert.equal(result.score, 9850);
  assert.deepEqual(result.breakdown.map((line) => line.points), [1000, 1000, 8000, -100, -50]);
  assert.equal(result.breakdown.reduce((sum, line) => sum + line.points, 0), result.score);
  assert.match(result.explanation.join("\n"), /Wrong guesses: 1 × −50/);
});

test("no-hint solve without a year purchase scores 15000", () => {
  const result = scoreRound({
    rules,
    namedModel: true,
    regionMatched: false,
    companyMatched: false,
    regionGiven: false,
    companyGiven: false,
    tokens: 500,
    messages: 2,
    noHint: true,
    hints: [],
  });
  assert.equal(result.score, 15000);
  assert.equal(result.breakdown.at(-1)?.label.startsWith("No-hint"), true);
  assert.match(result.explanation.join("\n"), /No-hint: ×1\.5/);
  assert.match(result.explanation.join("\n"), /Hints: none/);
});

test("a miss with region and company scores 400 before wrong guesses", () => {
  const result = scoreRound({
    rules,
    namedModel: false,
    regionMatched: true,
    companyMatched: true,
    regionGiven: false,
    companyGiven: false,
    tokens: 2000,
    messages: 5,
    noHint: false,
    hints: [],
  });
  assert.equal(result.score, 400);
  assert.equal(result.breakdown.reduce((sum, line) => sum + line.points, 0), 400);
});

test("zero tokens use a factor of 1 and hints can make the total negative", () => {
  const result = scoreRound({
    rules,
    namedModel: false,
    regionMatched: false,
    companyMatched: false,
    regionGiven: false,
    companyGiven: false,
    tokens: 0,
    messages: 1,
    noHint: false,
    hints: ["year"],
  });
  assert.equal(result.score, -100);
  assert.match(result.explanation.join("\n"), /Token factor 1/);
});

test("fractional tokens round on the multiplier lines and still add up", () => {
  const result = scoreRound({
    rules,
    namedModel: false,
    regionMatched: true,
    companyMatched: false,
    regionGiven: false,
    companyGiven: false,
    tokens: 1500,
    messages: 5,
    noHint: false,
    hints: [],
  });
  assert.equal(result.score, 133);
  assert.equal(result.breakdown.reduce((sum, line) => sum + line.points, 0), result.score);
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
