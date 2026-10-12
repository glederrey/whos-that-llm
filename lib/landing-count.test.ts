import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { finishedGameStatuses, isFinishedGame } from "./game";

const root = path.resolve(import.meta.dirname, "..");

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

test("games today on the main page ignores a round with no finished_at", () => {
  const latest = gamesTodayWhere(
    fs.readFileSync(path.join(root, "supabase/migrations/0025_games_today_finished_at.sql"), "utf8"),
  );
  assert.match(latest, /started_at >= \(date_trunc\('day', now\(\) at time zone 'utc'\) at time zone 'utc'\)/);
  assert.match(latest, /finished_at is not null/);
  assert.doesNotMatch(latest, /status in/);
  const listed = finishedGameStatuses.map((status) => `'${status}'`).join(", ");
  for (const file of ["supabase/v0.1.sql", "supabase/migrations/0024_finished_games_today.sql"]) {
    const where = gamesTodayWhere(fs.readFileSync(path.join(root, file), "utf8"));
    assert.match(where, /started_at >= \(date_trunc\('day', now\(\) at time zone 'utc'\) at time zone 'utc'\)/);
    assert.match(where, new RegExp(`status in \\(${listed}\\)`));
  }
  const rounds = fs.readFileSync(path.join(root, "lib/rounds.ts"), "utf8");
  assert.match(rounds, /landingSnapshot\(\)/);
  assert.match(rounds, /\.gte\("started_at", start\)\s*\.not\("finished_at", "is", null\)/);
  const home = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
  assert.match(home, /snapshot\.gamesToday/);
});
