import assert from "node:assert/strict";
import test from "node:test";
import { pageOf, rosterSortOf, searchRoster, sortRoster, type RosterSort } from "./roster-list";
import type { Region, Size } from "./game";

function row(partial: {
  id: string;
  name: string;
  companyName?: string;
  region?: Region;
  year?: string;
  size?: Size;
  classNames?: string;
  inputUsdPerMtok?: number | null;
  outputUsdPerMtok?: number | null;
}) {
  return {
    companyName: "Lab",
    region: "us" as Region,
    year: "2026",
    size: "small" as Size,
    classNames: "",
    inputUsdPerMtok: null,
    outputUsdPerMtok: null,
    ...partial,
  };
}

const rows = [
  { name: "GPT Luna", companyName: "OpenAI", classNames: "Latest OpenAI" },
  { name: "Claude Haiku", companyName: "Anthropic", classNames: "Haiku" },
  { name: "Qwen Max", companyName: "Alibaba", classNames: "" },
];

test("search matches name, company, and class without case", () => {
  assert.equal(searchRoster(rows, "  luna ").length, 1);
  assert.equal(searchRoster(rows, "CLAUDE")[0].name, "Claude Haiku");
  assert.equal(searchRoster(rows, "alibaba")[0].name, "Qwen Max");
  assert.equal(searchRoster(rows, "latest openai")[0].name, "GPT Luna");
  assert.equal(searchRoster(rows, "").length, 3);
  assert.equal(searchRoster(rows, "nothing").length, 0);
});

test("a column sorts every data field, and the same column reverses", () => {
  const rows = [
    row({ id: "b", name: "Beta", companyName: "OpenAI", region: "us", year: "2024", size: "xxl", classNames: "Haiku", inputUsdPerMtok: 30, outputUsdPerMtok: 0.02 }),
    row({ id: "a", name: "alpha", companyName: "Alibaba", region: "cn", year: "2026", size: "nano", classNames: "", inputUsdPerMtok: null, outputUsdPerMtok: 10 }),
    row({ id: "c", name: "Gamma", companyName: "Mistral", region: "eu", year: "", size: "medium", classNames: "Latest", inputUsdPerMtok: 0.02, outputUsdPerMtok: null }),
  ];
  const names = (sort: RosterSort) => sortRoster(rows, sort).map((item) => item.name);
  assert.deepEqual(names({ column: "name", dir: "asc" }), ["alpha", "Beta", "Gamma"]);
  assert.deepEqual(names({ column: "name", dir: "desc" }), ["Gamma", "Beta", "alpha"]);
  assert.deepEqual(names({ column: "company", dir: "asc" }), ["alpha", "Gamma", "Beta"]);
  assert.deepEqual(names({ column: "region", dir: "asc" }), ["alpha", "Gamma", "Beta"]);
  assert.deepEqual(names({ column: "year", dir: "asc" }), ["Beta", "alpha", "Gamma"]);
  assert.deepEqual(names({ column: "year", dir: "desc" }), ["Gamma", "alpha", "Beta"]);
  assert.deepEqual(names({ column: "size", dir: "asc" }), ["alpha", "Gamma", "Beta"]);
  assert.deepEqual(names({ column: "size", dir: "desc" }), ["Beta", "Gamma", "alpha"]);
  assert.deepEqual(names({ column: "input", dir: "asc" }), ["Gamma", "Beta", "alpha"]);
  assert.deepEqual(names({ column: "input", dir: "desc" }), ["alpha", "Beta", "Gamma"]);
  assert.deepEqual(names({ column: "output", dir: "asc" }), ["Beta", "alpha", "Gamma"]);
  assert.deepEqual(names({ column: "classes", dir: "asc" }), ["Beta", "Gamma", "alpha"]);
  assert.deepEqual(rosterSortOf(undefined, "desc"), { column: "name", dir: "asc" });
  assert.deepEqual(rosterSortOf("year", "desc"), { column: "year", dir: "desc" });
  assert.deepEqual(rosterSortOf("buttons", "desc"), { column: "name", dir: "asc" });
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
