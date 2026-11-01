import assert from "node:assert/strict";
import test from "node:test";
import { isLobePath, isMonoLobe, lobeIdOf, lobePath, lobeUrl } from "./lobe-logo";
import { logoPathForPlay, logoPublicUrl } from "./logos";

test("lobe paths round trip and reject bad ids", () => {
  assert.equal(lobeIdOf(lobePath("qwen-color")), "qwen-color");
  assert.equal(isLobePath("lobe:openai"), true);
  assert.equal(lobeIdOf("lobe:../x"), null);
  assert.equal(lobeIdOf("lobe:"), null);
  assert.equal(lobeIdOf("logos/companies/a.png"), null);
  assert.equal(lobeUrl("openai"), "/lobe/openai.svg");
});

test("only the color icons keep their own colours", () => {
  assert.equal(isMonoLobe("openai"), true);
  assert.equal(isMonoLobe("qwen-color"), false);
});

test("lobe logos skip the bucket", () => {
  assert.equal(logoPathForPlay("lobe:openai", "c1"), "lobe:openai");
  assert.equal(logoPublicUrl("https://x.supabase.co", "lobe:openai"), "/lobe/openai.svg");
});
