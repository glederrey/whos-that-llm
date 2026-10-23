import type { Difficulty } from "./difficulty";
import type { GameStatus, OriginView, ScoreLine } from "./game";
import type { HistoryRow } from "./profile-data";
import { isBestSolved } from "./profile-filter";
import type { RoundPlace } from "./round-facts";

/** One row of the Games list, formatted for the screen. */
export type HistoryItem = {
  id: string;
  when: string;
  status: string;
  state: "active" | "solved" | "miss" | "given_up";
  score: string;
  best: boolean;
  messages: number;
  tokens: string;
  modelName: string | null;
  companyName: string | null;
  logoPath: string | null;
  companyFound: boolean;
  originFound: boolean;
  origin?: OriginView | null;
  mode: string;
  difficulty: Difficulty | null;
  /** False for modes with no difficulty (Origin, Custom): the row and the line are left out. */
  hasDifficulty: boolean;
  /** Company and category rounds put this name where a difficulty chip would be. */
  place?: RoundPlace | null;
  /** Models in the round's pool. Null hides the row. */
  poolSize?: number | null;
  noHint: boolean;
  /** The stored score. The closed row uses the formatted `score` string. */
  scoreValue: number | null;
  modelFacts: string[];
  breakdown: ScoreLine[] | null;
  shareText: string | null;
};

export function formatWhen(iso: string) {
  const formatted = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
  return `${formatted} UTC`;
}

export function statusLabel(status: GameStatus) {
  if (status === "solved") return "Solved";
  if (status === "miss") return "Failed";
  if (status === "given_up") return "Given up";
  return "In progress";
}

/** `best` is the best solved score among the rounds the current filter keeps. */
export function historyItem(row: HistoryRow, best: number | null): HistoryItem {
  return {
    id: row.id,
    when: formatWhen(row.startedAt),
    status: statusLabel(row.status),
    state: row.status,
    score: row.score === null ? "—" : row.score.toLocaleString("en-US"),
    best: isBestSolved(row, best),
    messages: row.messageCount,
    tokens: row.tokens.toLocaleString("en-US"),
    modelName: row.modelName,
    companyName: row.companyName,
    logoPath: row.logoPath,
    companyFound: row.companyFound,
    originFound: row.originFound,
    origin: row.origin,
    mode: row.mode,
    difficulty: row.difficulty,
    hasDifficulty: row.hasDifficulty,
    place: row.place,
    poolSize: row.poolSize,
    noHint: row.noHint,
    scoreValue: row.score,
    modelFacts: row.modelFacts,
    breakdown: row.breakdown,
    shareText: row.shareText,
  };
}
