import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  formatSyncPrice,
  mergeCatalogPages,
  nextModelsUrl,
  openRouterModelHref,
  parseCatalogPage,
  parseOpenRouterCatalog,
  planNewModels,
  planPriceUpdates,
  planUnavailable,
  sameRosterModel,
  type CatalogModel,
  type SyncModel,
} from "./roster-sync";

const root = path.resolve(import.meta.dirname, "..");

function listed(
  id: string,
  input: number | null,
  output: number | null,
  extra?: Partial<CatalogModel>,
): CatalogModel {
  return {
    id,
    name: extra?.name ?? "",
    description: extra?.description ?? null,
    created: extra?.created ?? null,
    inputUsdPerMtok: input,
    outputUsdPerMtok: output,
    outputModalities: extra?.outputModalities ?? [],
    modality: extra?.modality ?? null,
  };
}

function model(fields: {
  id: string;
  openrouterId: string;
  name?: string;
  input?: number | null;
  output?: number | null;
  enabled?: boolean;
}): SyncModel {
  return {
    id: fields.id,
    name: fields.name ?? fields.id,
    openrouterId: fields.openrouterId,
    inputUsdPerMtok: fields.input === undefined ? null : fields.input,
    outputUsdPerMtok: fields.output === undefined ? null : fields.output,
    enabled: fields.enabled ?? true,
  };
}

test("a per-token catalog price is the roster list price", () => {
  const catalog = parseOpenRouterCatalog({
    data: [
      { id: "anthropic/claude-opus-4.1", pricing: { prompt: "0.000015", completion: "0.000075" } },
      { id: "free/zero", pricing: { prompt: 0, completion: "0" } },
      { id: "nousresearch/hermes", pricing: {} },
      { id: "partial/input", pricing: { prompt: "0.000001", completion: "-1" } },
      { id: "  spaced/id  ", name: "ignored" },
      { name: "no id" },
      null,
    ],
  });
  assert.deepEqual(catalog, [
    listed("anthropic/claude-opus-4.1", 15, 75),
    listed("free/zero", 0, 0),
    listed("nousresearch/hermes", null, null),
    listed("partial/input", 1, null),
    listed("spaced/id", null, null, { name: "ignored" }),
  ]);
  assert.equal(parseOpenRouterCatalog(null), null);
  assert.equal(parseOpenRouterCatalog({}), null);
  assert.equal(parseOpenRouterCatalog({ data: {} }), null);
  assert.deepEqual(parseOpenRouterCatalog({ data: [] }), []);
  const replaced = parseOpenRouterCatalog({
    data: [
      { id: "a/b", pricing: { prompt: "0.000001", completion: "0.000001" } },
      { id: "a/b", pricing: { prompt: "0.000002", completion: "0.000003" } },
    ],
  });
  const later = planPriceUpdates([model({ id: "ab", name: "AB", openrouterId: "a/b", input: 1, output: 1 })], replaced ?? []);
  assert.deepEqual(later.updates, [{ id: "ab", inputUsdPerMtok: 2, outputUsdPerMtok: 3 }]);
});

test("a catalog page is complete only when every model was returned", () => {
  const page = parseCatalogPage({
    data: [{ id: "openai/one", pricing: { prompt: "0.000001", completion: "0.000002" } }],
    total_count: 2,
    links: { next: "/api/v1/models?offset=1&limit=1" },
  });
  assert.equal(page?.total, 2);
  assert.equal(page?.next, "/api/v1/models?offset=1&limit=1");
  assert.equal(nextModelsUrl(page?.next ?? ""), "https://openrouter.ai/api/v1/models?offset=1&limit=1");
  assert.equal(nextModelsUrl("https://openrouter.ai/api/v1/models?offset=1"), "https://openrouter.ai/api/v1/models?offset=1");
  assert.equal(nextModelsUrl("https://evil.example/api/v1/models"), null);
  assert.equal(nextModelsUrl("https://openrouter.ai.evil.example/api/v1/models"), null);
  assert.equal(nextModelsUrl("/api/v1/keys"), null);
  assert.equal(parseCatalogPage({ data: [], total_count: "2" }), null);
  const second = parseCatalogPage({
    data: [{ id: "openai/two", pricing: { prompt: "0", completion: "0" } }],
    total_count: 2,
    links: { next: null },
  });
  assert.ok(page && second);
  assert.equal(mergeCatalogPages([page]), null);
  assert.deepEqual(
    mergeCatalogPages([page, second])?.map((model) => model.id),
    ["openai/one", "openai/two"],
  );
  assert.equal(mergeCatalogPages([{ models: [], total: 0, next: null }]), null);
});

