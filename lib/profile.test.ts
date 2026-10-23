import assert from "node:assert/strict";
import test from "node:test";
import { avatarBodyTooLarge, avatarError, avatarFileError, avatarPublicUrl, bestScore, cleanUsername, profileStats, publicImageCacheControl, readImage, traitFound } from "./profile";

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

test("the best score covers every finished game", () => {
  const games = [
    { status: "solved" as const, score: 900 },
    { status: "solved" as const, score: 900 },
    { status: "miss" as const, score: 300 },
    { status: "given_up" as const, score: null },
    { status: "active" as const, score: 5000 },
  ];
  const best = bestScore(games);
  assert.equal(best, 900);
  const noScores = [{ status: "given_up" as const, score: null }];
  assert.equal(bestScore(noScores), null);
});

test("company and origin count as found when the model is named or the trait matched", () => {
  assert.equal(
    traitFound({ status: "solved", given: [], companyCorrect: false, originCorrect: false, trait: "company" }),
    true,
  );
  assert.equal(
    traitFound({ status: "miss", given: [], companyCorrect: true, originCorrect: false, trait: "origin" }),
    false,
  );
  assert.equal(
    traitFound({ status: "miss", given: ["origin"], companyCorrect: false, originCorrect: false, trait: "origin" }),
    true,
  );
});

test("an avatar url stays inside the public avatars bucket", () => {
  assert.equal(
    avatarPublicUrl("https://example.supabase.co/", "user/avatar.jpg"),
    "https://example.supabase.co/storage/v1/object/public/avatars/user/avatar.jpg",
  );
  assert.equal(avatarPublicUrl("https://example.supabase.co", null), null);
  assert.equal(avatarPublicUrl("https://example.supabase.co", "user/1.png")?.includes("?"), false);
  assert.equal(publicImageCacheControl, "31536000");
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

test("an avatar upload is refused by Content-Length before the body is read", () => {
  assert.equal(avatarBodyTooLarge("500000"), false);
  assert.equal(avatarBodyTooLarge("1048576"), false);
  assert.equal(avatarBodyTooLarge("2000000"), true);
  assert.equal(avatarBodyTooLarge(null), true);
  assert.equal(avatarBodyTooLarge("abc"), true);
});
