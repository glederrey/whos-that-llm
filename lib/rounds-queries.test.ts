import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rulesForGameMode } from "./config";
import { leaderboardWith, readPublicStats, rpc, saveUsername, scoreFrom } from "./rounds-queries";
import type { GameRow } from "./rounds-shape";

type Reply = { data?: unknown; error?: { message: string } | null; count?: number | null };

/** A hand-written client: every query method chains, awaiting a table gives its reply, rpc gives the reply for its name. */
function fakeClient(tables: Record<string, Reply>, rpcs: Record<string, Reply>) {
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];
  const tableCalls: string[] = [];
  const client = {
    from(table: string) {
      tableCalls.push(table);
      const reply = tables[table] ?? { data: null };
      const chain: Record<string, unknown> = {};
      const proxy: unknown = new Proxy(chain, {
        get(_target, prop) {
          if (prop === "then") return (resolve: (value: Reply) => unknown) => resolve({ error: null, ...reply });
          return () => proxy;
        },
      });
      return proxy;
    },
    async rpc(fn: string, args: unknown) {
      rpcCalls.push({ fn, args });
      return { error: null, data: null, ...(rpcs[fn] ?? {}) };
    },
  };
  return { client: client as unknown as SupabaseClient, rpcCalls, tableCalls };
}

function gameRow(): GameRow {
  return {
    id: "g1",
    user_id: "u1",
    username: "ann",
    game_mode: "all",
    pool_key: null,
    pool_model_ids: [],
    model_id: "m1",
    traits: { given: [], models: {} },
    status: "active",
    no_hint: false,
    rules: rulesForGameMode(true),
    hints: [],
    difficulty: 2,
    message_count: 2,
    awaiting_guess: true,
    score: null,
    score_breakdown: null,
    score_explanation: null,
  };
}

test("scoreFrom throws the database message when the usage query fails", async () => {
  const { client } = fakeClient({ usage: { error: { message: "usage down" } } }, {});
  await assert.rejects(scoreFrom(client, gameRow(), [], false), /usage down/);
});

test("scoreFrom scores from the usage rows it reads", async () => {
  const { client, tableCalls } = fakeClient({ usage: { data: [{ input_tokens: 10, output_tokens: 5 }] } }, {});
  const scored = await scoreFrom(client, gameRow(), [{ modelCorrect: true, companyCorrect: true, regionCorrect: true }], true);
  assert.deepEqual(tableCalls, ["usage"]);
  assert.equal(typeof scored.score, "number");
  assert.ok(Array.isArray(scored.breakdown));
});

test("rpc returns the data and throws on an error", async () => {
  const ok = fakeClient({}, { start_game: { data: { ok: true, gameId: "g" } } });
  assert.deepEqual(await rpc(ok.client, "start_game", { a: 1 }), { ok: true, gameId: "g" });
  assert.deepEqual(ok.rpcCalls, [{ fn: "start_game", args: { a: 1 } }]);
  const bad = fakeClient({}, { start_game: { error: { message: "boom" } } });
  await assert.rejects(rpc(bad.client, "start_game", {}), /boom/);
});

test("saveUsername maps an rpc error to 500, unauthorized to 401, other refusals to 422, success to null", async () => {
  const run = (reply: Reply) => saveUsername(fakeClient({}, { set_username: reply }).client, "ann");
  assert.deepEqual(await run({ error: { message: "x" } }), { status: 500, error: "server" });
  assert.deepEqual(await run({ data: { ok: false, error: "unauthorized" } }), { status: 401, error: "unauthorized" });
  assert.deepEqual(await run({ data: { ok: false, error: "taken" } }), { status: 422, error: "username" });
  assert.deepEqual(await run({ data: null }), { status: 422, error: "username" });
  assert.equal(await run({ data: { ok: true } }), null);
});

test("saveUsername sends the raw name as p_username", async () => {
  const { client, rpcCalls } = fakeClient({}, { set_username: { data: { ok: true } } });
  await saveUsername(client, "  Ann  ");
  assert.deepEqual(rpcCalls, [{ fn: "set_username", args: { p_username: "  Ann  " } }]);
});

const modeOn = { game_modes: { data: { leaderboard: true } } };
const entry = { rank: 1, name: "ann", score: 10, mine: true };

