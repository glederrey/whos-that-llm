import assert from "node:assert/strict";
import test from "node:test";
import { hourlyWindow } from "./lobby-window";

const hour = 60 * 60 * 1000;
const now = Date.parse("2026-11-06T12:00:00Z");

test("no round in the last hour means nothing played and no wait", () => {
  assert.deepEqual(hourlyWindow([], now - hour), { played: 0, nextAt: null });
});

test("the count is the rows in the window and the wait ends an hour after the oldest", () => {
  const out = hourlyWindow(["2026-11-06T11:10:00Z", "2026-11-06T11:30:00Z", "2026-11-06T11:50:00Z"], now - hour);
  assert.equal(out.played, 3);
  assert.equal(out.nextAt, "2026-11-06T12:10:00.000Z");
});

test("rows at or before the window start, and bad values, are ignored, in any order", () => {
  const out = hourlyWindow(["2026-11-06T11:50:00Z", "2026-11-06T11:00:00Z", null, "nope", "2026-11-06T11:20:00Z"], now - hour);
  assert.equal(out.played, 2);
  assert.equal(out.nextAt, "2026-11-06T12:20:00.000Z");
});