test("price updates list changes and leave matching or unpriced models alone", () => {
  const catalog: CatalogModel[] = [
    listed("anthropic/claude-opus-4.1", 20, 75),
    listed("openai/same", 2, 10),
    listed("nousresearch/hermes", null, null),
    listed("partial/input", 1, null),
    listed("new/price", 0, 0.2),
  ];
  const plan = planPriceUpdates(
    [
      model({ id: "opus", name: "Claude Opus 4.1", openrouterId: "anthropic/claude-opus-4.1", input: 15, output: 75 }),
      model({ id: "same", name: "Same", openrouterId: "openai/same", input: 2, output: 10 }),
      model({ id: "hermes", name: "Hermes", openrouterId: "nousresearch/hermes", input: 1, output: 2 }),
      model({ id: "partial", name: "Partial", openrouterId: "partial/input", input: 1, output: 5 }),
      model({ id: "gone", name: "Gone", openrouterId: "openai/gone", input: 3, output: 15 }),
      model({ id: "fresh", name: "Fresh", openrouterId: "new/price", input: null, output: null }),
      model({ id: "padded", name: "Padded", openrouterId: "  openai/same  ", input: 2, output: 10 }),
    ],
    catalog,
  );
  assert.deepEqual(plan.changes, [
    {
      id: "opus",
      name: "Claude Opus 4.1",
      input: { oldPrice: 15, newPrice: 20 },
      output: null,
    },
    {
      id: "fresh",
      name: "Fresh",
      input: { oldPrice: null, newPrice: 0 },
      output: { oldPrice: null, newPrice: 0.2 },
    },
  ]);
  assert.deepEqual(
    plan.notUpdated.map((row) => row.name),
    ["Hermes", "Partial", "Gone"],
  );
  assert.deepEqual(plan.updates, [
    { id: "opus", inputUsdPerMtok: 20, outputUsdPerMtok: 75 },
    { id: "fresh", inputUsdPerMtok: 0, outputUsdPerMtok: 0.2 },
  ]);
  assert.equal(plan.changes.some((row) => row.name === "Same"), false);
  assert.equal(plan.notUpdated.some((row) => row.name === "Same"), false);
  assert.equal(formatSyncPrice(15), "$15");
  assert.equal(formatSyncPrice(0.2), "$0.2");
  assert.equal(formatSyncPrice(0), "$0");
  assert.equal(formatSyncPrice(null), "—");
});

test("availability turns off models OpenRouter no longer lists", () => {
  const catalog: CatalogModel[] = [
    listed("openai/still", 1, 2),
    listed("openai/off-but-listed", 1, 2),
  ];
  const plan = planUnavailable(
    [
      model({ id: "still", name: "Still", openrouterId: "openai/still", enabled: true }),
      model({ id: "resting", name: "Resting", openrouterId: "openai/off-but-listed", enabled: false }),
      model({ id: "gone", name: "Gone", openrouterId: "openai/gone", enabled: true }),
      model({ id: "old", name: "Old", openrouterId: "openai/old", enabled: false }),
    ],
    catalog,
  );
  assert.deepEqual(plan?.unavailable.map((row) => row.name), ["Gone", "Old"]);
  assert.deepEqual(plan?.disableIds, ["gone"]);
  assert.equal(planUnavailable([model({ id: "still", openrouterId: "openai/still" })], []), null);
});

test("a catalog row keeps the name, description, created time, and text outputs", () => {
  const parsed = parseOpenRouterCatalog({
    data: [
      {
        id: "org/chat",
        name: " Chat ",
        description: " A short line ",
        created: 1_700_000_000,
        architecture: { modality: "text+image->text", output_modalities: ["Text", "Image"] },
        pricing: { prompt: "0.000001", completion: "0.000002" },
      },
      { id: "org/from-modality", architecture: { modality: "text->text+audio" } },
      { id: "org/blank-description", description: "  ", created: 0 },
    ],
  });
  assert.equal(parsed?.[0].name, "Chat");
  assert.equal(parsed?.[0].description, "A short line");
  assert.equal(parsed?.[0].created, 1_700_000_000);
  assert.deepEqual(parsed?.[0].outputModalities, ["text", "image"]);
  assert.deepEqual(parsed?.[1].outputModalities, ["text", "audio"]);
  assert.equal(parsed?.[1].modality, "text->text+audio");
  assert.equal(parsed?.[2].description, null);
  assert.equal(parsed?.[2].created, null);
  assert.deepEqual(parsed?.[2].outputModalities, []);
});

