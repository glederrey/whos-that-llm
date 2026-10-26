import assert from "node:assert/strict";
import test from "node:test";
import { staleCutoff } from "./expire-games";

test("the cutoff is seven days before now", () => {
  assert.equal(staleCutoff(new Date("2026-10-26T12:00:00Z")).toISOString(), "2026-10-19T12:00:00.000Z");
});

test("the number of days can change", () => {
  assert.equal(staleCutoff(new Date("2026-10-26T12:00:00Z"), 1).toISOString(), "2026-10-25T12:00:00.000Z");
});
