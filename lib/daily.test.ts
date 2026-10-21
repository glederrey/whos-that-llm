import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { canStartMode, dailyCardBlurb, dailyLevelClosed, dailyModel, dailyRoster, dailyRoundKey, presentDailyCard, startDailyRound, type DailyModel, type DailyPick } from "./daily";
import { poolLabel, type Traits } from "./game";

const root = path.resolve(import.meta.dirname, "..");

const roster: DailyModel[] = [
  { id: "haiku", difficulty: "easy" },
  { id: "sonnet", difficulty: "medium" },
  { id: "opus", difficulty: "hard" },
  { id: "secret", difficulty: "impossible" },
];

const day = "2026-10-12";
const nextDay = "2026-10-13";

function last(count: number): number {
  return count;
}

test("one model per difficulty per UTC day", () => {
  let picks: DailyPick[] = [];
  const easy = dailyModel(picks, day, "easy", roster, () => 0);
  assert.ok(easy);
  picks = easy.picks;
  const easyAgain = dailyModel(picks, day, "easy", roster, last);
  assert.equal(easyAgain?.modelId, "haiku");
  assert.equal(easyAgain?.picks.length, 1);

  const medium = dailyModel(picks, day, "medium", roster, last);
  assert.equal(medium?.modelId, "sonnet");
  picks = medium?.picks ?? picks;
  const hard = dailyModel(picks, day, "hard", roster, last);
  assert.equal(hard?.modelId, "opus");
  picks = hard?.picks ?? picks;
  const impossible = dailyModel(picks, day, "impossible", roster, last);
  assert.equal(impossible?.modelId, "secret");
  picks = impossible?.picks ?? picks;

  assert.deepEqual(
    picks.map((pick) => [pick.day, pick.difficulty, pick.modelId]),
    [
      [day, "easy", "haiku"],
      [day, "medium", "sonnet"],
      [day, "hard", "opus"],
      [day, "impossible", "secret"],
    ],
  );
  assert.equal(dailyModel(picks, day, "hard", roster, () => 0)?.modelId, "opus");

  const tomorrow = dailyModel(picks, nextDay, "hard", roster, () => 0);
  assert.equal(tomorrow?.modelId, "haiku");
  assert.notEqual(tomorrow?.modelId, "opus");
  assert.equal(tomorrow?.picks.filter((pick) => pick.day === nextDay && pick.difficulty === "hard").length, 1);
});

test("easy cannot draw an impossible model", () => {
  assert.deepEqual(
    dailyRoster(roster, "easy").map((model) => model.id),
    ["haiku"],
  );
  assert.equal(dailyRoster(roster, "easy").some((model) => model.difficulty === "impossible"), false);
  for (const roll of [0, 1, 3, 99]) {
    const drawn = dailyModel([], day, "easy", roster, () => roll);
    assert.equal(drawn?.modelId, "haiku");
    assert.notEqual(drawn?.modelId, "secret");
  }
  assert.equal(dailyRoster(roster, "hard").some((model) => model.id === "secret"), false);
  assert.equal(dailyModel([], day, "hard", roster, last)?.modelId, "opus");
  assert.equal(dailyModel([], day, "impossible", roster, last)?.modelId, "secret");
});

test("a second start of the same difficulty returns the same round", () => {
  assert.equal(dailyRoundKey(day, "easy"), "2026-10-12:1");
  assert.equal(dailyRoundKey(day, "medium"), "2026-10-12:2");
  assert.notEqual(dailyRoundKey(day, "easy"), dailyRoundKey(day, "medium"));

  const first = startDailyRound({
    day,
    difficulty: "easy",
    roster,
    picks: [],
    round: null,
    roll: () => 0,
  });
  assert.equal(first.kind, "start");
  if (first.kind !== "start") return;

  const secondEasy = startDailyRound({
    day,
    difficulty: "easy",
    roster,
    picks: first.picks,
    round: { id: "round-1", day, status: "active", modelId: first.modelId, difficulty: "easy" },
    roll: last,
  });
  assert.equal(secondEasy.kind, "resume");
  if (secondEasy.kind !== "resume") return;
  assert.equal(secondEasy.gameId, "round-1");
  assert.equal(secondEasy.modelId, first.modelId);
  assert.equal(secondEasy.picks.length, first.picks.length);

  const medium = startDailyRound({
    day,
    difficulty: "medium",
    roster,
    picks: first.picks,
    round: null,
    roll: last,
  });
  assert.equal(medium.kind, "start");
  if (medium.kind !== "start") return;
  assert.equal(medium.modelId, "sonnet");
  assert.notEqual(medium.modelId, first.modelId);

  for (const status of ["solved", "miss", "given_up"] as const) {
    const finished = startDailyRound({
      day,
      difficulty: "easy",
      roster,
      picks: first.picks,
      round: { id: "round-1", day, status, modelId: first.modelId, difficulty: "easy" },
      roll: last,
    });
    assert.equal(finished.kind, "done");
    assert.equal(dailyLevelClosed(status), true);
  }

  assert.equal(dailyLevelClosed(null), false);
  assert.equal(dailyLevelClosed("active"), false);

  const tomorrow = startDailyRound({
    day: nextDay,
    difficulty: "easy",
    roster,
    picks: first.picks,
    round: { id: "round-1", day, status: "solved", modelId: first.modelId, difficulty: "easy" },
    roll: () => 0,
  });
  assert.equal(tomorrow.kind, "start");
  assert.equal(dailyRoundKey(nextDay, "easy"), "2026-10-13:1");
});

