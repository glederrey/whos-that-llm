import assert from "node:assert/strict";
import test from "node:test";
import { createIdleWatch } from "./idle-watch";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("it fires once when nothing arrives within the first wait", async () => {
  let fired = 0;
  createIdleWatch({ firstMs: 20, idleMs: 10, onIdle: () => (fired += 1) });
  await wait(60);
  assert.equal(fired, 1);
});

test("each touch pushes the deadline back and the idle wait applies after the first chunk", async () => {
  let fired = 0;
  const watch = createIdleWatch({ firstMs: 200, idleMs: 40, onIdle: () => (fired += 1) });
  for (let i = 0; i < 4; i += 1) {
    await wait(15);
    watch.touch();
  }
  assert.equal(fired, 0);
  await wait(80);
  assert.equal(fired, 1);
});

test("stop cancels it", async () => {
  let fired = 0;
  const watch = createIdleWatch({ firstMs: 10, idleMs: 10, onIdle: () => (fired += 1) });
  watch.stop();
  watch.touch();
  await wait(40);
  assert.equal(fired, 0);
});
