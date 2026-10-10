import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { stripPlaceholderText, stripSensitivePlaceholders } from "../scripts/strip-sensitive-placeholders.mjs";

test("placeholder lines are removed and real values stay", () => {
  const source = `# Created by Vercel CLI
OPENROUTER_API_KEY="sk-or-v1-test"
OPENROUTER_MANAGEMENT_KEY="[SENSITIVE]"
NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co"
`;
  const result = stripPlaceholderText(source);
  assert.deepEqual(result.removed, ["OPENROUTER_MANAGEMENT_KEY"]);
  assert.match(result.text, /OPENROUTER_API_KEY="sk-or-v1-test"/);
  assert.match(result.text, /NEXT_PUBLIC_SUPABASE_URL=/);
  assert.doesNotMatch(result.text, /OPENROUTER_MANAGEMENT_KEY/);
  assert.doesNotMatch(result.text, /\[SENSITIVE\]/);
});

test("pulled vercel env files lose only redacted secrets", () => {
  const root = mkdtempSync(join(tmpdir(), "env-strip-"));
  const vercelDir = join(root, ".vercel");
  mkdirSync(vercelDir);
  const file = join(vercelDir, ".env.production.local");
  writeFileSync(
    file,
    'OPENROUTER_API_KEY="sk-or-v1-test"\nOPENROUTER_MANAGEMENT_KEY="[SENSITIVE]"\nNEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co"\n',
  );
  const removed = stripSensitivePlaceholders(root);
  assert.deepEqual(removed, [{ file: join(".vercel", ".env.production.local"), name: "OPENROUTER_MANAGEMENT_KEY" }]);
  const text = readFileSync(file, "utf8");
  assert.doesNotMatch(text, /\[SENSITIVE\]/);
  assert.doesNotMatch(text, /OPENROUTER_MANAGEMENT_KEY/);
  assert.match(text, /OPENROUTER_API_KEY="sk-or-v1-test"/);
  assert.match(text, /NEXT_PUBLIC_SUPABASE_URL="https:\/\/example.supabase.co"/);
});