test("daily uses the same header shape as all models", () => {
  const traits: Traits = { given: [], models: {} };
  assert.equal(poolLabel("daily", null, traits, "medium"), "Daily · Medium");
  assert.equal(poolLabel("all", null, traits, "medium"), "All models · Medium");
});

test("the play page explains one round per difficulty", () => {
  const home = fs.readFileSync(path.join(root, "components/home-board.tsx"), "utf8");
  const closed = presentDailyCard({
    id: "daily",
    blurb: "The same model for everyone today.",
    enabled: false,
  });
  assert.equal(closed.blurb, dailyCardBlurb);
  assert.equal(closed.enabled, true);
  const category = presentDailyCard({ id: "class", blurb: "A set we define.", enabled: false });
  assert.equal(category.enabled, false);
  assert.equal(category.blurb, "A set we define.");
  assert.match(home, /presentDailyCard/);
  assert.match(home, /dailyFinished\.includes\(difficulty\)/);
  assert.match(home, /is-done/);
  assert.match(home, /Already played\./);
  assert.match(home, /openGameOn/);
  assert.match(home, /unfinishedLine/);
  assert.doesNotMatch(home, /activeGameId/);
  assert.doesNotMatch(home, /dailyDone/);
  assert.doesNotMatch(home, /The same model for everyone today/);
});

test("only daily and all models can start", () => {
  assert.equal(canStartMode("daily"), true);
  assert.equal(canStartMode("all"), true);
  assert.equal(canStartMode("company"), true);
  for (const id of ["class", "region", "custom"]) assert.equal(canStartMode(id), false);
});

test("daily stores one model per difficulty and does not reset play data", () => {
  const sql = fs.readFileSync(path.join(root, "supabase/legacy/migrations/0030_daily_model.sql"), "utf8");
  assert.match(sql, /create table public\.daily_models/);
  assert.match(sql, /primary key \(played_on, difficulty\)/);
  assert.match(sql, /m\.difficulty <= p_difficulty/);
  assert.match(sql, /alter column daily_key type text using daily_key::text/);
  assert.match(sql, /to_char\(today, 'YYYY-MM-DD'\) \|\| ':' \|\| p_difficulty::text/);
  assert.match(sql, /and daily_key = day_key/);
  assert.match(sql, /existing_status = 'active'/);
  assert.doesNotMatch(sql, /daily_key = \(timezone\('utc', now\(\)\)\)::date/);
  assert.match(sql, /'daily_done'/);
  assert.match(sql, /update public\.game_modes/);
  assert.match(sql, /enabled = true/);
  assert.match(sql, /One round per difficulty\. Everyone at that level gets the same model\. A new puzzle tomorrow\./);
  assert.match(sql, /where id = 'daily'/);
  assert.match(sql, /revoke all on table public\.daily_models from public, anon, authenticated/);
  assert.match(sql, /enable row level security/);
  assert.doesNotMatch(sql, /delete from|truncate|drop table|update public\.games|update public\.models|update public\.profiles/i);
  const previous = fs.readFileSync(path.join(root, "supabase/legacy/v0.2.sql"), "utf8");
  assert.doesNotMatch(previous, /daily_models/);
  const baseline = fs.readFileSync(path.join(root, "supabase/legacy/v0.3.sql"), "utf8");
  assert.match(baseline, /create table public\.daily_models/);
  assert.match(baseline, /create table public\.openrouter_providers/);
  assert.match(baseline, /0032_openrouter_providers\.sql/);
  assert.match(baseline, /Do not run 0028 through 0032 after this script/);
  assert.match(baseline, /starting with 0033/);
  assert.match(baseline, /to_char\(today, 'YYYY-MM-DD'\)/);
  assert.doesNotMatch(baseline, /daily_key date/);
});
