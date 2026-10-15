import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { crawlableFavicons, organizationJsonLd, siteOrigin } from "./site";

test("sitemap lists the public pages on the www origin", () => {
  const urls = sitemap().map((entry) => entry.url);
  assert.deepEqual(urls, [
    "https://www.whos-that-llm.com/",
    "https://www.whos-that-llm.com/scoring",
    "https://www.whos-that-llm.com/leaderboard",
    "https://www.whos-that-llm.com/statistics",
    "https://www.whos-that-llm.com/why",
  ]);
  for (const url of urls) assert.equal(url.startsWith(`${siteOrigin}/`), true);
  const listed = urls.join(" ");
  for (const blocked of ["/admin", "/api/", "/login", "/play", "/r/", "/profile", "/welcome", "/account", "/auth"]) {
    assert.equal(listed.includes(`${siteOrigin}${blocked}`), false, blocked);
  }
});

test("robots allows crawling and points at the sitemap", () => {
  const result = robots();
  assert.deepEqual(result.rules, { userAgent: "*", allow: "/" });
  assert.equal("disallow" in (result.rules as object), false);
  assert.equal(result.sitemap, `${siteOrigin}/sitemap.xml`);
});

test("crawlable favicons are square pngs at 48 and 192 with no media query", () => {
  assert.deepEqual(
    crawlableFavicons.map((icon) => icon.sizes),
    ["48x48", "192x192"],
  );
  for (const icon of crawlableFavicons) {
    assert.equal(icon.type, "image/png");
    assert.equal("media" in icon, false);
    const size = Number(icon.sizes.split("x")[0]);
    assert.equal(size % 48, 0);
    const buf = readFileSync(path.join(process.cwd(), "public", icon.url.slice(1)));
    assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(buf.readUInt32BE(16), size);
    assert.equal(buf.readUInt32BE(20), size);
  }
});

test("organization schema names the site and the 192 png", () => {
  assert.deepEqual(organizationJsonLd, {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Who's that LLM?",
    url: "https://www.whos-that-llm.com",
    logo: "https://www.whos-that-llm.com/brand/favicon-192.png",
  });
});
