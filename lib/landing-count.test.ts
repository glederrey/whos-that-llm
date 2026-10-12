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

test("games today on the main page ignores an in-progress round", () => {
  const listed = finishedGameStatuses.map((status) => `'${status}'`).join(", ");
  for (const file of ["supabase/v0.1.sql", "supabase/migrations/0024_finished_games_today.sql"]) {
    const where = gamesTodayWhere(fs.readFileSync(path.join(root, file), "utf8"));
    assert.match(where, /started_at >= \(date_trunc\('day', now\(\) at time zone 'utc'\) at time zone 'utc'\)/);
    assert.match(where, new RegExp(`status in \\(${listed}\\)`));
    assert.doesNotMatch(where, /active/);
  }
  const rounds = fs.readFileSync(path.join(root, "lib/rounds.ts"), "utf8");
  assert.match(rounds, /landingSnapshot\(\)/);
  assert.match(
    rounds,
    /\.gte\("started_at", start\)\s*\.in\("status", \[\.\.\.finishedGameStatuses\]\)/,
  );
  const home = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
  assert.match(home, /snapshot\.gamesToday/);
});
