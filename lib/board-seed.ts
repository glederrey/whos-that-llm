import { createHash } from "node:crypto";

/**
 * The leaderboard shows other players an avatar pattern. The seed only picks
 * the pattern, so it is a short hash and never the account id.
 */
export function boardSeed(userId: string, name: string, mine: boolean): string {
  if (!userId) return name;
  if (mine) return userId;
  return createHash("sha256").update(userId).digest("hex").slice(0, 16);
}
