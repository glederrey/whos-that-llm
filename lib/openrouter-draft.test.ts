import assert from "node:assert/strict";
import test from "node:test";
import { companyForOrg, draftFromOpenRouter, priceInputFromPerToken, releasedOnFromCreated, type CompanyChoice } from "./openrouter-draft";

const companies: CompanyChoice[] = [
  { id: "anthropic", name: "Anthropic", region: "us" },
  { id: "alibaba", name: "Alibaba", region: "cn" },
  { id: "xai", name: "xAI", region: "us" },
  { id: "mistral", name: "Mistral", region: "eu" },
];

test("the release date is the UTC day of OpenRouter's created timestamp", () => {
  assert.equal(releasedOnFromCreated(1754411591), "2025-08-05");
  assert.equal(releasedOnFromCreated(1685232000), "2023-05-28");
  assert.equal(releasedOnFromCreated(0), "");
  assert.equal(releasedOnFromCreated(null), "");
  assert.equal(releasedOnFromCreated("nope"), "");
});

test("list prices use the roster rounding", () => {
  assert.equal(priceInputFromPerToken("0.000015"), "15");
  assert.equal(priceInputFromPerToken("0.000075"), "75");
  assert.equal(priceInputFromPerToken("0.00000005"), "0.1");
  assert.equal(priceInputFromPerToken("0.000000018"), "0.02");
  assert.equal(priceInputFromPerToken(""), "");
  assert.equal(priceInputFromPerToken(null), "");
});

test("a draft fills name, a known company, the date, and prices", () => {
  const draft = draftFromOpenRouter(
    {
      id: "anthropic/claude-opus-4.1",
      name: "Anthropic: Claude Opus 4.1",
      created: 1754411591,
      pricing: { prompt: "0.000015", completion: "0.000075" },
    },
    companies,
  );
  assert.deepEqual(draft, {
    name: "Anthropic: Claude Opus 4.1",
    company: "Anthropic",
    region: "us",
    releasedOn: "2025-08-05",
    inputPrice: "15",
    outputPrice: "75",
  });
});

test("company is filled only when the org is one of ours", () => {
  assert.equal(companyForOrg("qwen", companies)?.name, "Alibaba");
  assert.equal(companyForOrg("x-ai", companies)?.name, "xAI");
  assert.equal(companyForOrg("mistralai", companies)?.region, "eu");
  assert.equal(companyForOrg("nousresearch", companies), null);
  assert.equal(companyForOrg("anthropic", []), null);
  const blank = draftFromOpenRouter(
    { id: "nousresearch/hermes", name: "Hermes", created: 1754411591, pricing: {} },
    companies,
  );
  assert.equal(blank.company, "");
  assert.equal(blank.region, "");
  assert.equal(blank.inputPrice, "");
  assert.equal(blank.outputPrice, "");
  assert.equal("size" in blank, false);
  assert.equal("difficulty" in blank, false);
});
