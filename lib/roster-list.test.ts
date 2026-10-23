import assert from "node:assert/strict";
import test from "node:test";
import type { Difficulty } from "./difficulty";
import { modelsReturnPath, nextRosterSort, pageOf, rosterSortOf, searchRoster, sortRoster, type RosterSort } from "./roster-list";
import type { Origin, Size } from "./game";

function row(partial: {
  id: string;
  name: string;
  companyName?: string;
  origin?: Origin;
  year?: string;
  size?: Size;
  difficulty?: Difficulty | null;
  categoryNames?: string;
  inputUsdPerMtok?: number | null;
  outputUsdPerMtok?: number | null;
}) {
  return {
    companyName: "Lab",
    origin: "us" as Origin,
    year: "2026",
    size: "small" as Size,
    difficulty: "medium" as Difficulty,
    categoryNames: "",
    inputUsdPerMtok: null,
    outputUsdPerMtok: null,
    ...partial,
  };
}

const rows = [
  { name: "GPT Luna", companyName: "OpenAI", categoryNames: "Latest OpenAI" },
  { name: "Claude Haiku", companyName: "Anthropic", categoryNames: "Haiku" },
  { name: "Qwen Max", companyName: "Alibaba", categoryNames: "" },
];

test("search matches name, company, and category without case", () => {
  assert.equal(searchRoster(rows, "  luna ").length, 1);
  assert.equal(searchRoster(rows, "CLAUDE")[0].name, "Claude Haiku");
  assert.equal(searchRoster(rows, "alibaba")[0].name, "Qwen Max");
  assert.equal(searchRoster(rows, "latest openai")[0].name, "GPT Luna");
  assert.equal(searchRoster(rows, "").length, 3);
  assert.equal(searchRoster(rows, "nothing").length, 0);
});

test("a column sorts every data field, and the same column reverses", () => {
  const rows = [
    row({ id: "b", name: "Beta", companyName: "OpenAI", origin: "us", year: "2024", size: "xxl", difficulty: "hard", categoryNames: "Haiku", inputUsdPerMtok: 30, outputUsdPerMtok: 0.02 }),
    row({ id: "a", name: "alpha", companyName: "Alibaba", origin: "cn", year: "2026", size: "nano", difficulty: "easy", categoryNames: "", inputUsdPerMtok: null, outputUsdPerMtok: 10 }),
    row({ id: "c", name: "Gamma", companyName: "Mistral", origin: "eu", year: "", size: "medium", difficulty: null, categoryNames: "Latest", inputUsdPerMtok: 0.02, outputUsdPerMtok: null }),
  ];
  const names = (sort: RosterSort) => sortRoster(rows, sort).map((item) => item.name);
  assert.deepEqual(names({ column: "name", dir: "asc" }), ["alpha", "Beta", "Gamma"]);
  assert.deepEqual(names({ column: "name", dir: "desc" }), ["Gamma", "Beta", "alpha"]);
  assert.deepEqual(names({ column: "company", dir: "asc" }), ["alpha", "Gamma", "Beta"]);
  assert.deepEqual(names({ column: "origin", dir: "asc" }), ["alpha", "Gamma", "Beta"]);
  assert.deepEqual(names({ column: "year", dir: "asc" }), ["Beta", "alpha", "Gamma"]);
  assert.deepEqual(names({ column: "year", dir: "desc" }), ["Gamma", "alpha", "Beta"]);
  assert.deepEqual(names({ column: "size", dir: "asc" }), ["alpha", "Gamma", "Beta"]);
  assert.deepEqual(names({ column: "size", dir: "desc" }), ["Beta", "Gamma", "alpha"]);
  assert.deepEqual(names({ column: "difficulty", dir: "asc" }), ["alpha", "Beta", "Gamma"]);
  assert.deepEqual(names({ column: "difficulty", dir: "desc" }), ["Gamma", "Beta", "alpha"]);
  assert.deepEqual(names({ column: "input", dir: "asc" }), ["Gamma", "Beta", "alpha"]);
  assert.deepEqual(names({ column: "input", dir: "desc" }), ["alpha", "Beta", "Gamma"]);
  assert.deepEqual(names({ column: "output", dir: "asc" }), ["Beta", "alpha", "Gamma"]);
  assert.deepEqual(names({ column: "categories", dir: "asc" }), ["Beta", "Gamma", "alpha"]);
  assert.equal(rosterSortOf(undefined, "desc"), null);
  assert.deepEqual(rosterSortOf("year", "desc"), { column: "year", dir: "desc" });
  assert.equal(rosterSortOf("buttons", "desc"), null);
  assert.deepEqual(sortRoster(rows, null).map((item) => item.name), ["Beta", "alpha", "Gamma"]);
});

test("a column cycles through ascending, descending, and the default order", () => {
  assert.deepEqual(nextRosterSort(null, "year"), { column: "year", dir: "asc" });
  assert.deepEqual(nextRosterSort({ column: "year", dir: "asc" }, "year"), { column: "year", dir: "desc" });
  assert.equal(nextRosterSort({ column: "year", dir: "desc" }, "year"), null);
  assert.deepEqual(nextRosterSort({ column: "year", dir: "desc" }, "company"), { column: "company", dir: "asc" });
  assert.deepEqual(nextRosterSort({ column: "name", dir: "asc" }, "difficulty"), { column: "difficulty", dir: "asc" });
});

test("saving a model returns to the same search", () => {
  assert.equal(modelsReturnPath({ q: "claude", sort: "year", dir: "desc", active: "2" }), "/admin/models?q=claude&sort=year&dir=desc&active=2");
  assert.equal(modelsReturnPath({ q: "  ", sort: "name", dir: "asc" }), "/admin/models?sort=name&dir=asc");
  assert.equal(modelsReturnPath({}), "/admin/models");
  assert.equal(modelsReturnPath({ notice: "save", q: "gpt" }), "/admin/models?notice=save&q=gpt");
  assert.equal(modelsReturnPath({ q: "gpt", active: "1", inactive: "0" }), "/admin/models?q=gpt");
  assert.equal(modelsReturnPath({ unavailable: "2" }), "/admin/models?unavailable=2");
});

test("pages hold ten rows and clamp the requested page", () => {
  const many = Array.from({ length: 23 }, (_, index) => index);
  assert.deepEqual(pageOf(many, "1").rows, many.slice(0, 10));
  assert.equal(pageOf(many, "3").rows.length, 3);
  assert.equal(pageOf(many, "99").page, 3);
  assert.equal(pageOf(many, "abc").page, 1);
  assert.equal(pageOf(many, "-4").page, 1);
  assert.deepEqual(pageOf([], undefined), { rows: [], page: 1, pageCount: 1 });
});
