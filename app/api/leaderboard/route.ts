import { apiError, apiJson } from "@/lib/http";
import { boardChoice, boardModes } from "@/lib/board-query";
import { leaderboard, listGameModes } from "@/lib/rounds";
import { currentUser } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const gameModes = await listGameModes();
  const choice = boardChoice(
    {
      gameMode: url.searchParams.get("gameMode") ?? undefined,
      period: url.searchParams.get("period") ?? undefined,
      difficulty: url.searchParams.get("difficulty") ?? undefined,
    },
    boardModes(gameModes),
  );
  const user = await currentUser();
  const result = await leaderboard(choice.gameMode, choice.period, user?.id, choice.difficulty);
  if ("error" in result) return apiError(result);
  return apiJson({ ...choice, rows: result.rows });
}
