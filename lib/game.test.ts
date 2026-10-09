import assert from "node:assert/strict";
import test from "node:test";
import { rulesForCategory } from "./config";
import {
  buildTraits,
  filterCandidates,
  knownValues,
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
    logoPath: "/logos/x.svg",
    ...partial,
  };
}

test("solved example scores 4900", () => {
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
  assert.equal(result.score, 4900);
  assert.deepEqual(
    result.breakdown.map((line) => line.points),
    [1000, 1000, 3000, -100],
  );
  assert.equal(result.breakdown.reduce((sum, line) => sum + line.points, 0), 4900);
  assert.match(result.explanation[1] ?? "", /1,000 for naming the model/);
  assert.match(result.explanation.join("\n"), /Token factor 1,000\/500/);
  assert.match(result.explanation.join("\n"), /Message factor 5\/2/);
  assert.match(result.explanation.join("\n"), /Year −100/);
});

test("no-hint solve without a year purchase scores 7500", () => {
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
  assert.equal(result.score, 7500);
  assert.equal(result.breakdown.at(-1)?.label.startsWith("No-hint"), true);
  assert.match(result.explanation.join("\n"), /No-hint: ×1\.5/);
  assert.match(result.explanation.join("\n"), /Hints: none/);
});

test("a miss with region and company scores 200", () => {
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
  assert.equal(result.score, 200);
  assert.equal(result.breakdown.reduce((sum, line) => sum + line.points, 0), 200);
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
  assert.equal(result.score, 67);
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
