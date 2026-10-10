import assert from "node:assert/strict";
import test from "node:test";
import { perMillionLabel, pricesById } from "./openrouter-prices";

test("list prices are per million tokens", () => {
  assert.equal(perMillionLabel("0.000003"), "$3.00");
  assert.equal(perMillionLabel(0.0000002), "$0.20");
  assert.equal(perMillionLabel(0.00000015), "$0.15");
  assert.equal(perMillionLabel("0"), "$0");
  assert.equal(perMillionLabel(0), "$0");
  assert.equal(perMillionLabel(""), null);
  assert.equal(perMillionLabel("free"), null);
  assert.equal(perMillionLabel(-1), null);
  assert.equal(perMillionLabel(null), null);
});

test("a missing catalog row is not a made-up price", () => {
  const prices = pricesById({
    data: [
      { id: "openai/gpt-5.6-luna", pricing: { prompt: "0.000001", completion: "0" } },
      { id: "broken", pricing: { prompt: "nope" } },
    ],
  });
  assert.ok(prices);
  assert.equal(prices.get("openai/gpt-5.6-luna")?.prompt, "$1.00");
  assert.equal(prices.get("openai/gpt-5.6-luna")?.completion, "$0");
  assert.equal(prices.get("broken")?.prompt, null);
  assert.equal(prices.has("missing/model"), false);
  assert.equal(pricesById({}), null);
  assert.equal(pricesById(null), null);
});
