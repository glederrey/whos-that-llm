import assert from "node:assert/strict";
import test from "node:test";
import { companyForOrg, draftFromOpenRouter, releasedOnFromCreated, type CompanyChoice } from "./openrouter-draft";

const companies: CompanyChoice[] = [
  { id: "anthropic", name: "Anthropic", origin: "us" },
  { id: "alibaba", name: "Alibaba", origin: "cn" },
  { id: "xai", name: "xAI", origin: "us" },
  { id: "mistral", name: "Mistral", origin: "eu" },
];

test("the release date is the UTC day of OpenRouter's created timestamp", () => {
  assert.equal(releasedOnFromCreated(1754411591), "2025-08-05");
  assert.equal(releasedOnFromCreated(1685232000), "2023-05-28");
  assert.equal(releasedOnFromCreated(0), "");
  assert.equal(releasedOnFromCreated(null), "");
  assert.equal(releasedOnFromCreated("nope"), "");
});

test("a draft fills name, a known company, and the date", () => {
  const draft = draftFromOpenRouter(
    {
      id: "anthropic/claude-opus-4.1",
      name: "Anthropic: Claude Opus 4.1",
      created: 1754411591,
    },
    companies,
  );
  assert.deepEqual(draft, {
    name: "Anthropic: Claude Opus 4.1",
    company: "Anthropic",
    origin: "us",
    releasedOn: "2025-08-05",
  });
});

test("company is filled only when the org is one of ours", () => {
  assert.equal(companyForOrg("qwen", companies)?.name, "Alibaba");
  assert.equal(companyForOrg("x-ai", companies)?.name, "xAI");
  assert.equal(companyForOrg("mistralai", companies)?.origin, "eu");
  assert.equal(companyForOrg("nousresearch", companies), null);
  assert.equal(companyForOrg("anthropic", []), null);
  const blank = draftFromOpenRouter(
    { id: "nousresearch/hermes", name: "Hermes", created: 1754411591 },
    companies,
  );
  assert.equal(blank.company, "");
  assert.equal(blank.origin, "");
  assert.equal("size" in blank, false);
  assert.equal("difficulty" in blank, false);
});
