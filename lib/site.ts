import type { Metadata } from "next";

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

/** 1200x630 card: logo, name, and the pitch. */
export const socialImage = { url: "/brand/og-card.png", width: 1200, height: 630 };

/** The hero paragraph without the live model and company counts: the page description and the social card text. */
export const homeDescription =
  "Think you can tell AI models apart, like a wine? A hidden LLM answers you: ChatGPT, Claude, Gemini, or any of the models in play. You have ten messages to name it, in one of several game modes.";

/**
 * Description for search, Open Graph, and Twitter cards. Next does not copy `description` into og:description,
 * and a page's own `openGraph` replaces the layout's, so each page states it here.
 * `path` is the page's own path and becomes og:url. The image is stated here too, because a page's `openGraph` drops the file-convention image. The titles stay raw HTML in `SiteTitle`.
 */
export function socialMetadata(description: string, path = "/"): Metadata {
  const images = [{ url: socialImage.url, width: socialImage.width, height: socialImage.height, alt: siteName }];
  return {
    description,
    openGraph: { type: "website", url: `${siteOrigin}${path}`, description, images },
    twitter: { card: "summary_large_image", description, images },
  };
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
