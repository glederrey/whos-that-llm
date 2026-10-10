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
  }
});

test("public chrome does not link to the private pages", () => {
  for (const relative of ["app/layout.tsx", "components/account-menu.tsx", "components/site-footer.tsx", "app/page.tsx"]) {
    const text = fs.readFileSync(path.join(root, relative), "utf8");
    assert.equal(text.includes('href="/admin"'), false, relative);
  }
});

test("client roles cannot write the roster", () => {
  const sql = fs.readFileSync(path.join(root, "supabase/migrations/0012_roster_client_writes.sql"), "utf8");
  assert.match(sql, /revoke all on table public\.models from public, anon, authenticated/);
  assert.match(sql, /as restrictive/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to anon/);
});
