import assert from "node:assert/strict";
import test from "node:test";
import { parseFlag, parseOriginFields } from "./admin-origin";

test("a two-letter country code becomes the flag emoji", () => {
  assert.equal(parseFlag("jp"), "🇯🇵");
  assert.equal(parseFlag(" CN "), "🇨🇳");
});

test("a flag emoji passes and other text does not", () => {
  assert.equal(parseFlag("🇪🇺"), "🇪🇺");
  assert.equal(parseFlag("japan"), null);
  assert.equal(parseFlag("J"), null);
  assert.equal(parseFlag(""), null);
});

test("origin fields take a country code as the flag", () => {
  assert.deepEqual(parseOriginFields({ name: "Japan", flag: "jp" }), { name: "Japan", flag: "🇯🇵", sortOrder: 100 });
});
