import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { finishedGameStatuses, isFinishedGame } from "./game";

const root = path.resolve(import.meta.dirname, "..");

test("a round counts as played only after it is solved, missed, or given up", () => {
  assert.deepEqual([...finishedGameStatuses], ["solved", "miss", "given_up"]);
  assert.equal(isFinishedGame("solved"), true);
  assert.equal(isFinishedGame("miss"), true);
  assert.equal(isFinishedGame("given_up"), true);
  assert.equal(isFinishedGame("active"), false);
});

test("the admin page labels games today as UTC and the board offers week and month", () => {
  const admin = fs.readFileSync(path.join(root, "app/admin/page.tsx"), "utf8");
  assert.match(admin, /Games today \(UTC\)/);
  const controls = fs.readFileSync(path.join(root, "components/board-controls.tsx"), "utf8");
  assert.match(controls, /This week/);
  assert.match(controls, /This month/);
});
