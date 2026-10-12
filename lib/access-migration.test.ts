import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("client roles cannot empty tables or call the signup trigger", () => {
  const sql = fs.readFileSync(path.join(root, "supabase/migrations/0028_client_access.sql"), "utf8");
  assert.match(sql, /revoke truncate, trigger, references on all tables in schema public from public, anon, authenticated/);
  assert.match(sql, /revoke insert, update, delete on table public\.profiles from public, anon, authenticated/);
  assert.match(sql, /revoke all on function public\.handle_new_user\(\) from public, anon, authenticated/);
  assert.match(sql, /revoke all on function public\.rls_auto_enable\(\) from public, anon, authenticated/);
  assert.match(sql, /alter view public\.models_public set \(security_invoker = true\)/);
  assert.match(sql, /grant select \(id, name, company_id, logo_path, enabled\) on public\.models to anon, authenticated/);
  assert.match(sql, /drop policy if exists avatars_insert_own on storage\.objects/);
  assert.doesNotMatch(sql, /delete from|truncate table|drop table/i);
});

test("reset scripts refuse unless the session opts in", () => {
  for (const relative of ["scripts/reset-play-data.sql", "scripts/reset-test-data.sql"]) {
    const sql = fs.readFileSync(path.join(root, relative), "utf8");
    const guard = sql.indexOf("app.confirm_data_reset");
    const destructive = sql.search(/truncate table|delete from/i);
    assert.ok(guard !== -1 && guard < destructive, relative);
    assert.match(sql, /raise exception 'data reset refused'/);
  }
});

test("the admin layout checks the owner before rendering", () => {
  const layout = fs.readFileSync(path.join(root, "app/admin/layout.tsx"), "utf8");
  assert.match(layout, /await requireOwner\(\)/);
});
