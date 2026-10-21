import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { difficultyAside, difficultyBlocked, modeToOpen, openCompanyOn, openGameOn, unfinishedLine, type OpenGame } from "./lobby-row";

const root = path.resolve(import.meta.dirname, "..");

const hard: OpenGame = { id: "game-hard", mode: "all", difficulty: "hard" };

test("the unfinished difficulty asks to continue and the others keep their counts", () => {
  const games = [hard];
  assert.equal(openGameOn(games, "all", "hard")?.id, "game-hard");
  assert.equal(openGameOn(games, "all", "easy"), null);
  assert.equal(openGameOn(games, "all", "medium"), null);
  assert.equal(openGameOn(games, "all", "impossible"), null);
  assert.equal(difficultyAside(73, true), unfinishedLine);
  assert.equal(difficultyAside(11, false), "11 models");
  assert.equal(difficultyAside(1, false), "1 model");
  assert.equal(unfinishedLine, "Game isn't finished yet. Continue?");
});

test("a different difficulty can start, and the open one cannot start a second round", () => {
  const fresh = { open: false, finished: false, playable: true, paused: false, busy: false, full: false, count: 35 };
  assert.equal(difficultyBlocked({ ...fresh, open: true }), false);
  assert.equal(difficultyBlocked(fresh), false);
  assert.equal(difficultyBlocked({ ...fresh, paused: true }), true);
  assert.equal(difficultyBlocked({ ...fresh, open: true, paused: true, full: true, count: 0 }), false);
  assert.equal(difficultyBlocked({ ...fresh, full: true }), true);
  assert.equal(difficultyBlocked({ ...fresh, count: 1 }), true);
  assert.equal(difficultyBlocked({ ...fresh, finished: true }), true);
  assert.equal(difficultyBlocked({ ...fresh, finished: true, open: true }), true);
});

test("daily and all models keep separate unfinished rounds", () => {
  const games: OpenGame[] = [
    { id: "daily-easy", mode: "daily", difficulty: "easy" },
    hard,
  ];
  assert.equal(openGameOn(games, "daily", "easy")?.id, "daily-easy");
  assert.equal(openGameOn(games, "daily", "hard"), null);
  assert.equal(openGameOn(games, "all", "easy"), null);
  assert.equal(openGameOn(games, "all", "hard")?.id, "game-hard");
  assert.equal(modeToOpen(games), "daily");
  assert.equal(modeToOpen([hard]), "all");
  assert.equal(modeToOpen([]), null);
  assert.equal(modeToOpen([{ id: "old", mode: "all", difficulty: null }]), null);
  const company: OpenGame = { id: "anthropic-round", mode: "company", difficulty: null, companyId: "anthropic" };
  assert.equal(openCompanyOn([company], "anthropic")?.id, "anthropic-round");
  assert.equal(openCompanyOn([company], "openai"), null);
  assert.equal(modeToOpen([company]), "company");
  assert.equal(modeToOpen([hard, company]), "all");
});

test("one active round per mode and difficulty replaces the single active round", () => {
  const sql = fs.readFileSync(path.join(root, "supabase/migrations/20261021080000_baseline.sql"), "utf8");
  assert.doesNotMatch(sql, /games_one_active_idx/);
  assert.match(sql, /create unique index games_one_active_per_difficulty_idx/);
  assert.match(sql, /on public\.games \(user_id, game_mode, difficulty\)/);
  assert.match(sql, /where status = 'active'/);
  assert.match(sql, /game_mode = p_game_mode/);
  assert.match(sql, /difficulty is not distinct from p_difficulty/);
  assert.match(sql, /'active_game'/);
  assert.match(sql, /existing_status = 'active'/);
  assert.match(sql, /'daily_done'/);
  assert.doesNotMatch(sql, /select count\(\*\) into active_count from public\.games where user_id = p_user_id and status = 'active'/);
  const home = fs.readFileSync(path.join(root, "components/home-board.tsx"), "utf8");
  assert.match(home, /unfinishedLine/);
  assert.match(home, /openGameOn/);
  assert.match(home, /difficulty-resume/);
  assert.doesNotMatch(home, /activeGameId/);
  assert.doesNotMatch(home, /className="button"/);
});
