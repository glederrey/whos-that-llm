import assert from "node:assert/strict";
import test from "node:test";
import { readJsonBody } from "./http";

test("readJsonBody parses a JSON body", async () => {
  const request = new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
  assert.deepEqual(await readJsonBody(request), { a: 1 });
});

test("readJsonBody returns an empty object for invalid JSON", async () => {
  const request = new Request("http://localhost/x", { method: "POST", body: "not json" });
  assert.deepEqual(await readJsonBody(request), {});
});

test("readJsonBody returns an empty object for a missing body", async () => {
  const request = new Request("http://localhost/x", { method: "POST" });
  assert.deepEqual(await readJsonBody(request), {});
});
