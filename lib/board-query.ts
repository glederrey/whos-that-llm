import { parseBoardDifficulty, type BoardDifficulty } from "./difficulty";

export type BoardPeriod = "week" | "all";

export type BoardChoice = {
  category: string;
  period: BoardPeriod;
  difficulty: BoardDifficulty;
};

/** The same choice on the home top 5 and the full leaderboard. */
export function boardChoice(
  params: { category?: string; period?: string; difficulty?: string },
  categoryIds: string[],
): BoardChoice {
  const category = params.category && categoryIds.includes(params.category) ? params.category : categoryIds.includes("all") ? "all" : (categoryIds[0] ?? "all");
  const period: BoardPeriod = params.period === "all" ? "all" : "week";
  return { category, period, difficulty: parseBoardDifficulty(params.difficulty) };
}

export function boardHref(base: "/" | "/leaderboard", choice: BoardChoice, page = 1): string {
  const params = new URLSearchParams({
    category: choice.category,
    difficulty: choice.difficulty,
    period: choice.period,
  });
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return base === "/" ? `/?${query}` : `/leaderboard?${query}`;
}
