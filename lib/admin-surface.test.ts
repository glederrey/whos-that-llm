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
  assert.match(text, /\/analytics\/query`/);
  assert.doesNotMatch(text, /sk-or-/);
  for (const relative of ["app/admin/page.tsx", "app/admin/costs/page.tsx", "app/admin/games/page.tsx", "app/admin/modes/page.tsx"]) {
    const page = fs.readFileSync(path.join(root, relative), "utf8");
    assert.match(page, /export const dynamic = "force-dynamic"/, relative);
    assert.match(page, /await requireOwner\(\)/, relative);
    assert.doesNotMatch(page, /OPENROUTER_API_KEY/, relative);
    assert.doesNotMatch(page, /OPENROUTER_MANAGEMENT_KEY/, relative);
  }
  const costs = fs.readFileSync(path.join(root, "app/admin/costs/page.tsx"), "utf8");
  assert.match(costs, /loadOpenRouterSpend/);
  assert.match(costs, /Our ledger/);
  assert.match(costs, /Spend by hidden model/);
  assert.match(costs, /include the current UTC day/);
  const panels = fs.readFileSync(path.join(root, "components/admin-panels.tsx"), "utf8");
  assert.doesNotMatch(panels, /Paid this UTC/);
  assert.doesNotMatch(panels, /Cost per solved game/);
  const all = panels.indexOf("Paid, all time");
  const month = panels.indexOf("Paid, last 30 days");
  const week = panels.indexOf("Paid, last 7 days");
  assert.ok(all !== -1 && all < month && month < week);
  const table = fs.readFileSync(path.join(root, "components/spend-activity-table.tsx"), "utf8");
  assert.match(table, /"use client"/);
  assert.match(table, /nextSpendSort/);
  assert.match(table, /All models/);
  assert.doesNotMatch(table, /openrouter-spend/);
  assert.doesNotMatch(table, /href=/);
  const home = fs.readFileSync(path.join(root, "app/admin/page.tsx"), "utf8");
  assert.doesNotMatch(home, /loadOpenRouterSpend/);
  assert.doesNotMatch(home, /loadGameMetrics/);
});

test("account deletion uses only the signed-in user", () => {
  const lib = fs.readFileSync(path.join(root, "lib/account-delete.ts"), "utf8");
  assert.match(lib, /import "server-only"/);
  assert.match(lib, /deleteUser\(user\.id, false\)/);
  assert.match(lib, /\.from\("games"\)\.update\(clearedGameLink\(\)\)\.eq\("user_id", userId\)/);
  assert.match(lib, /\.from\("usage"\)\.update\(clearedUsageLink\(\)\)\.eq\("user_id", userId\)/);
  assert.doesNotMatch(lib, /\.from\("games"\)\.delete\(/);
  assert.doesNotMatch(lib, /\.from\("usage"\)\.delete\(/);
  const rowsAt = lib.indexOf("anonymizeOwnedRows(client, user.id)");
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
  assert.match(form, /This removes your profile and picture, and your name on the leaderboard/);
  assert.doesNotMatch(form, /and games/);
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

test("deleting an account keeps the rounds and drops the player", () => {
  const sql = fs.readFileSync(path.join(root, "supabase/migrations/0017_anonymize_games_on_account_delete.sql"), "utf8");
  assert.match(sql, /alter table public\.games alter column user_id drop not null/);
  assert.match(sql, /alter table public\.games alter column username drop not null/);
  assert.match(sql, /alter table public\.usage alter column user_id drop not null/);
  assert.match(sql, /games_user_id_fkey/);
  assert.match(sql, /on delete set null/);
  assert.match(sql, /g\.user_id is not null/);
  assert.match(sql, /g\.username is not null/);
  assert.match(sql, /btrim\(g\.username\) <> ''/);
  assert.doesNotMatch(sql, /on delete cascade/);
  assert.doesNotMatch(sql, /delete from public\.games/);
});

test("client roles cannot write the roster", () => {
  const sql = fs.readFileSync(path.join(root, "supabase/migrations/0012_roster_client_writes.sql"), "utf8");
  assert.match(sql, /revoke all on table public\.models from public, anon, authenticated/);
  assert.match(sql, /as restrictive/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to anon/);
});
