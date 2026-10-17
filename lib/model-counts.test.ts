import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { enabledModelCounts } from "./model-counts";

const root = path.resolve(import.meta.dirname, "..");

test("turned-off models are left out of category and company counts", () => {
  const counts = enabledModelCounts([
    { enabled: true, companyId: "anthropic", categoryIds: ["opus", "latest"] },
    { enabled: false, companyId: "anthropic", categoryIds: ["opus"] },
    { enabled: true, companyId: "openai", categoryIds: ["latest"] },
    { enabled: false, companyId: "google", categoryIds: ["flash"] },
    { enabled: true, companyId: "", categoryIds: ["opus", "opus"] },
  ]);
  assert.equal(counts.byCategory.get("opus"), 2);
  assert.equal(counts.byCategory.get("latest"), 2);
  assert.equal(counts.byCategory.get("flash"), undefined);
  assert.equal(counts.byCompany.get("anthropic"), 1);
  assert.equal(counts.byCompany.get("openai"), 1);
  assert.equal(counts.byCompany.get("google"), undefined);
  assert.equal(counts.byCompany.get(""), undefined);
});

test("category and company pages share the enabled-model count", () => {
  const roster = fs.readFileSync(path.join(root, "lib/admin-roster.ts"), "utf8");
  const categories = fs.readFileSync(path.join(root, "app/admin/categories/page.tsx"), "utf8");
  const companies = fs.readFileSync(path.join(root, "app/admin/companies/page.tsx"), "utf8");
  const counts = fs.readFileSync(path.join(root, "lib/model-counts.ts"), "utf8");
  const sql = fs.readFileSync(path.join(root, "supabase/migrations/0035_unavailable_models.sql"), "utf8");
  const baseline = fs.readFileSync(path.join(root, "supabase/v0.3.sql"), "utf8");

  assert.match(counts, /if \(!model\.enabled\) continue/);
  assert.match(roster, /enabledModelCounts\(memberships\)/);
  assert.match(roster, /modelCount: counts\.byCategory\.get\(row\.id\) \?\? 0/);
  assert.match(roster, /modelCount: counts\.byCompany\.get\(company\.id\) \?\? 0/);
  assert.match(categories, /row\.modelCount\.toLocaleString\("en-US"\)/);
  assert.match(categories, /<th>Models<\/th>/);
  assert.match(companies, /company\.modelCount\.toLocaleString\("en-US"\)/);
  assert.match(companies, /models that are turned on/);
  assert.doesNotMatch(companies, /startGame|game_mode|leaderboard/);
  assert.doesNotMatch(
    roster.slice(roster.indexOf("async function loadEnabledCounts"), roster.indexOf("export async function loadCategoryList")),
    /\.eq\("enabled"/,
  );

  assert.match(sql, /add column if not exists available boolean not null default true/);
  assert.match(sql, /check \(available or not enabled\)/);
  assert.doesNotMatch(sql, /delete from|drop table|on delete cascade/i);
  assert.match(baseline, /available boolean not null default true/);
  assert.match(baseline, /models_unavailable_stays_off check \(available or not enabled\)/);
});
