export const siteOrigin = "https://www.whos-that-llm.com";

/** Pages a searcher should find. Admin, API, auth, and per-game URLs stay out. */
export const publicPaths = ["/", "/scoring", "/leaderboard", "/statistics", "/why"] as const;

export function publicPageUrl(path: (typeof publicPaths)[number]): string {
  return path === "/" ? `${siteOrigin}/` : `${siteOrigin}${path}`;
}
