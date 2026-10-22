import { allCompanies, parseBoardCompany } from "./company";
import { parseBoardDifficulty, type BoardDifficulty } from "./difficulty";

export type BoardPeriod = "week" | "month" | "all";

export type BoardChoice = {
  gameMode: string;
  period: BoardPeriod;
  difficulty: BoardDifficulty;
  /** `all` or a company id. Used when Company is the selected mode. */
  company: string;
  /** `all` or a category id. Used when Category is the selected mode. */
  category: string;
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

/** Modes that have a leaderboard. Company sits above Category. Region and Custom do not. */
const boardModeIds = ["daily", "all", "company", "class"] as const;

/** Daily and All models. Company uses a company list. Category uses a dropdown. */
const difficultyModeIds = new Set(["daily", "all"]);

/** The same choice on the home top 5 and the full leaderboard. A mode that is not open cannot be selected. */
export function boardChoice(
  params: { gameMode?: string; period?: string; difficulty?: string; company?: string; category?: string },
  modes: BoardMode[],
): BoardChoice {
  const open = modes.filter((mode) => mode.open).map((mode) => mode.id);
  const requested = params.gameMode && open.includes(params.gameMode) ? params.gameMode : null;
  const gameMode = requested ?? (open.includes("all") ? "all" : (open[0] ?? "all"));
  const period: BoardPeriod = params.period === "all" || params.period === "month" ? params.period : "week";
  return {
    gameMode,
    period,
    difficulty: parseBoardDifficulty(params.difficulty),
    company: parseBoardCompany(params.company),
    category: parseBoardCompany(params.category),
  };
}

/** The cutoff for a board. Week starts Monday. Month is the calendar month. Both use UTC, and all time has no cutoff. */
export function boardSince(period: BoardPeriod, now = new Date()): string {
  if (period === "all") return "1970-01-01T00:00:00.000Z";
  if (period === "month") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff)).toISOString();
}

export function boardModes(
  gameModes: Array<{ id: string; name: string; enabled: boolean; sort_order: number }>,
): BoardMode[] {
  const byId = new Map(gameModes.map((gameMode) => [gameMode.id, gameMode]));
  return boardModeIds.flatMap((id) => {
    const gameMode = byId.get(id);
    return gameMode ? [{ id: gameMode.id, name: gameMode.name, open: gameMode.enabled }] : [];
  });
}

/** The one middle control for the selected mode. Other modes' controls stay off the bar. */
export function boardMiddle(gameMode: string, modes: BoardMode[]): BoardMiddle | null {
  const selected = modes.find((mode) => mode.id === gameMode);
  if (!selected) return null;
  if (difficultyModeIds.has(gameMode)) return selected.open ? { kind: "difficulty" } : null;
  if (gameMode === "class" || gameMode === "company") return { kind: gameMode, disabled: !selected.open };
  return null;
}

export function boardHref(base: "/" | "/leaderboard", choice: BoardChoice, page = 1): string {
  const params = new URLSearchParams({
    gameMode: choice.gameMode,
    difficulty: choice.difficulty,
    period: choice.period,
  });
  if (choice.company && choice.company !== allCompanies) params.set("company", choice.company);
  if (choice.category && choice.category !== allCompanies) params.set("category", choice.category);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return base === "/" ? `/?${query}` : `/leaderboard?${query}`;
}

/** A company id that is on the list. Anything else, including a closed mode, is All companies. */
export function selectedCompany(company: string, companies: readonly { id: string }[]): string {
  return companies.some((item) => item.id === company) ? company : allCompanies;
}

/** A category id that is on the list. Anything else is All categories. */
export function selectedCategory(category: string, categories: readonly { id: string }[]): string {
  return categories.some((item) => item.id === category) ? category : allCompanies;
}

/** Company and Category boards list one row per player with the pool they played. */
export function isPoolBoard(gameMode: string): boolean {
  return gameMode === "company" || gameMode === "class";
}

/** The company or category id the board is narrowed to, or null for all of them. */
export function boardPool(choice: Pick<BoardChoice, "gameMode" | "company" | "category">): string | null {
  if (choice.gameMode === "company" && choice.company !== allCompanies) return choice.company;
  if (choice.gameMode === "class" && choice.category !== allCompanies) return choice.category;
  return null;
}