test("a dated snapshot is the same roster model", () => {
  const dated = { id: "deepseek-v4-pro-0813", openrouterId: "deepseek/deepseek-v4-pro-0813" };
  assert.equal(sameRosterModel("deepseek/deepseek-v4-pro", dated), true);
  assert.equal(sameRosterModel("deepseek/deepseek-v4-pro-0813", { id: "deepseek-v4-pro", openrouterId: "deepseek/deepseek-v4-pro" }), true);
  assert.equal(sameRosterModel("moonshotai/kimi-k3", { id: "kimi-k3", openrouterId: "other/saved-handle" }), true);
  assert.equal(sameRosterModel("DeepSeek/DeepSeek-V4-Pro", dated), true);
  assert.equal(sameRosterModel("qwen/qwen3.8-max-0902", { id: "qwen3-8-max", openrouterId: "qwen/qwen3.8-max" }), true);
  assert.equal(sameRosterModel("qwen/qwen3-5-plus-20260420", { id: "qwen3-5-plus", openrouterId: "qwen/qwen3-5-plus" }), true);
  assert.equal(sameRosterModel("qwen/qwen3-5-flash-02-23", { id: "qwen3-5-flash", openrouterId: "qwen/qwen3-5-flash" }), true);
  assert.equal(sameRosterModel("mistralai/mistral-small-2603", { id: "mistral-small", openrouterId: "mistralai/mistral-small" }), true);
  assert.equal(sameRosterModel("deepseek/deepseek-r1-0528", { id: "deepseek-r1", openrouterId: "deepseek/deepseek-r1" }), true);
  assert.equal(sameRosterModel("deepseek/deepseek-v4-flash", { id: "deepseek-v4-pro", openrouterId: "deepseek/deepseek-v4-pro" }), false);
  assert.equal(sameRosterModel("anthropic/claude-opus-4.1", { id: "claude-opus-4", openrouterId: "anthropic/claude-opus-4" }), false);
  assert.equal(sameRosterModel("deepseek/deepseek-v4-1-flash", { id: "deepseek-v4-flash", openrouterId: "deepseek/deepseek-v4-flash" }), false);
  assert.equal(sameRosterModel("x-ai/grok-4.20", { id: "grok-4", openrouterId: "x-ai/grok-4" }), false);
  assert.equal(sameRosterModel("openai/gpt-5.4", { id: "gpt-5", openrouterId: "openai/gpt-5" }), false);
});

