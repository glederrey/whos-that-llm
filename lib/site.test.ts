import assert from "node:assert/strict";
import test from "node:test";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { siteOrigin } from "./site";

test("sitemap lists the public pages on the www origin", () => {
  const urls = sitemap().map((entry) => entry.url);
  assert.deepEqual(urls, [
    "https://www.whos-that-llm.com/",
    "https://www.whos-that-llm.com/scoring",
    "https://www.whos-that-llm.com/leaderboard",
  ]);
  for (const url of urls) assert.equal(url.startsWith(`${siteOrigin}/`), true);
  const listed = urls.join(" ");
  for (const blocked of ["/admin", "/api/", "/login", "/play", "/profile", "/welcome", "/account", "/auth"]) {
    assert.equal(listed.includes(`${siteOrigin}${blocked}`), false, blocked);
  }
});

test("robots allows crawling and points at the sitemap", () => {
  const result = robots();
  assert.deepEqual(result.rules, { userAgent: "*", allow: "/" });
  assert.equal("disallow" in (result.rules as object), false);
  assert.equal(result.sitemap, `${siteOrigin}/sitemap.xml`);
});
