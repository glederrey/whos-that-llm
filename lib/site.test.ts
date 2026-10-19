import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { SiteName, SiteTitle } from "../components/site-title";
import { systemPrompt } from "./prompt";
import { crawlableFavicons, organizationJsonLd, siteName, siteNameHtml, siteOrigin, siteSocialTitleHtml } from "./site";

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
  assert.equal(siteName, "Who's that LLM?");
  assert.equal(siteName.includes("\u2019"), false);
  assert.equal(siteName.includes("&#"), false);
  assert.equal(siteNameHtml(), "Who's that LLM?");
  const social = siteSocialTitleHtml();
  assert.match(social, /<meta property="og:title" content="Who's that LLM\?">/);
  assert.match(social, /<meta name="twitter:title" content="Who's that LLM\?">/);
  assert.equal(social.includes("&#x27;"), false);
  assert.equal(social.includes("&amp;#x27;"), false);
  assert.deepEqual(organizationJsonLd, {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: "https://www.whos-that-llm.com",
    logo: "https://www.whos-that-llm.com/brand/favicon-192.png",
  });
  const json = JSON.stringify(organizationJsonLd);
  assert.match(json, /"name":"Who's that LLM\?"/);
  assert.equal(json.includes("&#"), false);
  const layout = readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8");
  const why = readFileSync(path.join(process.cwd(), "app/why/page.tsx"), "utf8");
  const result = readFileSync(path.join(process.cwd(), "app/r/[gameId]/page.tsx"), "utf8");
  const prompt = readFileSync(path.join(process.cwd(), "lib/prompt.ts"), "utf8");
  assert.match(layout, /<SiteTitle \/>/);
  assert.match(layout, /<SiteName \/>/);
  assert.doesNotMatch(layout, /title:\s*siteName|openGraph:|twitter:/);
  assert.match(why, /<SiteName tag="strong" \/>/);
  assert.doesNotMatch(result, /title:\s*shareBrand|title:\s*siteName/);
  assert.match(prompt, /\$\{siteName\}/);
  assert.match(systemPrompt(new Date("2026-10-19T00:00:00Z")), /You're playing Who's that LLM\?/);
});

test("the title source contains a keyboard apostrophe", () => {
  const html = renderToStaticMarkup(createElement(SiteTitle));
  assert.match(html, /<title>Who's that LLM\?<\/title>/);
  assert.match(html, /<meta property="og:title" content="Who's that LLM\?">/);
  assert.match(html, /<meta property="og:site_name" content="Who's that LLM\?">/);
  assert.match(html, /<meta name="twitter:title" content="Who's that LLM\?">/);
  assert.equal(html.includes("&#x27;"), false);
  assert.equal(html.includes("&amp;#x27;"), false);
  assert.equal(html.includes("\u2019"), false);
  const header = renderToStaticMarkup(createElement(SiteName));
  const strong = renderToStaticMarkup(createElement(SiteName, { tag: "strong" }));
  assert.equal(header, "<span>Who's that LLM?</span>");
  assert.equal(strong, "<strong>Who's that LLM?</strong>");
});