test("new models are recent text models that are not already on the roster", () => {
  const now = 1_800_000_000;
  const day = 86_400;
  function remote(id: string, extra: Partial<CatalogModel> = {}): CatalogModel {
    return {
      id,
      name: extra.name ?? id,
      description: extra.description ?? null,
      created: extra.created === undefined ? now : extra.created,
      inputUsdPerMtok: extra.inputUsdPerMtok === undefined ? 1 : extra.inputUsdPerMtok,
      outputUsdPerMtok: extra.outputUsdPerMtok === undefined ? 2 : extra.outputUsdPerMtok,
      outputModalities: extra.outputModalities ?? ["text"],
      modality: extra.modality === undefined ? "text->text" : extra.modality,
    };
  }
  const roster = [
    model({ id: "deepseek-v4-pro-0813", openrouterId: "deepseek/deepseek-v4-pro-0813" }),
    model({ id: "kimi-k3", openrouterId: "moonshotai/kimi-k3" }),
  ];
  const cards = planNewModels(
    roster,
    [
      remote("deepseek/deepseek-v4-pro", { name: "DeepSeek V4 Pro", created: now }),
      remote("moonshotai/kimi-k3", { created: now }),
      remote("anthropic/claude-opus-4.1", { name: "Claude Opus 4.1", created: now - 10, description: "A short line" }),
      remote("deepseek/deepseek-v4-1-flash", { created: now - 5 }),
      remote("nousresearch/brand-new", { name: "Brand New", created: now - 20, inputUsdPerMtok: 0.4, outputUsdPerMtok: 1.2 }),
      remote("org/mixed", { created: now - 30, outputModalities: ["text", "image"], modality: "text->text+image" }),
      remote("org/spoken", { created: now - 40, outputModalities: ["text", "audio"], modality: "text->text+audio" }),
      remote("org/edge", { created: now - 30 * day }),
      remote("org/old", { created: now - 30 * day - 1 }),
      remote("org/undated", { created: null }),
      remote("org/picture", { created: now, outputModalities: ["image"], modality: "text->image" }),
      remote("org/sound", { created: now, outputModalities: ["audio"], modality: "text->audio" }),
      remote("openai/text-embedding-3-small", { name: "Embed", created: now, outputModalities: ["text"] }),
      remote("openai/text-moderation", { name: "Moderation", created: now }),
      remote("org/guard", { name: "Llama Guard", created: now - 15 }),
      remote("not a handle", { created: now }),
    ],
    now,
  );
  assert.deepEqual(
    cards.map((card) => card.id),
    [
      "deepseek/deepseek-v4-1-flash",
      "anthropic/claude-opus-4.1",
      "org/guard",
      "nousresearch/brand-new",
      "org/mixed",
      "org/spoken",
      "org/edge",
    ],
  );
  const opus = cards.find((card) => card.id === "anthropic/claude-opus-4.1");
  assert.equal(opus?.name, "Claude Opus 4.1");
  assert.equal(opus?.description, "A short line");
  assert.equal(opus?.releasedOn, new Date((now - 10) * 1000).toISOString().slice(0, 10));
  const brand = cards.find((card) => card.id === "nousresearch/brand-new");
  assert.equal(brand?.inputUsdPerMtok, 0.4);
  assert.equal(brand?.outputUsdPerMtok, 1.2);
  assert.equal(cards.some((card) => card.id === "deepseek/deepseek-v4-pro"), false);
  assert.equal(openRouterModelHref("moonshotai/kimi-k3"), "https://openrouter.ai/moonshotai/kimi-k3");
  assert.equal(openRouterModelHref("moonshotai/kimi k3"), null);
  assert.equal(openRouterModelHref("org/model?x"), null);
  assert.equal(openRouterModelHref("org/../secret"), null);
  assert.deepEqual(planNewModels(roster, [remote("org/chat", { created: now })], Number.NaN), []);
});

