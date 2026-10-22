import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { RosterRow } from "./roster-row";
import {
  formatSyncPrice,
  mergeCatalogPages,
  nextModelsUrl,
  openRouterModelHref,
  parseCatalogPage,
  parseOpenRouterCatalog,
  planNewModels,
  planReasoningUpdates,
  planUnavailable,
  sameRosterModel,
  type CatalogModel,
  type SyncModel,
  withListPrices,
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
    reasoning: extra?.reasoning ?? false,
  };
}

function model(fields: {
  id: string;
  openrouterId: string;
  name?: string;
  enabled?: boolean;
  available?: boolean;
}): SyncModel {
  return {
    id: fields.id,
    name: fields.name ?? fields.id,
    openrouterId: fields.openrouterId,
    enabled: fields.enabled ?? true,
    available: fields.available ?? true,
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
  const later = withListPrices([rosterRow("ab", "a/b")], replaced ?? []);
  assert.deepEqual([later[0].inputUsdPerMtok, later[0].outputUsdPerMtok], [2, 3]);
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

function rosterRow(id: string, openrouterId: string): RosterRow {
  return {
    id,
    openrouterId,
    name: id,
    companyName: "Co",
    region: "us",
    year: "2026",
    size: "small",
    difficulty: null,
    inputUsdPerMtok: null,
    outputUsdPerMtok: null,
    enabled: true,
    available: true,
    logoUrl: "",
    categoryIds: [],
    categoryNames: "",
  };
}

test("live catalog prices are joined onto roster rows by OpenRouter id", () => {
  const catalog: CatalogModel[] = [
    listed("anthropic/claude-opus-4.1", 20, 75),
    listed("nousresearch/hermes", null, null),
    listed("partial/input", 1, null),
    listed("free/zero", 0, 0),
  ];
  const rows = withListPrices(
    [
      rosterRow("opus", "anthropic/claude-opus-4.1"),
      rosterRow("padded", "  anthropic/claude-opus-4.1  "),
      rosterRow("hermes", "nousresearch/hermes"),
      rosterRow("partial", "partial/input"),
      rosterRow("zero", "free/zero"),
      rosterRow("gone", "openai/gone"),
    ],
    catalog,
  );
  assert.deepEqual(
    rows.map((row) => [row.id, row.inputUsdPerMtok, row.outputUsdPerMtok]),
    [
      ["opus", 20, 75],
      ["padded", 20, 75],
      ["hermes", null, null],
      ["partial", 1, null],
      ["zero", 0, 0],
      ["gone", null, null],
    ],
  );
  assert.deepEqual({ ...rows[0], inputUsdPerMtok: null, outputUsdPerMtok: null }, rosterRow("opus", "anthropic/claude-opus-4.1"));
});

test("a failed catalog leaves the roster as it is, with no prices", () => {
  const input = [rosterRow("opus", "anthropic/claude-opus-4.1")];
  const rows = withListPrices(input, null);
  assert.deepEqual(rows, input);
  assert.equal(rows[0].inputUsdPerMtok, null);
  assert.equal(rows[0].outputUsdPerMtok, null);
});

test("sync prices print with a dollar sign", () => {
  assert.equal(formatSyncPrice(15), "$15");
  assert.equal(formatSyncPrice(0.2), "$0.2");
  assert.equal(formatSyncPrice(0), "$0");
  assert.equal(formatSyncPrice(null), "—");
});

test("a catalog reasoning object marks the model, and a missing one does not", () => {
  const catalog = parseOpenRouterCatalog({
    data: [
      { id: "qwen/think", pricing: { prompt: "0.000001", completion: "0.000002" }, reasoning: { supported: true } },
      { id: "qwen/present", pricing: {}, reasoning: { default_effort: "low" } },
      { id: "qwen/off", pricing: {}, reasoning: null },
      { id: "qwen/plain", pricing: {} },
    ],
  });
  assert.deepEqual(
    catalog?.map((model) => [model.id, model.reasoning]),
    [
      ["qwen/think", true],
      ["qwen/present", true],
      ["qwen/off", false],
      ["qwen/plain", false],
    ],
  );
  const updates = planReasoningUpdates(
    [
      { id: "think", openrouterId: "qwen/think", reasoning: false, providerSettings: {} },
      { id: "present", openrouterId: "qwen/present", reasoning: true, providerSettings: { reasoning: { effort: "xhigh" } } },
      { id: "off", openrouterId: "qwen/off", reasoning: true, providerSettings: { reasoning: { effort: "low" } } },
      { id: "plain", openrouterId: "qwen/plain", reasoning: false, providerSettings: {} },
      { id: "empty", openrouterId: "qwen/think", reasoning: true, providerSettings: {} },
    ],
    catalog ?? [],
  );
  assert.deepEqual(updates, [
    { id: "think", reasoning: true, providerSettings: { reasoning: { effort: "low" } } },
    { id: "off", reasoning: false, providerSettings: null },
    { id: "empty", reasoning: true, providerSettings: { reasoning: { effort: "low" } } },
  ]);
});

test("availability moves models OpenRouter no longer lists, and skips ones already unavailable", () => {
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
      model({ id: "parked", name: "Parked", openrouterId: "openai/parked", enabled: false, available: false }),
    ],
    catalog,
  );
  assert.deepEqual(plan?.unavailable.map((row) => row.name), ["Gone", "Old"]);
  assert.deepEqual(plan?.markIds, ["gone", "old"]);
  assert.equal(planUnavailable([model({ id: "still", openrouterId: "openai/still" })], []), null);
  assert.deepEqual(
    planUnavailable([model({ id: "parked", openrouterId: "openai/parked", available: false })], [listed("openai/other", 1, 2)])?.markIds,
    [],
  );
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
      { id: "org/thinks", reasoning: { mandatory: true } },
      { id: "org/optional", reasoning: { mandatory: false } },
      { id: "org/plain", reasoning: null },
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
  assert.equal(parsed?.[3].reasoning, true);
  assert.equal(parsed?.[4].reasoning, true);
  assert.equal(parsed?.[5].reasoning, false);
  assert.equal(parsed?.[0].reasoning, false);
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
      reasoning: extra.reasoning ?? false,
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

test("the model page loads live prices and keeps availability apart", () => {
  const page = fs.readFileSync(path.join(root, "app/admin/models/page.tsx"), "utf8");
  const buttons = fs.readFileSync(path.join(root, "components/roster-sync.tsx"), "utf8");
  const actions = fs.readFileSync(path.join(root, "app/admin/actions.ts"), "utf8");
  const roster = fs.readFileSync(path.join(root, "lib/admin-roster.ts"), "utf8");
  const catalog = fs.readFileSync(path.join(root, "lib/openrouter-catalog.ts"), "utf8");
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

  assert.match(page, /<RosterSync \/>/);
  assert.match(page, /loadRoster\(\)/);
  assert.match(page, /loadOpenRouterCatalog\(\)/);
  assert.match(page, /withListPrices\(roster\.rows, catalog\.ok \? catalog\.models : null\)/);
  assert.match(page, /key=\{rosterStamp\(rows\)\}/);
  const browser = fs.readFileSync(path.join(root, "components/roster-browser.tsx"), "utf8");
  assert.match(browser, /searchRoster\(rows, query\)/);
  assert.match(browser, /action=\{saveModel\}/);
  assert.match(browser, /action=\{setModelEnabled\}/);
  assert.doesNotMatch(browser, /useState\(rows\)|admin-roster|method="get"/);
  assert.match(actions, /revalidatePath\("\/admin\/models"\)/);
  assert.match(actions, /redirect\(/);
  assert.doesNotMatch(buttons, /Update prices|updateRosterPrices/);
  assert.match(buttons, /Check availability/);
  assert.match(buttons, /Search for new models/);
  assert.match(buttons, /checkRosterAvailability\(\)/);
  assert.match(buttons, /searchNewModels\(\)/);
  assert.match(buttons, /Add models/);
  assert.match(buttons, /Add models[\s\S]{0,700}Close/);
  assert.match(buttons, /Size for \$\{model\.name\}/);
  assert.match(buttons, />Reasoning</);
  assert.match(buttons, /model\.reasoning/);
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
  assert.match(buttons, /No longer available/);
  assert.match(buttons, /Every roster model is still on OpenRouter\./);
  assert.doesNotMatch(buttons, /redirect\(|router\.push|location\.href/);
  assert.doesNotMatch(buttons, /admin-roster|admin-access|openrouter-spend|showAdmin|isAdmin/);

  const availability = between(actions, "export async function checkRosterAvailability", "export async function searchNewModels");
  const search = between(actions, "export async function searchNewModels", "export async function addNewRosterModels");
  const add = actions.slice(actions.indexOf("export async function addNewRosterModels"));
  assert.match(availability, /loadOpenRouterCatalog\(\)/);
  assert.match(availability, /planUnavailable\(rows, catalog\.models\)/);
  assert.match(availability, /markRosterUnavailable\(plan\.markIds\)/);
  assert.match(availability, /catalog\.error/);
  assert.match(availability, /writeReasoningFlags\(catalog\.models\)/);
  assert.doesNotMatch(availability, /redirect\(/);
  assert.match(search, /loadOpenRouterCatalog\(\)/);
  assert.match(search, /planNewModels\(rows, catalog\.models/);
  assert.match(search, /catalog\.error/);
  assert.doesNotMatch(search, /redirect\(|insertDiscoveredModels|markRosterUnavailable|planUnavailable/);
  assert.match(add, /planNewModels\(rows, catalog\.models/);
  assert.match(add, /insertDiscoveredModels\(/);
  assert.match(add, /catalog\.error/);
  assert.doesNotMatch(add, /redirect\(|markRosterUnavailable|planUnavailable/);
  assert.match(page, /Search for new models/);
  assert.match(page, /Unavailable on OpenRouter/);
  assert.match(browser, /Unavailable on OpenRouter/);
  assert.match(browser, /"OFF"/);
  assert.match(browser, /"ON"/);
  assert.match(browser, /row\.available \?/);
  assert.match(buttons, /Moved to Unavailable on OpenRouter/);

  const turnOn = between(roster, "export async function setRosterEnabled", "export async function writeReasoningFlags");
  const disable = between(roster, "export async function markRosterUnavailable", "export async function insertDiscoveredModels");
  assert.match(turnOn, /available === false/);
  assert.match(turnOn, /return "unavailable"/);
  assert.doesNotMatch(turnOn, /\.delete\(/);
  const insert = between(roster, "export async function insertDiscoveredModels", "async function resolveCompany");
  assert.match(disable, /await requireOwner\(\)/);
  assert.match(disable, /available: false/);
  assert.match(disable, /enabled: false/);
  assert.doesNotMatch(disable, /\.delete\(/);
  assert.match(insert, /await requireOwner\(\)/);
  assert.match(insert, /enabled: false/);
  assert.match(insert, /openrouter_id: openrouterId/);
  assert.match(insert, /released_on:/);
  assert.match(insert, /companyForOrg/);
  assert.match(insert, /size,/);
  assert.match(insert, /difficulty: difficultyNumber\[difficulty\]/);
  assert.match(insert, /parseSize\(model\.size\)/);
  assert.match(insert, /parseDifficulty\(model\.difficulty\)/);
  assert.match(insert, /reasoning: model\.reasoning/);
  assert.match(insert, /provider_settings: model\.reasoning \? \{ reasoning: \{ effort: "low" \} \} : \{\}/);
  assert.match(add, /reasoning: model\.reasoning/);
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

test("no code or seed writes the dropped price columns", () => {
  for (const file of ["lib/admin-roster.ts", "app/admin/actions.ts", "app/admin/models/page.tsx", "supabase/seed.sql"]) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), "utf8"), /usd_per_mtok/, file);
  }
  const migrations = path.join(root, "supabase/migrations");
  const drop = fs.readdirSync(migrations).find((name) => name.endsWith("_drop_model_prices.sql"));
  assert.ok(drop);
  const sql = fs.readFileSync(path.join(migrations, drop), "utf8");
  assert.match(sql, /drop column input_usd_per_mtok/);
  assert.match(sql, /drop column output_usd_per_mtok/);
});

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from !== -1 && to !== -1, `${start} .. ${end}`);
  return source.slice(from, to);
}
