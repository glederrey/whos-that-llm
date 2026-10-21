import { isUuid } from "@/lib/paths";
import { apiError, apiJson } from "@/lib/http";
import { giveUp, readPublicGame } from "@/lib/rounds";
import { currentUser } from "@/lib/session";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return apiJson({ error: "unauthorized" }, 401);
  const { id } = await context.params;
  if (!isUuid(id)) return apiJson({ error: "not_found" }, 404);
  const failure = await giveUp(id, user.id);
  if (failure) return apiError(failure);
  const game = await readPublicGame(id, user.id);
  return apiJson(game);
}
