import assert from "node:assert/strict";
import { test } from "node:test";
import { TWEMOJI_CODE, twemojiCode, twemojiUrl } from "./twemoji";

test("twemojiCode names the file after the code points", () => {
  assert.equal(twemojiCode("🇺🇸"), "1f1fa-1f1f8");
  assert.equal(twemojiCode("😀"), "1f600");
  assert.equal(twemojiCode("👍🏽"), "1f44d-1f3fd");
});

test("twemojiCode drops fe0f, except inside a ZWJ sequence", () => {
  assert.equal(twemojiCode("❤️"), "2764");
  assert.equal(twemojiCode("#️⃣"), "23-20e3");
  assert.equal(twemojiCode("👨‍👩‍👧"), "1f468-200d-1f469-200d-1f467");
  assert.equal(twemojiCode("🏳️‍🌈"), "1f3f3-fe0f-200d-1f308");
});

test("twemojiUrl and the code pattern", () => {
  assert.equal(twemojiUrl("🇺🇸"), "/emoji/1f1fa-1f1f8");
  assert.ok(TWEMOJI_CODE.test("1f3f3-fe0f-200d-1f308"));
  for (const bad of ["", "../x", "1f600.svg", "1F600", "-1f600", "1f600-", "a/b"]) assert.ok(!TWEMOJI_CODE.test(bad), bad);
});
