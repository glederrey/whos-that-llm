import assert from "node:assert/strict";
import test from "node:test";
import { avatarError, avatarFileError, avatarPublicUrl, cleanUsername, profileStats, readImage, traitFound } from "./profile";

test("a username trims and rejects an empty name", () => {
  assert.equal(cleanUsername("  Ada  "), "Ada");
  assert.equal(cleanUsername("A!"), null);
  assert.equal(cleanUsername("   "), null);
  assert.equal(cleanUsername("ok\nname"), null);
});

test("stats count finished games and leave an empty player blank", () => {
  const stats = profileStats([
    { status: "solved", score: 1000, messageCount: 2 },
    { status: "solved", score: 400, messageCount: 4 },
    { status: "miss", score: 200, messageCount: 10 },
    { status: "given_up", score: null, messageCount: 0 },
    { status: "active", score: null, messageCount: 1 },
  ]);
  assert.equal(stats.played, 5);
  assert.equal(stats.solved, 2);
  assert.equal(stats.missed, 1);
  assert.equal(stats.givenUp, 1);
  assert.equal(stats.solveRate, 0.5);
  assert.equal(stats.best, 1000);
  assert.equal(stats.average, 1600 / 3);
  assert.equal(stats.averageMessages, 3);
  const empty = profileStats([]);
  assert.equal(empty.solveRate, null);
  assert.equal(empty.best, null);
  assert.equal(empty.average, null);
  assert.equal(empty.averageMessages, null);
});

test("company and region count as found when the model is named or the trait matched", () => {
  assert.equal(
    traitFound({ status: "solved", given: [], companyCorrect: false, regionCorrect: false, trait: "company" }),
    true,
  );
  assert.equal(
    traitFound({ status: "miss", given: [], companyCorrect: true, regionCorrect: false, trait: "region" }),
    false,
  );
  assert.equal(
    traitFound({ status: "miss", given: ["region"], companyCorrect: false, regionCorrect: false, trait: "region" }),
    true,
  );
});

test("an avatar url stays inside the public avatars bucket", () => {
  assert.equal(
    avatarPublicUrl("https://example.supabase.co/", "user/avatar.jpg"),
    "https://example.supabase.co/storage/v1/object/public/avatars/user/avatar.jpg",
  );
  assert.equal(avatarPublicUrl("https://example.supabase.co", null), null);
});

test("a picture has to be a jpeg, png, or webp under 1 MB", () => {
  assert.equal(readImage(Uint8Array.from([0xff, 0xd8, 0xff])), null);
  const jpeg = new Uint8Array(16);
  jpeg.set([0xff, 0xd8, 0xff]);
  assert.deepEqual(readImage(jpeg), { mime: "image/jpeg", ext: "jpg" });
  const gif = new Uint8Array(16);
  gif.set([0x47, 0x49, 0x46, 0x38]);
  assert.equal(readImage(gif), null);
  assert.equal(readImage(new Uint8Array(1024 * 1024 + 1)), null);
  assert.equal(avatarFileError({ size: 1024 * 1024 + 1, type: "image/png" }), avatarError);
  assert.equal(avatarFileError({ size: 100, type: "image/gif" }), avatarError);
  assert.equal(avatarFileError({ size: 100, type: "image/webp" }), null);
});
