import assert from "node:assert/strict";
import test from "node:test";
import { runAvailability, type AvailabilityStore } from "./availability-run";
import type { CatalogModel, SyncModel } from "./roster-sync";

function listed(id: string): CatalogModel {
  return { id, name: "", description: null, created: null, inputUsdPerMtok: null, outputUsdPerMtok: null, outputModalities: [], modality: null, reasoning: false };
}

function row(id: string, available: boolean): SyncModel {
  return { id, name: id.toUpperCase(), openrouterId: `o/${id}`, enabled: available, available };
}

function store(roster: SyncModel[] | null) {
  const calls: string[] = [];
  const fake: AvailabilityStore = {
    loadRoster: async () => roster,
    markUnavailable: async (ids) => (calls.push(`off:${ids.join(",")}`), true),
    markAvailable: async (ids) => (calls.push(`on:${ids.join(",")}`), true),
    writeReasoning: async () => (calls.push("reasoning"), true),
  };
  return { fake, calls };
}

const roster = [row("a", true), row("b", true), row("c", false)];
const catalog = [listed("o/a"), listed("o/c")];

test("a dry run reports the changes and writes nothing", async () => {
  const { fake, calls } = store(roster);
  const out = await runAvailability(catalog, false, fake);
  assert.equal(out.ok && out.applied, false);
  assert.deepEqual(out.ok && out.newlyUnavailable.map((m) => m.id), ["b"]);
  assert.deepEqual(out.ok && out.backAvailable.map((m) => m.id), ["c"]);
  assert.equal(out.ok && out.checked, 3);
  assert.deepEqual(calls, []);
});

test("apply writes the changes and the reasoning flags", async () => {
  const { fake, calls } = store(roster);
  const out = await runAvailability(catalog, true, fake);
  assert.equal(out.ok && out.applied, true);
  assert.deepEqual(calls, ["off:b", "on:c", "reasoning"]);
});

test("apply re-checks the guard and writes nothing on a shrunken catalog", async () => {
  const { fake, calls } = store(roster);
  const out = await runAvailability([listed("o/z")], true, fake);
  assert.equal(out.ok, false);
  assert.equal(!out.ok && out.status, 502);
  assert.deepEqual(calls, []);
});

test("an empty catalog is a 502 and writes nothing", async () => {
  const { fake, calls } = store(roster);
  const out = await runAvailability([], true, fake);
  assert.equal(!out.ok && out.status, 502);
  assert.deepEqual(calls, []);
});

test("applying twice changes nothing the second time", async () => {
  const state = roster.map((r) => ({ ...r }));
  const writes: string[] = [];
  const fake: AvailabilityStore = {
    loadRoster: async () => state.map((r) => ({ ...r })),
    markUnavailable: async (ids) => {
      for (const r of state) if (ids.includes(r.id)) Object.assign(r, { available: false, enabled: false });
      writes.push(...ids);
      return true;
    },
    markAvailable: async (ids) => {
      for (const r of state) if (ids.includes(r.id)) r.available = true;
      writes.push(...ids);
      return true;
    },
    writeReasoning: async () => true,
  };
  await runAvailability(catalog, true, fake);
  writes.length = 0;
  const second = await runAvailability(catalog, true, fake);
  assert.deepEqual(writes, []);
  assert.deepEqual(second.ok && [second.newlyUnavailable, second.backAvailable], [[], []]);
  assert.equal(state.find((r) => r.id === "c")?.enabled, false);
});
