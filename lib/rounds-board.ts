import type { BoardDifficulty } from "./difficulty";
import { leaderboardWith, readPublicStats } from "./rounds-queries";
import { serviceOrThrow } from "./rounds-db";

export async function leaderboard(
  gameMode: string,
  period: string,
  viewerId?: string | null,
  difficulty?: BoardDifficulty | null,
  companyId?: string | null,
) {
  return leaderboardWith(serviceOrThrow(), gameMode, period, viewerId, difficulty, companyId);
}

export async function landingSnapshot() {
  const client = serviceOrThrow();
  return readPublicStats(client);
}
