import assert from "node:assert/strict";
import test from "node:test";
import { categoryIdFromName, categoryNotice, parseCategoryFields, parseCategoryIds } from "./admin-category";

test("a category id is a slug from the name", () => {
  assert.equal(categoryIdFromName("Opus"), "opus");
  assert.equal(categoryIdFromName("GPT vs Claude"), "gpt-vs-claude");
  assert.equal(categoryIdFromName("Latest Anthropic"), "latest-anthropic");
  assert.equal(categoryIdFromName("A"), null);
  assert.equal(categoryIdFromName("  "), null);
});

test("a category can omit the company", () => {
  assert.deepEqual(parseCategoryFields({ name: "GPT vs Claude", description: "Two labs.", companyId: "" }), {
    name: "GPT vs Claude",
    description: "Two labs.",
    companyId: null,
  });
  assert.equal(parseCategoryFields({ name: "Opus", description: "The Opus line.", companyId: "anthropic" })?.companyId, "anthropic");
  assert.equal(parseCategoryFields({ name: "Opus", description: "", companyId: "nope!" }), null);
  assert.equal(parseCategoryFields({ name: "", description: "Missing name." }), null);
});

test("a model can belong to several categories", () => {
  assert.deepEqual(parseCategoryIds(["opus", "latest-anthropic", "opus"]), ["opus", "latest-anthropic"]);
  assert.deepEqual(parseCategoryIds([]), []);
  assert.equal(parseCategoryIds(["Opus"]), null);
});

test("category notices stay on the categories page", () => {
  assert.match(categoryNotice("company") ?? "", /leave it blank/);
  assert.equal(categoryNotice("nope"), null);
});
