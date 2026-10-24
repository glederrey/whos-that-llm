import assert from "node:assert/strict";
import test from "node:test";
import { companyForModel, companyForOrg, draftFromOpenRouter, releasedOnFromCreated, type CompanyChoice } from "./openrouter-draft";

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
    companyId: "anthropic",
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
  assert.equal(blank.companyId, "");
  assert.equal("size" in blank, false);
  assert.equal("difficulty" in blank, false);
});

test("the lab in the model name picks the company before the org slug does", () => {
  const list: CompanyChoice[] = [...companies, { id: "moonshot", name: "Moonshot", origin: "cn" }, { id: "zai", name: "Z.ai", origin: "cn" }];
  assert.equal(companyForModel("moonshotai/kimi-k3", "MoonshotAI: Kimi K3", list)?.id, "moonshot");
  assert.equal(companyForModel("z-ai/glm-5", "Z.AI: GLM 5", list)?.id, "zai");
  assert.equal(companyForModel("somebody/model", "Anthropic: Something", list)?.id, "anthropic");
  assert.equal(companyForModel("qwen/qwen3", "Qwen: Qwen3", list)?.id, "alibaba");
  assert.equal(companyForModel("nousresearch/hermes", "Hermes", list), null);
});
