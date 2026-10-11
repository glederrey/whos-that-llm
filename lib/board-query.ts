import { parseBoardDifficulty, type BoardDifficulty } from "./difficulty";

export type BoardPeriod = "week" | "all";

export type BoardChoice = {
  category: string;
  period: BoardPeriod;
  difficulty: BoardDifficulty;
};

export type BoardMode = {
  id: string;
  name: string;
  open: boolean;
};

export type BoardMiddle =
  | { kind: "difficulty" }
  | { kind: "class"; disabled: boolean }
  | { kind: "company"; disabled: boolean };

/** Modes that have a leaderboard. Region and Custom do not. */
const boardModeIds = ["daily", "all", "class", "company"] as const;

/** Daily and All models. Class and Company use a dropdown instead. */
const difficultyModeIds = new Set(["daily", "all"]);

/** The same choice on the home top 5 and the full leaderboard. A mode that is not open cannot be selected. */
export function boardChoice(
  params: { category?: string; period?: string; difficulty?: string },
  modes: BoardMode[],
): BoardChoice {
  const open = modes.filter((mode) => mode.open).map((mode) => mode.id);
  const requested = params.category && open.includes(params.category) ? params.category : null;
  const category = requested ?? (open.includes("all") ? "all" : (open[0] ?? "all"));
  const period: BoardPeriod = params.period === "all" ? "all" : "week";
  return { category, period, difficulty: parseBoardDifficulty(params.difficulty) };
}

export function boardModes(
  categories: Array<{ id: string; name: string; enabled: boolean; sort_order: number }>,
): BoardMode[] {
  return categories
    .filter((category) => (boardModeIds as readonly string[]).includes(category.id))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((category) => ({ id: category.id, name: category.name, open: category.enabled }));
}

/** The one middle control for the selected mode. Other modes' controls stay off the bar. */
export function boardMiddle(category: string, modes: BoardMode[]): BoardMiddle | null {
  const selected = modes.find((mode) => mode.id === category);
  if (!selected) return null;
  if (difficultyModeIds.has(category)) return selected.open ? { kind: "difficulty" } : null;
  if (category === "class" || category === "company") return { kind: category, disabled: !selected.open };
  return null;
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
