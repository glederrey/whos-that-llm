import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { filterCategories } from "./category-filter";
import { presentCategoryIcon } from "./category-icon";
import { modeToOpen, openCategoryOn } from "./lobby-row";

const root = path.resolve(import.meta.dirname, "..");

test("an emoji icon is shown as text and an unknown company gives no icon", () => {
  assert.deepEqual(presentCategoryIcon({ icon_kind: "emoji", icon_value: "🧪" }, undefined), { kind: "emoji", src: "🧪" });
  assert.equal(presentCategoryIcon({ icon_kind: "company", icon_value: "ghost" }, undefined), null);
  assert.equal(presentCategoryIcon({ icon_kind: "nope", icon_value: "x" }, undefined), null);
  assert.equal(presentCategoryIcon({ icon_kind: "company", icon_value: "anthropic" }, "logos/anthropic.png")?.kind, "logo");
  assert.match(presentCategoryIcon({ icon_kind: "image", icon_value: "categories/opus-ab12.png" }, undefined)?.src ?? "", /categories\/opus-ab12\.png$/);
});

test("the category list filters by name and description", () => {
  const items = [
    { name: "Opus", description: "The big Claude line" },
    { name: "Nano", description: "Tiny models" },
  ];
  assert.equal(filterCategories(items, "").length, 2);
  assert.deepEqual(filterCategories(items, "OPUS").map((item) => item.name), ["Opus"]);
  assert.deepEqual(filterCategories(items, "tiny mod").map((item) => item.name), ["Nano"]);
  assert.equal(filterCategories(items, "zzz").length, 0);
});

test("an open category round is found and opens the Category card", () => {
  const games = [{ id: "g1", mode: "class", difficulty: null, categoryId: "opus" }];
  assert.equal(openCategoryOn(games, "opus")?.id, "g1");
  assert.equal(openCategoryOn(games, "nano"), null);
  assert.equal(modeToOpen(games), "class");
});

test("the start route and lobby validate the category server side", () => {
  const start = fs.readFileSync(path.join(root, "lib/rounds-start.ts"), "utf8");
  const route = fs.readFileSync(path.join(root, "app/api/games/route.ts"), "utf8");
  const combo = fs.readFileSync(path.join(root, "components/category-combobox.tsx"), "utf8");
  assert.match(route, /body\.gameMode === "class"/);
  assert.match(start, /p_game_mode: "class"/);
  assert.match(start, /pool\.length < 2/);
  assert.match(start, /\.filter\(\(row\) => row\.models >= 2\)/);
  for (const part of ['role="combobox"', 'role="listbox"', 'role="option"', "ArrowDown", "ArrowUp", "Escape", "Enter"]) {
    assert.ok(combo.includes(part), part);
  }
});
