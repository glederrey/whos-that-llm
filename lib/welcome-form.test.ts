import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/welcome-form.tsx", import.meta.url), "utf8");

test("the welcome username starts empty with Human as the hint", () => {
  assert.match(source, /useState\(""\)/);
  assert.doesNotMatch(source, /useState\("Human"\)/);
  assert.match(source, /placeholder="Human"/);
  assert.match(source, /value=\{username\}/);
});

test("an empty welcome name is refused before a picture upload", () => {
  const nameCheck = source.indexOf("const name = cleanUsername(username)");
  const upload = source.indexOf('fetch("/api/me/avatar"');
  assert.ok(nameCheck > 0 && upload > nameCheck);
  assert.match(source, /if \(!name\) \{\s*setError\("3 to 20 characters, no bad words\."\);\s*return;\s*\}/);
  assert.match(source, /JSON\.stringify\(\{ username: name \}\)/);
});

test("the welcome field hint uses the mute color", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /input::placeholder,\s*textarea::placeholder\s*\{\s*color:\s*var\(--mute\);\s*opacity:\s*1;\s*\}/);
});
