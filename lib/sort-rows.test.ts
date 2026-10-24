import assert from "node:assert/strict";
import test from "node:test";
import { compareValues, nextSort, pageCountOf, pageOf, sortRows } from "./sort-rows";

test("a missing value goes last in both directions", () => {
  assert.ok(compareValues(null, 1, "asc") > 0);
  assert.ok(compareValues(null, 1, "desc") > 0);
  assert.ok(compareValues(1, null, "asc") < 0);
  assert.ok(compareValues(1, null, "desc") < 0);
  assert.equal(compareValues(null, null, "asc"), 0);
});

test("numbers compare as numbers and text as text", () => {
  assert.ok(compareValues(2, 10, "asc") < 0);
  assert.ok(compareValues(2, 10, "desc") > 0);
  assert.ok(compareValues("alpha", "beta", "asc") < 0);
  assert.ok(compareValues("alpha", "beta", "desc") > 0);
});

test("a header click starts a number column high to low and a text column A to Z, then flips", () => {
  assert.deepEqual(nextSort(null, 1, true), { column: 1, dir: "desc" });
  assert.deepEqual(nextSort(null, 0, false), { column: 0, dir: "asc" });
  assert.deepEqual(nextSort({ column: 1, dir: "desc" }, 1, true), { column: 1, dir: "asc" });
  assert.deepEqual(nextSort({ column: 1, dir: "asc" }, 1, true), { column: 1, dir: "desc" });
  assert.deepEqual(nextSort({ column: 1, dir: "asc" }, 0, false), { column: 0, dir: "asc" });
});

test("sorting keeps the order of equal rows and leaves the input alone", () => {
  const rows = [
    { id: "a", v: [1, "x"] },
    { id: "b", v: [null, "y"] },
    { id: "c", v: [1, "z"] },
    { id: "d", v: [3, "w"] },
  ];
  const valueOf = (row: (typeof rows)[number]) => row.v as (string | number | null)[];
  assert.deepEqual(sortRows(rows, valueOf, { column: 0, dir: "desc" }).map((row) => row.id), ["d", "a", "c", "b"]);
  assert.deepEqual(sortRows(rows, valueOf, { column: 0, dir: "asc" }).map((row) => row.id), ["a", "c", "d", "b"]);
  assert.equal(sortRows(rows, valueOf, null), rows);
  assert.deepEqual(rows.map((row) => row.id), ["a", "b", "c", "d"]);
});

test("paging splits rows into pages and has at least one page", () => {
  const rows = Array.from({ length: 23 }, (_, index) => index);
  assert.equal(pageCountOf(23, 10), 3);
  assert.equal(pageCountOf(0, 10), 1);
  assert.equal(pageCountOf(23, undefined), 1);
  assert.equal(pageOf(rows, 1, 10).length, 10);
  assert.deepEqual(pageOf(rows, 3, 10), [20, 21, 22]);
  assert.equal(pageOf(rows, 1, undefined), rows);
});
