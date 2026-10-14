import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  formatSyncPrice,
  mergeCatalogPages,
  nextModelsUrl,
  parseCatalogPage,
  parseOpenRouterCatalog,
  planPriceUpdates,
  planUnavailable,
  type CatalogModel,
  type SyncModel,
} from "./roster-sync";

const root = path.resolve(import.meta.dirname, "..");

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
    { id: "anthropic/claude-opus-4.1", inputUsdPerMtok: 15, outputUsdPerMtok: 75 },
    { id: "free/zero", inputUsdPerMtok: 0, outputUsdPerMtok: 0 },
    { id: "nousresearch/hermes", inputUsdPerMtok: null, outputUsdPerMtok: null },
    { id: "partial/input", inputUsdPerMtok: 1, outputUsdPerMtok: null },
    { id: "spaced/id", inputUsdPerMtok: null, outputUsdPerMtok: null },
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
    { id: "anthropic/claude-opus-4.1", inputUsdPerMtok: 20, outputUsdPerMtok: 75 },
    { id: "openai/same", inputUsdPerMtok: 2, outputUsdPerMtok: 10 },
    { id: "nousresearch/hermes", inputUsdPerMtok: null, outputUsdPerMtok: null },
    { id: "partial/input", inputUsdPerMtok: 1, outputUsdPerMtok: null },
    { id: "new/price", inputUsdPerMtok: 0, outputUsdPerMtok: 0.2 },
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
    { id: "openai/still", inputUsdPerMtok: 1, outputUsdPerMtok: 2 },
    { id: "openai/off-but-listed", inputUsdPerMtok: 1, outputUsdPerMtok: 2 },
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

test("the model page keeps price updates and availability apart", () => {
  const page = fs.readFileSync(path.join(root, "app/admin/models/page.tsx"), "utf8");
  const buttons = fs.readFileSync(path.join(root, "components/roster-sync.tsx"), "utf8");
  const actions = fs.readFileSync(path.join(root, "app/admin/actions.ts"), "utf8");
  const roster = fs.readFileSync(path.join(root, "lib/admin-roster.ts"), "utf8");
  const catalog = fs.readFileSync(path.join(root, "lib/openrouter-catalog.ts"), "utf8");
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

  assert.match(page, /<RosterSync \/>/);
  assert.match(page, /loadRoster\(\)/);
  assert.match(page, /key=\{rosterStamp\(rows\)\}/);
  const browser = fs.readFileSync(path.join(root, "components/roster-browser.tsx"), "utf8");
  assert.match(browser, /searchRoster\(rows, query\)/);
  assert.match(browser, /action=\{saveModel\}/);
  assert.match(browser, /action=\{setModelEnabled\}/);
  assert.doesNotMatch(browser, /useState\(rows\)|admin-roster|method="get"/);
  assert.match(actions, /revalidatePath\("\/admin\/models"\)/);
  assert.match(actions, /redirect\(/);
  assert.match(buttons, /Update prices/);
  assert.match(buttons, /Check availability/);
  assert.match(buttons, /updateRosterPrices\(\)/);
  assert.match(buttons, /checkRosterAvailability\(\)/);
  assert.match(buttons, /popover="auto"/);
  assert.match(buttons, /className="roster-edit card roster-sync-card"/);
  assert.match(buttons, /role="alert"/);
  assert.match(buttons, /No OpenRouter price/);
  assert.match(buttons, /Not updated/);
  assert.match(buttons, /No longer available/);
  assert.match(buttons, /Every roster price already matches OpenRouter\./);
  assert.match(buttons, /Every roster model is still on OpenRouter\./);
  assert.doesNotMatch(buttons, /redirect\(|router\.push|location\.href/);
  assert.doesNotMatch(buttons, /admin-roster|admin-access|openrouter-spend|showAdmin|isAdmin/);

  const prices = between(actions, "export async function updateRosterPrices", "export async function checkRosterAvailability");
  const availability = actions.slice(actions.indexOf("export async function checkRosterAvailability"));
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

  const write = between(roster, "export async function writeRosterPrices", "export async function disableRosterModels");
  const disable = between(roster, "export async function disableRosterModels", "async function resolveCompany");
  assert.match(write, /await requireOwner\(\)/);
  assert.match(write, /input_usd_per_mtok: row\.inputUsdPerMtok/);
  assert.match(write, /output_usd_per_mtok: row\.outputUsdPerMtok/);
  assert.doesNotMatch(write, /\.delete\(|enabled/);
  assert.match(disable, /await requireOwner\(\)/);
  assert.match(disable, /enabled: false/);
  assert.doesNotMatch(disable, /\.delete\(|input_usd_per_mtok|output_usd_per_mtok/);

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
