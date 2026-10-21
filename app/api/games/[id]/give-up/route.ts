import { apiError, apiJson } from "@/lib/http";
import { giveUp, readPublicGame } from "@/lib/rounds";
import { requireUser } from "@/lib/session";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;
  const failure = await giveUp(id, user.id);
  if (failure) return apiError(failure);
  const game = await readPublicGame(id, user.id);
  return apiJson(game);
}
