import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { squareLogo } from "./logo-square";

async function png(width: number, height: number): Promise<Uint8Array> {
  return new Uint8Array(await sharp({ create: { width, height, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer());
}

test("a wide logo is padded to a square, not cropped", async () => {
  const out = await squareLogo(await png(200, 100), "image/png");
  assert.ok(out);
  const meta = await sharp(out).metadata();
  assert.deepEqual([meta.width, meta.height], [200, 200]);
  const corner = await sharp(out).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
  assert.equal(corner[3], 0);
  const middle = await sharp(out).extract({ left: 100, top: 100, width: 1, height: 1 }).raw().toBuffer();
  assert.equal(middle[3], 255);
});

test("a big logo is scaled down to 512 and a small one is not enlarged", async () => {
  const big = await squareLogo(await png(2000, 1000), "image/png");
  const bigMeta = await sharp(big!).metadata();
  assert.deepEqual([bigMeta.width, bigMeta.height], [512, 512]);
  const small = await squareLogo(await png(40, 20), "image/png");
  const meta = await sharp(small!).metadata();
  assert.deepEqual([meta.width, meta.height], [40, 40]);
});

test("bytes that are not an image are refused", async () => {
  assert.equal(await squareLogo(new Uint8Array([1, 2, 3]), "image/png"), null);
});
