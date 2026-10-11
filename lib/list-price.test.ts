import assert from "node:assert/strict";
import test from "node:test";
import { dollarsPerMillion, formatListPrice } from "./list-price";

test("a per-token price becomes dollars per million tokens", () => {
  assert.equal(dollarsPerMillion("0.00002"), 20);
  assert.equal(dollarsPerMillion("0.00005"), 50);
  assert.equal(dollarsPerMillion("0.00003"), 30);
  assert.equal(dollarsPerMillion("0.0000014"), 1);
  assert.equal(dollarsPerMillion("0.0000015"), 2);
  assert.equal(dollarsPerMillion("0.00000015"), 0.2);
  assert.equal(dollarsPerMillion("0.00000014"), 0.1);
  assert.equal(dollarsPerMillion("0.00000005"), 0.1);
  assert.equal(dollarsPerMillion("0.000000018"), 0.02);
  assert.equal(dollarsPerMillion("0.000000004"), 0.004);
  assert.equal(dollarsPerMillion("0"), 0);
  assert.equal(dollarsPerMillion(""), null);
  assert.equal(dollarsPerMillion("free"), null);
});

test("a list price prints with a dollar sign and no trailing noise", () => {
  assert.equal(formatListPrice(20), "$20");
  assert.equal(formatListPrice(0.2), "$0.2");
  assert.equal(formatListPrice(0.02), "$0.02");
  assert.equal(formatListPrice(0), "$0");
  assert.equal(formatListPrice(null), "—");
});