test("leaderboard returns not_found when the mode has no board", async () => {
  const { client, rpcCalls } = fakeClient({ game_modes: { data: { leaderboard: false } } }, {});
  assert.deepEqual(await leaderboardWith(client, "all", "week"), { status: 404, error: "not_found" });
  assert.deepEqual(await leaderboardWith(fakeClient({ game_modes: { data: null } }, {}).client, "all", "week"), {
    status: 404,
    error: "not_found",
  });
  assert.equal(rpcCalls.length, 0);
});

test("leaderboard uses the newest rpc signature first, with the company filter", async () => {
  const { client, rpcCalls } = fakeClient(modeOn, { leaderboard: { data: [entry] } });
  const out = await leaderboardWith(client, "company", "all", "viewer", "hard", "acme");
  assert.ok("rows" in out);
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].mine, true);
  assert.equal(rpcCalls.length, 1);
  const args = rpcCalls[0].args as Record<string, unknown>;
  assert.equal(args.game_mode, "company");
  assert.equal(args.viewer, "viewer");
  assert.equal(args.p_difficulty, null);
  assert.equal(args.p_company, "acme");
});

test("leaderboard falls back to the older signatures in order, then marks the viewer from their best game", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const { client } = fakeClient({ game_modes: { data: { leaderboard: true } }, games: { data: [{ username: "ann", score: 10 }] } }, {});
  (client as unknown as { rpc: unknown }).rpc = async (_fn: string, args: Record<string, unknown>) => {
    calls.push(args);
    if ("p_company" in args || "p_difficulty" in args) return { error: { message: "old" }, data: null };
    return { error: null, data: [entry, { ...entry, rank: 2, name: "bob", mine: true }] };
  };
  const out = await leaderboardWith(client, "all", "week", "viewer", "easy");
  assert.ok("rows" in out);
  assert.deepEqual(calls.map((a) => Object.keys(a).sort()), [
    ["game_mode", "p_company", "p_difficulty", "since", "viewer"],
    ["game_mode", "p_difficulty", "since", "viewer"],
    ["game_mode", "since"],
  ]);
  // the legacy rows ignore their own mine flag: only the best own game's name and score count
  assert.deepEqual(out.rows.map((r) => r.mine), [true, false]);
});

test("leaderboard legacy path without a viewer marks nobody, and a failing legacy rpc throws", async () => {
  const legacyOnly = (reply: Reply) => {
    const { client } = fakeClient(modeOn, {});
    (client as unknown as { rpc: unknown }).rpc = async (_fn: string, args: Record<string, unknown>) =>
      "since" in args && !("viewer" in args) ? { error: null, data: null, ...reply } : { error: { message: "old" }, data: null };
    return client;
  };
  const out = await leaderboardWith(legacyOnly({ data: [entry] }), "all", "week");
  assert.ok("rows" in out);
  assert.deepEqual(out.rows.map((r) => r.mine), [false]);
  await assert.rejects(leaderboardWith(legacyOnly({ error: { message: "legacy down" } }), "all", "week"), /legacy down/);
});

test("readPublicStats uses the rpc counts and fills in companies when it omits them", async () => {
  const withAll = fakeClient({}, { public_stats: { data: { models: 3, gamesToday: 2, players: 7, companies: 4 } } });
  assert.deepEqual(await readPublicStats(withAll.client), { models: 3, gamesToday: 2, players: 7, companies: 4 });
  const noCompanies = fakeClient(
    { models: { data: [{ company_id: "a" }, { company_id: "a" }, { company_id: "b" }, { company_id: "" }] } },
    { public_stats: { data: { models: 3 } } },
  );
  assert.deepEqual(await readPublicStats(noCompanies.client), { models: 3, gamesToday: 0, players: 0, companies: 2 });
});

test("readPublicStats counts by hand when the rpc is missing", async () => {
  const { client } = fakeClient(
    {
      models: { data: [{ company_id: "a" }, { company_id: "b" }], count: 5 },
      games: { data: [{ user_id: "u1" }, { user_id: "u1" }, { user_id: "u2" }], count: 8 },
    },
    { public_stats: { error: { message: "no rpc" } } },
  );
  assert.deepEqual(await readPublicStats(client), { models: 5, gamesToday: 8, players: 2, companies: 2 });
});

test("readPublicStats throws when the manual count fails", async () => {
  const { client } = fakeClient({ models: { error: { message: "models down" } } }, { public_stats: { error: { message: "x" } } });
  await assert.rejects(readPublicStats(client), /models down/);
});
