import { parseBoardDifficulty } from "@/lib/difficulty";
import { apiError, apiJson } from "@/lib/http";
import { leaderboard } from "@/lib/rounds";
import { currentUser } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category") || "all";
  const period = url.searchParams.get("period") === "all" ? "all" : "week";
  const difficulty = category === "all" ? parseBoardDifficulty(url.searchParams.get("difficulty")) : null;
  const user = await currentUser();
  const result = await leaderboard(category, period, user?.id, difficulty);
  if ("error" in result) return apiError(result);
  return apiJson({ period, difficulty, rows: result.rows });
}
