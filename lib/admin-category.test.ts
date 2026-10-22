import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { categoryDeleteMessage, chooseCategoryIcon, categoryIdFromName, categoryNotice, maxCategoryDescription, parseCategoryFields, parseCategoryId, parseCategoryIds, parseEmoji } from "./admin-category";

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

test("a refused category delete shows the database error", () => {
  assert.equal(
    categoryDeleteMessage('permission denied for table "categories"'),
    'permission denied for table "categories"',
  );
  assert.equal(categoryDeleteMessage("  line one\nline two  "), "line one line two");
  assert.equal(categoryDeleteMessage("   "), null);
  assert.equal(categoryDeleteMessage(undefined), null);
  assert.equal(categoryDeleteMessage("x".repeat(300))?.length, 240);
});

test("the category row deletes that category and keeps the models", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const page = fs.readFileSync(path.join(root, "app/admin/categories/page.tsx"), "utf8");
  const form = fs.readFileSync(path.join(root, "components/delete-category-form.tsx"), "utf8");
  const action = fs.readFileSync(path.join(root, "app/admin/actions.ts"), "utf8");
  const roster = fs.readFileSync(path.join(root, "lib/admin-roster.ts"), "utf8");
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  const schema = fs.readFileSync(path.join(root, "supabase/migrations/20261021080000_baseline.sql"), "utf8");

  const buttons = page.indexOf('className="roster-buttons"');
  const edit = page.indexOf("\n            Edit\n", buttons);
  const deleteForm = page.indexOf("<DeleteCategoryForm", buttons);
  const panel = page.indexOf('className="roster-edit card"', deleteForm);
  assert.ok(buttons !== -1 && edit !== -1 && edit < deleteForm && deleteForm < panel);
  assert.match(page, /<button className="button" type="submit"/);
  assert.match(page, /Cancel/);
  assert.doesNotMatch(page.slice(panel), /DeleteCategoryForm/);
  assert.match(page, /categoryDeleteMessage\(params\.error\)/);

  assert.match(form, /button-danger/);
  assert.match(form, />\s*Delete\s*</);
  assert.match(form, /window\.confirm\(`Delete \$\{name\}\?`\)/);
  assert.match(form, /preventDefault\(\)/);
  assert.match(form, /action=\{deleteCategory\}/);
  assert.doesNotMatch(form, /admin-roster|admin-access/);

  assert.match(action, /const message = await removeCategory\(text\(formData, "id"\)\)/);
  assert.match(action, /redirect\(message \? `\/admin\/categories\?error=\$\{encodeURIComponent\(message\)\}` : "\/admin\/categories"\)/);

  const start = roster.indexOf("export async function removeCategory");
  const end = roster.indexOf("async function knownCompany");
  const fn = roster.slice(start, end);
  assert.match(fn, /parseCategoryId\(idRaw\)/);
  assert.match(fn, /\.from\("categories"\)\s*\.delete\(\)\s*\.eq\("id", id\)/);
  assert.match(fn, /categoryDeleteMessage\(error\.message\)/);
  assert.doesNotMatch(fn, /from\("models"\)/);
  assert.match(schema, /category_id text not null references public\.categories \(id\) on delete cascade/);

  assert.match(css, /\.roster\.categories \{ min-width: 0; \}/);
  assert.match(css, /\.roster\.categories th:nth-child\(1\),[\s\S]*width: 1%; white-space: nowrap; \}/);
  assert.match(css, /\.roster\.categories th:nth-child\(4\),[\s\S]*text-align: right; \}/);
  assert.match(css, /\.category-delete \{ margin: 0; flex: none; width: fit-content; max-width: 100%; \}/);
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