test("the model page keeps price updates and availability apart", () => {
  const page = fs.readFileSync(path.join(root, "app/admin/models/page.tsx"), "utf8");
  const buttons = fs.readFileSync(path.join(root, "components/roster-sync.tsx"), "utf8");
  const actions = fs.readFileSync(path.join(root, "app/admin/actions.ts"), "utf8");
  const roster = fs.readFileSync(path.join(root, "lib/admin-roster.ts"), "utf8");
  const catalog = fs.readFileSync(path.join(root, "lib/openrouter-catalog.ts"), "utf8");
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

  assert.match(page, /<RosterSync \/>/);
  assert.match(buttons, /Update prices/);
  assert.match(buttons, /Check availability/);
  assert.match(buttons, /Search for new models/);
  assert.match(buttons, /updateRosterPrices\(\)/);
  assert.match(buttons, /checkRosterAvailability\(\)/);
  assert.match(buttons, /searchNewModels\(\)/);
  assert.match(buttons, /Add models/);
  assert.match(buttons, /Add models[\s\S]{0,700}Close/);
  assert.match(buttons, /Size for \$\{model\.name\}/);
  assert.match(buttons, /Difficulty for \$\{model\.name\}/);
  assert.match(buttons, /!ready/);
  assert.match(buttons, /visible\.length === 0/);
  assert.match(buttons, /No new text models in the last 30 days\./);
  assert.match(buttons, /Added 1 model\./);
  assert.match(buttons, /openRouterModelHref/);
  assert.match(buttons, /target="_blank"/);
  assert.match(buttons, /rel="noreferrer"/);
  assert.match(buttons, /Remove \$\{model\.name\}/);
  assert.match(buttons, /popover="auto"/);
  assert.match(buttons, /roster-edit card roster-sync-card/);
  assert.match(buttons, /role="alert"/);
  assert.match(buttons, /No OpenRouter price/);
  assert.match(buttons, /Not updated/);
  assert.match(buttons, /No longer available/);
  assert.match(buttons, /Every roster price already matches OpenRouter\./);
  assert.match(buttons, /Every roster model is still on OpenRouter\./);
  assert.doesNotMatch(buttons, /redirect\(|router\.push|location\.href/);
  assert.doesNotMatch(buttons, /admin-roster|admin-access|openrouter-spend|showAdmin|isAdmin/);

  const prices = between(actions, "export async function updateRosterPrices", "export async function checkRosterAvailability");
  const availability = between(actions, "export async function checkRosterAvailability", "export async function searchNewModels");
  const search = between(actions, "export async function searchNewModels", "export async function addNewRosterModels");
  const add = actions.slice(actions.indexOf("export async function addNewRosterModels"));
  assert.match(prices, /loadOpenRouterCatalog\(\)/);
  assert.match(prices, /planPriceUpdates\(rows, catalog\.models\)/);
  assert.match(prices, /writeRosterPrices\(plan\.updates\)/);
  assert.match(prices, /catalog\.error/);
  assert.doesNotMatch(prices, /redirect\(|planUnavailable|disableRosterModels/);
  assert.match(availability, /loadOpenRouterCatalog\(\)/);
  assert.match(availability, /planUnavailable\(rows, catalog\.models\)/);
  assert.match(availability, /disableRosterModels\(plan\.disableIds\)/);
  assert.match(availability, /catalog\.error/);
  assert.doesNotMatch(availability, /redirect\(|planPriceUpdates|writeRosterPrices/);
  assert.match(search, /loadOpenRouterCatalog\(\)/);
  assert.match(search, /planNewModels\(rows, catalog\.models/);
  assert.match(search, /catalog\.error/);
  assert.doesNotMatch(search, /redirect\(|insertDiscoveredModels|writeRosterPrices|disableRosterModels|planPriceUpdates|planUnavailable/);
  assert.match(add, /planNewModels\(rows, catalog\.models/);
  assert.match(add, /insertDiscoveredModels\(/);
  assert.match(add, /catalog\.error/);
  assert.doesNotMatch(add, /redirect\(|writeRosterPrices|disableRosterModels|planPriceUpdates|planUnavailable/);
  assert.match(page, /Search for new models/);

  const write = between(roster, "export async function writeRosterPrices", "export async function disableRosterModels");
  const disable = between(roster, "export async function disableRosterModels", "export async function insertDiscoveredModels");
  const insert = between(roster, "export async function insertDiscoveredModels", "async function resolveCompany");
  assert.match(write, /await requireOwner\(\)/);
  assert.match(write, /input_usd_per_mtok: row\.inputUsdPerMtok/);
  assert.match(write, /output_usd_per_mtok: row\.outputUsdPerMtok/);
  assert.doesNotMatch(write, /\.delete\(|enabled/);
  assert.match(disable, /await requireOwner\(\)/);
  assert.match(disable, /enabled: false/);
  assert.doesNotMatch(disable, /\.delete\(|input_usd_per_mtok|output_usd_per_mtok/);
  assert.match(insert, /await requireOwner\(\)/);
  assert.match(insert, /enabled: false/);
  assert.match(insert, /openrouter_id: openrouterId/);
  assert.match(insert, /released_on:/);
  assert.match(insert, /input_usd_per_mtok:/);
  assert.match(insert, /output_usd_per_mtok:/);
  assert.match(insert, /companyForOrg/);
  assert.match(insert, /size,/);
  assert.match(insert, /difficulty: difficultyNumber\[difficulty\]/);
  assert.match(insert, /parseSize\(model\.size\)/);
  assert.match(insert, /parseDifficulty\(model\.difficulty\)/);
  assert.doesNotMatch(insert, /size: "small"|difficultyNumber\.medium/);
  assert.doesNotMatch(insert, /description|model_categories|resolveCompany|\.delete\(/);

  assert.match(catalog, /import "server-only"/);
  assert.match(catalog, /await requireOwner\(\)/);
  assert.match(catalog, /readServerEnv\("OPENROUTER_API_KEY"\)/);
  assert.doesNotMatch(catalog, /process\.env\.OPENROUTER_|OPENROUTER_MANAGEMENT_KEY|sk-or-/);
  assert.match(catalog, /authorization: `Bearer \$\{key\}`/);
  assert.match(catalog, /https:\/\/openrouter\.ai\/api\/v1\/models/);
  assert.match(catalog, /cache: "no-store"/);
  assert.match(catalog, /OpenRouter could not be reached\./);
  assert.match(catalog, /OpenRouter returned a partial model list/);
  assert.match(catalog, /nextModelsUrl/);
  assert.match(catalog, /mergeCatalogPages/);
  assert.match(css, /\.roster-edit\.card\.roster-sync-card/);
});

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from !== -1 && to !== -1, `${start} .. ${end}`);
  return source.slice(from, to);
}
