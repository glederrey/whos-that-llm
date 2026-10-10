import assert from "node:assert/strict";
import test from "node:test";
import {
  canTurnOn,
  companyIdFromName,
  emailsMatch,
  modelIdFromOpenRouter,
  parseModelFields,
  parseRegion,
  parseYear,
  releasedOnForYear,
  rosterNotice,
} from "./admin-model";

test("email match is case-insensitive and rejects blanks", () => {
  assert.equal(emailsMatch(" Owner@Example.com ", "owner@example.com"), true);
  assert.equal(emailsMatch("other@example.com", "owner@example.com"), false);
  assert.equal(emailsMatch(null, "owner@example.com"), false);
  assert.equal(emailsMatch("owner@example.com", ""), false);
  assert.equal(emailsMatch("  ", "owner@example.com"), false);
});

test("model ids come from the OpenRouter id", () => {
  assert.equal(modelIdFromOpenRouter("openai/gpt-5.6-luna"), "gpt-5-6-luna");
  assert.equal(modelIdFromOpenRouter("anthropic/claude-haiku-4.5"), "claude-haiku-4-5");
  assert.equal(modelIdFromOpenRouter("no-slash"), null);
  assert.equal(modelIdFromOpenRouter("has space/model"), null);
});

test("company ids are short slugs", () => {
  assert.equal(companyIdFromName("OpenAI"), "openai");
  assert.equal(companyIdFromName("DeepSeek"), "deepseek");
  assert.equal(companyIdFromName("A"), null);
});

test("year edits keep a real month and day", () => {
  assert.equal(releasedOnForYear("2025-10-15", 2025), "2025-10-15");
  assert.equal(releasedOnForYear("2025-10-15", 2026), "2026-10-15");
  assert.equal(releasedOnForYear("2024-02-29", 2025), "2025-01-01");
  assert.equal(releasedOnForYear(null, 2026), "2026-01-01");
});

test("a reasoning model cannot turn on with empty settings", () => {
  assert.equal(canTurnOn({ releasedOn: null, reasoning: false, providerSettings: {} }), false);
  assert.equal(canTurnOn({ releasedOn: "2026-01-01", reasoning: true, providerSettings: {} }), false);
  assert.equal(canTurnOn({ releasedOn: "2026-01-01", reasoning: true, providerSettings: { reasoning: { effort: "low" } } }), true);
  assert.equal(canTurnOn({ releasedOn: "2026-01-01", reasoning: false, providerSettings: {} }), true);
});

test("model fields reject a bad region or year", () => {
  assert.equal(parseRegion("USA"), "us");
  assert.equal(parseYear("1999"), null);
  assert.equal(
    parseModelFields({
      openrouterId: "openai/gpt-5.6-luna",
      name: "GPT-5.6 Luna",
      company: "OpenAI",
      region: "USA",
      year: "2026",
      size: "small",
    })?.region,
    "us",
  );
  assert.equal(parseModelFields({ openrouterId: "openai/gpt-5.6-luna", name: "GPT", company: "OpenAI", region: "moon", year: "2026", size: "small" }), null);
});

test("unknown notices stay blank", () => {
  assert.equal(rosterNotice("duplicate"), "That OpenRouter id is already on a model.");
  assert.equal(rosterNotice("admin"), null);
  assert.equal(rosterNotice(undefined), null);
});
