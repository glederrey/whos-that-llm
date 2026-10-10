import assert from "node:assert/strict";
import test from "node:test";
import { pageOf, searchRoster } from "./roster-list";

const rows = [
  { name: "GPT Luna", familyName: "GPT", companyName: "OpenAI" },
  { name: "Claude Haiku", familyName: "Claude", companyName: "Anthropic" },
  { name: "Qwen Max", familyName: "Qwen", companyName: "Alibaba" },
];

test("search matches name, family, and company without case", () => {
  assert.equal(searchRoster(rows, "  luna ").length, 1);
  assert.equal(searchRoster(rows, "CLAUDE")[0].name, "Claude Haiku");
  assert.equal(searchRoster(rows, "alibaba")[0].name, "Qwen Max");
  assert.equal(searchRoster(rows, "").length, 3);
  assert.equal(searchRoster(rows, "nothing").length, 0);
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
