import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { chooseCategoryIcon, categoryIdFromName, categoryNotice, maxCategoryDescription, parseCategoryFields, parseCategoryId, parseCategoryIds, parseEmoji, parseModelIds, filterPickerModels, selectShown, diffModelIds, type PickerModel } from "./admin-category";

test("a category id is a slug from the name", () => {
  assert.equal(categoryIdFromName("Opus"), "opus");
  assert.equal(categoryIdFromName("GPT vs Claude"), "gpt-vs-claude");
  assert.equal(categoryIdFromName("Latest Anthropic"), "latest-anthropic");
  assert.equal(categoryIdFromName("A"), null);
  assert.equal(categoryIdFromName("  "), null);
});

test("the icon is the upload, the emoji, the stored image, the company logo, then the default", () => {
  const stored = { kind: "image", value: "categories/opus-ab12.png" };
  assert.deepEqual(chooseCategoryIcon({ hasImage: true, emoji: "🔬", companyId: "anthropic" }), { kind: "image", value: null });
  assert.deepEqual(chooseCategoryIcon({ hasImage: false, emoji: " 🔬 ", companyId: "anthropic", stored }), { kind: "emoji", value: "🔬" });
  assert.deepEqual(chooseCategoryIcon({ hasImage: false, emoji: "", companyId: "anthropic", stored }), stored);
  assert.deepEqual(chooseCategoryIcon({ hasImage: false, companyId: "anthropic" }), { kind: "company", value: "anthropic" });
  assert.deepEqual(chooseCategoryIcon({ hasImage: false }), { kind: "default", value: "" });
});

test("removing the current icon falls back to the next one, and a new upload still wins", () => {
  const stored = { kind: "image", value: "categories/opus-ab12.png" };
  assert.deepEqual(chooseCategoryIcon({ hasImage: false, emoji: "🔬", removeCurrent: true }), { kind: "default", value: "" });
  assert.deepEqual(chooseCategoryIcon({ hasImage: false, companyId: "anthropic", removeCurrent: true, stored }), { kind: "company", value: "anthropic" });
  assert.deepEqual(chooseCategoryIcon({ hasImage: true, removeCurrent: true, stored }), { kind: "image", value: null });
});

test("a malformed emoji or company id is refused", () => {
  assert.equal(chooseCategoryIcon({ hasImage: false, emoji: "ab" }), null);
  assert.equal(chooseCategoryIcon({ hasImage: false, companyId: "nope!" }), null);
});

test("a category needs a name and a short description", () => {
  assert.deepEqual(parseCategoryFields({ name: " Opus ", description: " The Opus line. " }), { name: "Opus", description: "The Opus line." });
  assert.equal(parseCategoryFields({ name: "", description: "Missing name." }), null);
  assert.equal(parseCategoryFields({ name: "A" }), null);
});

test("the description stays short", () => {
  const long = "x".repeat(maxCategoryDescription + 1);
  assert.equal(maxCategoryDescription, 140);
  assert.equal(parseCategoryFields({ name: "Opus", description: long }), null);
  assert.ok(parseCategoryFields({ name: "Opus", description: "x".repeat(140) }));
});

test("an emoji is one grapheme with a pictograph or a flag", () => {
  assert.equal(parseEmoji("🧪"), "🧪");
  assert.equal(parseEmoji("👨‍👩‍👧"), "👨‍👩‍👧");
  assert.equal(parseEmoji("🇨🇭"), "🇨🇭");
  assert.equal(parseEmoji("🧪🧪"), null);
  assert.equal(parseEmoji("1️⃣"), "1️⃣");
  assert.equal(parseEmoji("#️⃣"), "#️⃣");
  assert.equal(parseEmoji("🇨"), null);
  assert.equal(parseEmoji("1"), null);
  assert.equal(parseEmoji("a"), null);
  assert.equal(parseEmoji("1"), null);
  assert.equal(parseEmoji(undefined), null);
});

test("a model can belong to several categories", () => {
  assert.deepEqual(parseCategoryIds(["opus", "latest-anthropic", "opus"]), ["opus", "latest-anthropic"]);
  assert.deepEqual(parseCategoryIds([]), []);
  assert.equal(parseCategoryIds(["Opus"]), null);
});

test("category notices stay on the categories page", () => {
  assert.match(categoryNotice("company") ?? "", /Pick a company/);
  assert.match(categoryNotice("icon") ?? "", /1 MB/);
  assert.equal(categoryNotice("nope"), null);
});

test("a category id is the stored slug", () => {
  assert.equal(parseCategoryId("latest-anthropic"), "latest-anthropic");
  assert.equal(parseCategoryId("  opus  "), "opus");
  assert.equal(parseCategoryId("Opus"), null);
  assert.equal(parseCategoryId("a"), null);
  assert.equal(parseCategoryId(""), null);
});

