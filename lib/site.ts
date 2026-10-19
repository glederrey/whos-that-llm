export const siteOrigin = "https://www.whos-that-llm.com";

/**
 * Typographic apostrophe. A straight one is written as &#x27; in the title,
 * and a search card prints that code.
 */
export const siteName = "Who\u2019s that LLM?";

/** Pages a searcher should find. Admin, API, auth, and per-game URLs stay out. */
export const publicPaths = ["/", "/scoring", "/leaderboard", "/statistics", "/why"] as const;

/** Square PNGs with no color-scheme media query. 48 and 192 are multiples of 48px. */
export const crawlableFavicons = [
  { url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" },
  { url: "/brand/favicon-192.png", sizes: "192x192", type: "image/png" },
];

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName,
  url: siteOrigin,
  logo: `${siteOrigin}/brand/favicon-192.png`,
};

export function publicPageUrl(path: (typeof publicPaths)[number]): string {
  return path === "/" ? `${siteOrigin}/` : `${siteOrigin}${path}`;
}
