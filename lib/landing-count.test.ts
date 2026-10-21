import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { finishedGameStatuses, isFinishedGame } from "./game";

const root = path.resolve(import.meta.dirname, "..");

const baselineFile = "supabase/migrations/20261021080000_baseline.sql";

function publicStats(): string {
  const sql = fs.readFileSync(path.join(root, baselineFile), "utf8");
  const start = sql.indexOf("create function public.public_stats()");
  assert.ok(start !== -1, "public_stats function");
  return sql.slice(start, sql.indexOf("$$;", sql.indexOf("$$", start) + 2));
}

function gamesTodayWhere(sql: string): string {
  const match = sql.match(
    /'gamesToday',\s*\(\s*select count\(\*\)::int\s*from public\.games\s*where([\s\S]*?)\)\s*,\s*'players'/,
  );
  assert.ok(match, "gamesToday query");
  return match[1];
}

test("a round counts as played only after it is solved, missed, or given up", () => {
  assert.deepEqual([...finishedGameStatuses], ["solved", "miss", "given_up"]);
  assert.equal(isFinishedGame("solved"), true);
  assert.equal(isFinishedGame("miss"), true);
  assert.equal(isFinishedGame("given_up"), true);
  assert.equal(isFinishedGame("active"), false);
});

test("games today on the main page counts the UTC day the round finished", () => {
  const latest = gamesTodayWhere(publicStats());
  assert.match(latest, /finished_at >= \(date_trunc\('day', now\(\) at time zone 'utc'\) at time zone 'utc'\)/);
  assert.match(
    latest,
    /finished_at < \(date_trunc\('day', now\(\) at time zone 'utc'\) at time zone 'utc'\) \+ interval '1 day'/,
  );
  assert.doesNotMatch(latest, /started_at/);
  assert.doesNotMatch(latest, /status in/);
  const rounds = ["rounds-board", "rounds-queries"].map((name) => fs.readFileSync(path.join(root, `lib/${name}.ts`), "utf8")).join("\n");
  assert.match(rounds, /landingSnapshot\(\)/);
  assert.match(rounds, /\.gte\("finished_at", start\)\s*\.lt\("finished_at", end\)/);
  assert.doesNotMatch(rounds, /\.gte\("started_at", start\)/);
  const home = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
  assert.match(home, /snapshot\.gamesToday/);
});

test("players on the main page are distinct accounts with a finished game", () => {
  const players =
    /'players',\s*\(\s*select count\(distinct user_id\)::int\s*from public\.games\s*where finished_at is not null\s*and user_id is not null\s*\)/;
  const sql = publicStats();
  assert.match(sql, players);
  assert.match(sql, /'models', \(select count\(\*\)::int from public\.models where enabled\)/);
  assert.doesNotMatch(sql, /from public\.profiles/);
  const today = gamesTodayWhere(sql);
  assert.match(today, /finished_at >= \(date_trunc\('day', now\(\) at time zone 'utc'\) at time zone 'utc'\)/);
  assert.match(
    today,
    /finished_at < \(date_trunc\('day', now\(\) at time zone 'utc'\) at time zone 'utc'\) \+ interval '1 day'/,
  );
  assert.doesNotMatch(today, /started_at/);
  const rounds = ["rounds-board", "rounds-queries"].map((name) => fs.readFileSync(path.join(root, `lib/${name}.ts`), "utf8")).join("\n");
  assert.match(
    rounds,
    /from\("games"\)\s*\.select\("user_id"\)\s*\.not\("finished_at", "is", null\)\s*\.not\("user_id", "is", null\)/,
  );
  const home = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
  assert.match(home, /<dt>Games today<\/dt>/);
  assert.doesNotMatch(home, /Games today \(UTC\)/);
  const admin = fs.readFileSync(path.join(root, "app/admin/page.tsx"), "utf8");
  assert.match(admin, /Games today \(UTC\)/);
  const controls = fs.readFileSync(path.join(root, "components/board-controls.tsx"), "utf8");
  assert.match(controls, /This week/);
  assert.match(controls, /This month/);
});

test("companies on the phone homepage are labs with a model in play", () => {
  const companies =
    /'companies',\s*\(\s*select count\(distinct company_id\)::int\s*from public\.models\s*where enabled\s*\)/;
  const sql = publicStats();
  assert.match(sql, companies);
  assert.match(sql, /'models', \(select count\(\*\)::int from public\.models where enabled\)/);
  const rounds = ["rounds-board", "rounds-queries"].map((name) => fs.readFileSync(path.join(root, `lib/${name}.ts`), "utf8")).join("\n");
  assert.match(rounds, /\.from\("models"\)\s*\.select\("company_id"\)\s*\.eq\("enabled", true\)/);
  const home = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
  assert.match(home, /className="stat-companies"/);
  assert.match(home, /<dt>Companies<\/dt>/);
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(css, /\.landing \.stat-companies \{ display: none; \}/);
});
