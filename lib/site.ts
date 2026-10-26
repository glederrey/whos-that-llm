export const siteOrigin = "https://www.whos-that-llm.com";

/** Keyboard apostrophe. Search cards read the title source as text. */
export const siteName = "Who's that LLM?";

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Visible name. The apostrophe stays a character. */
export function siteNameHtml(name = siteName): string {
  return escapeHtmlText(name);
}

/**
 * Open Graph and Twitter titles. The metadata API would write ' as &#x27;.
 * A double-escaped source would show that code on the card.
 */
export function siteSocialTitleHtml(name = siteName): string {
  const attr = escapeHtmlText(name).replace(/"/g, "&quot;");
  return [
    `<meta property="og:title" content="${attr}">`,
    `<meta property="og:site_name" content="${attr}">`,
    `<meta name="twitter:title" content="${attr}">`,
  ].join("");
}

/** Pages a searcher should find. Admin, API, auth, and per-game URLs stay out. */
export const publicPaths = ["/", "/scoring", "/leaderboard", "/statistics", "/models", "/why"] as const;

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
