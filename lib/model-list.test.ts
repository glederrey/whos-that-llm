import assert from "node:assert/strict";
import test from "node:test";
import { filterPublicModels, groupByCompany, openRouterUrl, publicModels } from "./model-list";
import type { CatalogModel } from "./rounds-shape";

function model(id: string, name: string, companyId: string, companyName: string, year: number): CatalogModel {
  return {
    id,
    name,
    companyId,
    companyName,
    origin: "us",
    size: "large",
    year,
    logoPath: `/logos/${companyId}.png`,
    openrouterId: `${companyId}/${id}`,
    providerSettings: { secret: true },
    difficulty: "hard",
  } as unknown as CatalogModel;
}

const catalog = [
  model("b-old", "B Old", "b", "Beta", 2023),
  model("a-1", "A One", "a", "Alpha", 2024),
  model("b-new", "B New", "b", "Beta", 2025),
];

test("models sort by company, then newest first", () => {
  assert.deepEqual(publicModels(catalog).map((row) => row.id), ["a-1", "b-new", "b-old"]);
});

test("a public model carries no difficulty or provider settings", () => {
  const row = publicModels(catalog)[0];
  assert.equal("difficulty" in row, false);
  assert.equal("providerSettings" in row, false);
  assert.equal(row.originName, "USA");
  assert.equal(row.sizeName, "Large");
});

test("the OpenRouter link keeps the slash and encodes the rest", () => {
  assert.equal(openRouterUrl("anthropic/claude-opus-4.5"), "https://openrouter.ai/anthropic/claude-opus-4.5");
  assert.equal(openRouterUrl("a/b c:free"), "https://openrouter.ai/a/b%20c%3Afree");
});

test("the filter matches model, company, and year, and ignores case", () => {
  const rows = publicModels(catalog);
  assert.deepEqual(filterPublicModels(rows, " BETA ").map((row) => row.id), ["b-new", "b-old"]);
  assert.deepEqual(filterPublicModels(rows, "2024").map((row) => row.id), ["a-1"]);
  assert.equal(filterPublicModels(rows, "").length, 3);
  assert.equal(filterPublicModels(rows, "zzz").length, 0);
});

test("groups follow the order of the models", () => {
  const groups = groupByCompany(publicModels(catalog));
  assert.deepEqual(groups.map((group) => [group.companyName, group.models.length]), [["Alpha", 1], ["Beta", 2]]);
});
