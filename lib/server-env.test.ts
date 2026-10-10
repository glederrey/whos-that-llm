import assert from "node:assert/strict";
import test from "node:test";
import { readServerEnv } from "./server-env";

const name = "OPENROUTER_MANAGEMENT_KEY_TEST";

function withValue(value: string | undefined, run: () => void) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

test("server env ignores a pulled sensitive placeholder and blank values", () => {
  withValue(undefined, () => assert.equal(readServerEnv(name), undefined));
  withValue("", () => assert.equal(readServerEnv(name), undefined));
  withValue("   ", () => assert.equal(readServerEnv(name), undefined));
  withValue("[SENSITIVE]", () => assert.equal(readServerEnv(name), undefined));
  withValue("  [SENSITIVE]  ", () => assert.equal(readServerEnv(name), undefined));
  withValue(" sk-or-v1-test ", () => assert.equal(readServerEnv(name), "sk-or-v1-test"));
});
