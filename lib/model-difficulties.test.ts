import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { difficulties, difficultyNumber, inDifficultyPool } from "./difficulty";
import { modelDifficulties } from "./model-difficulties";

const root = path.join(import.meta.dirname, "..");

function sqlPairs(file: string, pattern: RegExp): Array<[string, string]> {
  const whole = fs.readFileSync(path.join(root, file), "utf8");
  const start = whole.indexOf("insert into public.models (");
  const text = whole.slice(start, whole.indexOf(";\n", start));
  return [...text.matchAll(pattern)].map((match) => [match[1], match[2]]);
}

test("a harder game includes every easier tier", () => {
  assert.equal(inDifficultyPool("easy", "easy"), true);
  assert.equal(inDifficultyPool("medium", "easy"), false);
  assert.equal(inDifficultyPool("easy", "medium"), true);
  assert.equal(inDifficultyPool("medium", "medium"), true);
  assert.equal(inDifficultyPool("hard", "medium"), false);
  assert.equal(inDifficultyPool("hard", "hard"), true);
  assert.equal(inDifficultyPool("impossible", "hard"), false);
  for (const model of difficulties) assert.equal(inDifficultyPool(model, "impossible"), true);
});

const nameForNumber: Record<string, string> = { "1": "easy", "2": "medium", "3": "hard", "4": "impossible" };

test("stored difficulties are 1 through 4", () => {
  assert.deepEqual(difficultyNumber, { easy: 1, medium: 2, hard: 3, impossible: 4 });
});

test("the baseline classifies the same 144 models", () => {
  const fromBaseline = sqlPairs("supabase/migrations/20261021080000_baseline.sql", /\('([a-z0-9-]+)'(?:, [^,\n]+){8}, ([1-4])\)/g).map(
    ([id, number]) => [id, nameForNumber[number]] as [string, string],
  );
  assert.equal(fromBaseline.length, 144);
  assert.deepEqual(Object.fromEntries(fromBaseline), modelDifficulties);
  const counts = { easy: 0, medium: 0, hard: 0, impossible: 0 };
  for (const level of Object.values(modelDifficulties)) counts[level] += 1;
  assert.deepEqual(counts, { easy: 12, medium: 25, hard: 41, impossible: 66 });
  const text = fs.readFileSync(path.join(root, "supabase/migrations/20261021080000_baseline.sql"), "utf8");
  assert.match(text, /p_difficulty is null and g\.difficulty is not null/);
  assert.match(text, /difficulty smallint/);
  assert.match(text, /no_hint boolean/);
});
