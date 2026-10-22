import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { categoryDeleteMessage, categoryIdFromName, categoryNotice, maxCategoryDescription, parseCategoryFields, parseCategoryId, parseCategoryIds, parseEmoji } from "./admin-category";

test("a category id is a slug from the name", () => {
  assert.equal(categoryIdFromName("Opus"), "opus");
  assert.equal(categoryIdFromName("GPT vs Claude"), "gpt-vs-claude");
  assert.equal(categoryIdFromName("Latest Anthropic"), "latest-anthropic");
  assert.equal(categoryIdFromName("A"), null);
  assert.equal(categoryIdFromName("  "), null);
});

test("a category icon is a company logo, an image, or one emoji", () => {
  assert.deepEqual(parseCategoryFields({ name: "Opus", description: "The Opus line.", iconKind: "company", companyId: "anthropic" }), {
    name: "Opus",
    description: "The Opus line.",
    iconKind: "company",
    iconValue: "anthropic",
  });
  assert.equal(parseCategoryFields({ name: "Opus", iconKind: "company", companyId: "" }), null);
  assert.equal(parseCategoryFields({ name: "Opus", iconKind: "company", companyId: "nope!" }), null);
  assert.equal(parseCategoryFields({ name: "Nano", iconKind: "emoji", emoji: " 🔬 " })?.iconValue, "🔬");
  assert.equal(parseCategoryFields({ name: "Nano", iconKind: "emoji", emoji: "" }), null);
  assert.equal(parseCategoryFields({ name: "Nano", iconKind: "emoji", emoji: "ab" }), null);
  assert.deepEqual(parseCategoryFields({ name: "Nano", iconKind: "image" }), {
    name: "Nano",
    description: "",
    iconKind: "image",
    iconValue: null,
  });
  assert.equal(parseCategoryFields({ name: "Nano" }), null);
  assert.equal(parseCategoryFields({ name: "Nano", iconKind: "url" }), null);
  assert.equal(parseCategoryFields({ name: "", description: "Missing name.", iconKind: "image" }), null);
});

test("the description stays short", () => {
  const long = "x".repeat(maxCategoryDescription + 1);
  assert.equal(maxCategoryDescription, 140);
  assert.equal(parseCategoryFields({ name: "Opus", description: long, iconKind: "image" }), null);
  assert.ok(parseCategoryFields({ name: "Opus", description: "x".repeat(140), iconKind: "image" }));
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
  assert.match(page, /name="iconKind" value="emoji"/);
  assert.match(migration, /icon_kind in \('company', 'image', 'emoji'\)/);
  assert.match(migration, /update public\.game_modes\s+set enabled = true, leaderboard = true, hints_allowed = true\s+where id = 'class'/);
});
