import { apiError, apiJson } from "@/lib/http";
import { leaderboard } from "@/lib/rounds";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category") || "all";
  const period = url.searchParams.get("period") === "all" ? "all" : "week";
  const result = await leaderboard(category, period);
  if ("error" in result) return apiError(result);
  return apiJson({ period, rows: result.rows });
}