test("the category row has on/off and edit, and no delete", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const page = fs.readFileSync(path.join(root, "app/admin/categories/page.tsx"), "utf8");
  const action = fs.readFileSync(path.join(root, "app/admin/actions.ts"), "utf8");
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

  const buttons = page.indexOf('className="roster-buttons"');
  const edit = page.indexOf("\n            Edit\n", buttons);
  const panel = page.indexOf('className="roster-edit card"', buttons);
  assert.ok(buttons !== -1 && edit !== -1 && edit < panel);
  assert.match(page, /<button className="button" type="submit"/);
  assert.match(page, /Cancel/);
  assert.doesNotMatch(page, /Delete/);
  assert.doesNotMatch(action, /deleteCategory/);
  assert.equal(fs.existsSync(path.join(root, "components/delete-category-form.tsx")), false);

  assert.match(css, /\.roster\.categories \{ min-width: 0; \}/);
  assert.match(css, /\.roster\.categories th:nth-child\(1\),[\s\S]*width: 1%; white-space: nowrap; \}/);
  assert.match(css, /\.roster\.categories th:nth-child\(4\),[\s\S]*text-align: right; \}/);
  assert.match(
    css,
    /\.roster\.categories \.roster-buttons \.button-on,\n\.roster\.categories \.roster-buttons \.button-off,\n\.roster\.categories \.roster-buttons \.button-quiet \{ padding: 6px 10px; \}/,
  );
});

test("an image category is stored in the logos bucket and cleaned up", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const roster = fs.readFileSync(path.join(root, "lib/admin-roster.ts"), "utf8");
  const action = fs.readFileSync(path.join(root, "app/admin/actions.ts"), "utf8");
  const page = fs.readFileSync(path.join(root, "app/admin/categories/page.tsx"), "utf8");
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261022151319_category_icons.sql"), "utf8");

  assert.match(action, /await requireOwner\(\);\n  finishCategory\(await createCategory/);
  assert.match(roster, /readLogo\(bytes\)/);
  assert.match(roster, /storage\.from\("logos"\)\.upload\(path/);
  assert.match(roster, /storage\.from\("logos"\)\.remove/);
  assert.match(page, /type="file" name="image"/);
  assert.match(page, /name="removeIcon"/);
  assert.doesNotMatch(page, /type="radio"/);
  assert.match(migration, /icon_kind in \('company', 'image', 'emoji'\)/);
  assert.match(migration, /update public\.game_modes\s+set enabled = true, leaderboard = true, hints_allowed = true\s+where id = 'class'/);
});

test("a category can be turned off and stays out of play, the board, and the statistics", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261022185816_category_enabled_default_icon.sql"), "utf8");
  const start = fs.readFileSync(path.join(root, "lib/rounds-start.ts"), "utf8");
  const stats = fs.readFileSync(path.join(root, "lib/public-stats-data.ts"), "utf8");
  const page = fs.readFileSync(path.join(root, "app/admin/categories/page.tsx"), "utf8");
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(migration, /add column enabled boolean not null default true/);
  assert.match(migration, /'default'/);
  assert.match(start, /category\?\.enabled\) return fail\(404, "not_found"\)/);
  assert.match(start, /categories\.filter\(\(row\) => row\.enabled\)/);
  assert.match(start, /\.filter\(\(row\) => row\.enabled\)\s*\.map/);
  assert.match(stats, /row\.enabled \? \[/);
  assert.match(page, /title="Inactive"/);
  assert.match(page, /action=\{toggleCategory\}/);
  assert.match(css, /\.roster-edit\.card \{\s*text-align: left;/);
});

const picker: PickerModel[] = [
  { id: "claude-opus", name: "Claude Opus", companyName: "Anthropic", logoUrl: "", enabled: true },
  { id: "gpt-nano", name: "GPT Nano", companyName: "OpenAI", logoUrl: "", enabled: false },
  { id: "grok", name: "Grok", companyName: "xAI", logoUrl: "", enabled: true },
];

test("model ids from a form are deduplicated and checked", () => {
  assert.deepEqual(parseModelIds(["claude-opus", " grok ", "claude-opus", ""]), ["claude-opus", "grok"]);
  assert.deepEqual(parseModelIds([]), []);
  assert.equal(parseModelIds(["Bad Id"]), null);
});

test("the picker filter matches the model or company name, ignoring case", () => {
  assert.deepEqual(filterPickerModels(picker, "").map((m) => m.id), ["claude-opus", "gpt-nano", "grok"]);
  assert.deepEqual(filterPickerModels(picker, " OPUS ").map((m) => m.id), ["claude-opus"]);
  assert.deepEqual(filterPickerModels(picker, "openai").map((m) => m.id), ["gpt-nano"]);
  assert.deepEqual(filterPickerModels(picker, "zzz"), []);
});

test("select shown adds the filtered models and keeps the hidden selection", () => {
  assert.deepEqual(selectShown(["grok"], filterPickerModels(picker, "gpt")), ["grok", "gpt-nano"]);
  assert.deepEqual(selectShown(["grok"], picker), ["grok", "claude-opus", "gpt-nano"]);
});

test("a selection change is a diff of links", () => {
  assert.deepEqual(diffModelIds(["a1", "b2"], ["b2", "c3"]), { add: ["c3"], remove: ["a1"] });
  assert.deepEqual(diffModelIds(["a1"], ["a1"]), { add: [], remove: [] });
});
