import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function files(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...files(full));
    else if (/\.(ts|tsx|js|jsx|css|md|sql|json|yml|yaml)$/.test(entry.name)) out.push(full);
  }
  return out;
}

test("admin reads app_metadata and the tree stores no address", () => {
  const access = fs.readFileSync(path.join(root, "lib/admin-access.ts"), "utf8");
  const proxy = fs.readFileSync(path.join(root, "lib/supabase/proxy.ts"), "utf8");
  assert.match(access, /import "server-only"/);
  assert.match(access, /hasAdminFlag\(user\)/);
  assert.match(proxy, /hasAdminFlag\(data\.user\)/);
  assert.doesNotMatch(access, /ADMIN_EMAIL/);
  assert.doesNotMatch(proxy, /ADMIN_EMAIL/);
  const extra = [path.join(root, ".env.example")];
  const email = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  for (const file of [...files(root), ...extra]) {
    if (file.endsWith(`${path.sep}lib${path.sep}admin-surface.test.ts`)) continue;
    const text = fs.readFileSync(file, "utf8");
    assert.equal(text.includes("ADMIN_EMAIL"), false, path.relative(root, file));
    const found = text.match(email) ?? [];
    for (const address of found) {
      assert.equal(address.toLowerCase().endsWith("@example.com"), true, path.relative(root, file));
    }
  }
});

test("client modules do not import the owner check", () => {
  for (const file of files(root)) {
    if (file.endsWith(".test.ts")) continue;
    const text = fs.readFileSync(file, "utf8");
    const directive = text.slice(0, 80);
    if (!directive.includes('"use client"') && !directive.includes("'use client'")) continue;
    assert.equal(text.includes("admin-access"), false, path.relative(root, file));
    assert.equal(text.includes("admin-owner"), false, path.relative(root, file));
    assert.equal(text.includes("admin-roster"), false, path.relative(root, file));
    assert.equal(text.includes("showAdmin"), false, path.relative(root, file));
    assert.equal(text.includes("isAdmin"), false, path.relative(root, file));
    assert.equal(text.includes("account-delete"), false, path.relative(root, file));
    assert.equal(text.includes("openrouter-spend"), false, path.relative(root, file));
  }
});

test("the admin link is rendered on the server for that session", () => {
  const menu = fs.readFileSync(path.join(root, "components/account-menu.tsx"), "utf8");
  assert.equal(menu.includes('href="/admin"'), false);
  assert.equal(menu.includes("showAdmin"), false);
  assert.equal(menu.includes("isAdmin"), false);
  const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
  assert.match(layout, /sessionIsOwner/);
  assert.match(layout, /href="\/admin"/);
  assert.equal(layout.includes("showAdmin"), false);
  for (const relative of ["components/site-footer.tsx", "app/page.tsx"]) {
    const text = fs.readFileSync(path.join(root, relative), "utf8");
    assert.equal(text.includes('href="/admin"'), false, relative);
  }
});

test("OpenRouter spend is read at request time on the server", () => {
  const text = fs.readFileSync(path.join(root, "lib/openrouter-spend.ts"), "utf8");
  assert.match(text, /import "server-only"/);
  assert.match(text, /await requireOwner\(\)/);
  assert.match(text, /readServerEnv\("OPENROUTER_MANAGEMENT_KEY"\)/);
  assert.match(text, /readServerEnv\("OPENROUTER_API_KEY"\)/);
  assert.doesNotMatch(text, /process\.env\.OPENROUTER_/);
  assert.match(text, /cache: "no-store"/);
  assert.match(text, /\/key`/);
  assert.match(text, /\/activity`/);
  assert.doesNotMatch(text, /sk-or-/);
  const page = fs.readFileSync(path.join(root, "app/admin/page.tsx"), "utf8");
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /await requireOwner\(\)/);
  assert.doesNotMatch(page, /OPENROUTER_API_KEY/);
  assert.doesNotMatch(page, /OPENROUTER_MANAGEMENT_KEY/);
});

test("account deletion uses only the signed-in user", () => {
  const lib = fs.readFileSync(path.join(root, "lib/account-delete.ts"), "utf8");
  assert.match(lib, /import "server-only"/);
  assert.match(lib, /deleteUser\(user\.id, false\)/);
  assert.match(lib, /\.from\("usage"\)\.delete\(\)\.eq\("user_id", userId\)/);
  assert.match(lib, /\.from\("games"\)\.delete\(\)\.eq\("user_id", userId\)/);
  const rowsAt = lib.indexOf("removeOwnedRows(client, user.id)");
  const avatarAt = lib.indexOf("removeAvatars(client, user.id)");
  const authAt = lib.indexOf("deleteUser(user.id, false)");
  assert.ok(rowsAt !== -1 && rowsAt < avatarAt && avatarAt < authAt);
  assert.doesNotMatch(lib, /formData/);
  const action = fs.readFileSync(path.join(root, "app/account/delete/actions.ts"), "utf8");
  assert.match(action, /deleteSignedInAccount\(confirmed\)/);
  assert.match(action, /formData\.get\("confirm"\)/);
  assert.match(action, /formData\.get\("return"\) === "profile"/);
  assert.doesNotMatch(action, /formData\.get\(\s*["'](?:id|user|userId|user_id|email)/);
  const profile = fs.readFileSync(path.join(root, "app/profile/page.tsx"), "utf8");
  assert.match(profile, /DeleteAccountForm/);
  assert.doesNotMatch(profile, /deleteNotice/);
  const deletePage = fs.readFileSync(path.join(root, "app/account/delete/page.tsx"), "utf8");
  assert.doesNotMatch(deletePage, /deleteNotice/);
  const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
  assert.doesNotMatch(layout, /next\/script/);
  assert.match(layout, /ThemeInit/);
  const theme = fs.readFileSync(path.join(root, "components/theme-init.tsx"), "utf8");
  assert.match(theme, /localStorage\.getItem\("theme"\)/);
  assert.match(theme, /prefers-color-scheme: dark/);
  assert.match(theme, /text\/plain/);
  const form = fs.readFileSync(path.join(root, "components/delete-account-form.tsx"), "utf8");
  assert.match(form, /deleteNotice\(notice\)/);
  assert.match(form, /name="confirm"/);
  assert.match(form, /preventDefault\(\)/);
  assert.match(form, /returnTo !== "profile"/);
  assert.doesNotMatch(form, /name="(?:id|userId|user_id|email)"/);
  const menu = fs.readFileSync(path.join(root, "components/account-menu.tsx"), "utf8");
  assert.equal(menu.includes("/account/delete"), false);
  assert.equal(menu.includes("Delete account"), false);
  const editor = fs.readFileSync(path.join(root, "components/profile-form.tsx"), "utf8");
  assert.doesNotMatch(editor, /deleteUser|deleteSignedInAccount|deleteAccount/);
});

test("deleting an account removes that player's rounds", () => {
  const sql = fs.readFileSync(path.join(root, "supabase/migrations/0014_delete_games_with_account.sql"), "utf8");
  assert.match(sql, /games_user_id_fkey/);
  assert.match(sql, /on delete cascade/);
  assert.doesNotMatch(sql, /on delete restrict/);
});

test("client roles cannot write the roster", () => {
  const sql = fs.readFileSync(path.join(root, "supabase/migrations/0012_roster_client_writes.sql"), "utf8");
  assert.match(sql, /revoke all on table public\.models from public, anon, authenticated/);
  assert.match(sql, /as restrictive/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to anon/);
});
