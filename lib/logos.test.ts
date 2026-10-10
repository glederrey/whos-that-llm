import assert from "node:assert/strict";
import test from "node:test";
import { companyLogoPath, logoPathForPlay, logoPublicUrl, readLogo } from "./logos";

test("a company logo is logos/{id}.png in the public logos bucket", () => {
  assert.equal(companyLogoPath("anthropic"), "logos/anthropic.png");
  assert.equal(
    logoPublicUrl("https://example.supabase.co/", "logos/anthropic.png"),
    "https://example.supabase.co/storage/v1/object/public/logos/anthropic.png",
  );
  assert.equal(
    logoPublicUrl("https://example.supabase.co", "https://cdn.example/mark.png"),
    "https://cdn.example/mark.png",
  );
});

test("an old stored logo path still resolves to the bucket png", () => {
  assert.equal(logoPathForPlay("/logos/openai.svg", "openai"), "logos/openai.png");
  assert.equal(logoPathForPlay("logos/deepseek.png", "deepseek"), "logos/deepseek.png");
  assert.equal(logoPathForPlay("https://cdn.example/mistral.webp", "mistral"), "https://cdn.example/mistral.webp");
});

test("a logo file is an svg, png, or webp under 1 MB", () => {
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.deepEqual(readLogo(svg), { mime: "image/svg+xml", ext: "svg" });
  assert.equal(readLogo(new TextEncoder().encode("<svg><script>alert(1)</script></svg>")), null);
  const png = new Uint8Array(16);
  png.set([0x89, 0x50, 0x4e, 0x47]);
  assert.deepEqual(readLogo(png), { mime: "image/png", ext: "png" });
  assert.equal(readLogo(new Uint8Array(1024 * 1024 + 1)), null);
  assert.equal(readLogo(new TextEncoder().encode("not a logo")), null);
});
