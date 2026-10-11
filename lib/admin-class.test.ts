import assert from "node:assert/strict";
import test from "node:test";
import { classIdFromName, classNotice, parseClassFields, parseClassIds } from "./admin-class";

test("a class id is a slug from the name", () => {
  assert.equal(classIdFromName("Opus"), "opus");
  assert.equal(classIdFromName("GPT vs Claude"), "gpt-vs-claude");
  assert.equal(classIdFromName("Latest Anthropic"), "latest-anthropic");
  assert.equal(classIdFromName("A"), null);
  assert.equal(classIdFromName("  "), null);
});

test("a class can omit the company", () => {
  assert.deepEqual(parseClassFields({ name: "GPT vs Claude", description: "Two labs.", companyId: "" }), {
    name: "GPT vs Claude",
    description: "Two labs.",
    companyId: null,
  });
  assert.equal(parseClassFields({ name: "Opus", description: "The Opus line.", companyId: "anthropic" })?.companyId, "anthropic");
  assert.equal(parseClassFields({ name: "Opus", description: "", companyId: "nope!" }), null);
  assert.equal(parseClassFields({ name: "", description: "Missing name." }), null);
});

test("a model can belong to several classes", () => {
  assert.deepEqual(parseClassIds(["opus", "latest-anthropic", "opus"]), ["opus", "latest-anthropic"]);
  assert.deepEqual(parseClassIds([]), []);
  assert.equal(parseClassIds(["Opus"]), null);
});

test("class notices stay on the classes page", () => {
  assert.match(classNotice("company") ?? "", /leave it blank/);
  assert.equal(classNotice("nope"), null);
});
