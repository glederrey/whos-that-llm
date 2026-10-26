import "server-only";
import { staleCutoff } from "./expire-games";
import { giveUp } from "./rounds-play";
import { serviceOrThrow } from "./rounds-db";

const batchSize = 100;

/** Gives up every round still open a week after it started. A dry run only counts them. */
export async function expireOpenGames(apply: boolean, now = new Date()) {
  const client = serviceOrThrow();
  const { data, error } = await client
    .from("games")
    .select("id, user_id")
    .eq("status", "active")
    .not("user_id", "is", null)
    .lt("started_at", staleCutoff(now).toISOString())
    .order("started_at", { ascending: true })
    .limit(batchSize);
  if (error) throw new Error(error.message);
  const stale = data ?? [];
  let closed = 0;
  let failed = 0;
  if (apply) {
    for (const game of stale) {
      try {
        const failure = await giveUp(game.id as string, game.user_id as string);
        if (failure) failed += 1;
        else closed += 1;
      } catch {
        failed += 1;
      }
    }
  }
  return { applied: apply, found: stale.length, closed, failed };
}
