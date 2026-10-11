import { apiError, apiJson } from "@/lib/http";
import { boardChoice, boardModes } from "@/lib/board-query";
import { leaderboard, listCategories } from "@/lib/rounds";
import { currentUser } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const categories = await listCategories();
  const choice = boardChoice(
    {
      category: url.searchParams.get("category") ?? undefined,
      period: url.searchParams.get("period") ?? undefined,
      difficulty: url.searchParams.get("difficulty") ?? undefined,
    },
    boardModes(categories),
  );
  const user = await currentUser();
  const result = await leaderboard(choice.category, choice.period, user?.id, choice.difficulty);
  if ("error" in result) return apiError(result);
  return apiJson({ ...choice, rows: result.rows });
}
