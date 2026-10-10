import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const ownerPath = path.join(root, "lib/admin-owner.ts");

function files(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...files(full));
    else if (/\.(ts|tsx|js|jsx|css|md|sql|json)$/.test(entry.name)) out.push(full);
  }
  return out;
}

test("the owner address stays in the server module", () => {
  const owner = fs.readFileSync(ownerPath, "utf8");
  assert.match(owner, /import "server-only"/);
  const email = owner.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0];
  assert.ok(email);
  for (const file of files(root)) {
    if (file === ownerPath) continue;
    const text = fs.readFileSync(file, "utf8");
    assert.equal(text.includes(email!), false, path.relative(root, file));
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
    assert.equal(text.includes("openrouter-prices"), false, path.relative(root, file));
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

test("public prices do not use the API key", () => {
  const text = fs.readFileSync(path.join(root, "lib/openrouter-prices.ts"), "utf8");
  assert.match(text, /https:\/\/openrouter\.ai\/api\/v1\/models/);
  assert.doesNotMatch(text, /OPENROUTER_API_KEY/);
  assert.doesNotMatch(text, /authorization/i);
  assert.doesNotMatch(text, /api\/v1\/key/);
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
  const form = fs.readFileSync(path.join(root, "components/delete-account-form.tsx"), "utf8");
  assert.match(form, /name="confirm"/);
  assert.doesNotMatch(form, /name="(?:id|userId|user_id|email)"/);
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
