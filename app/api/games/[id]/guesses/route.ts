import { apiError, apiJson } from "@/lib/http";
import { readPublicGame, submitGuess } from "@/lib/rounds";
import { currentUser } from "@/lib/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return apiJson({ error: "unauthorized" }, 401);
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { modelId?: string };
  if (!body.modelId) return apiJson({ error: "conflict" }, 409);
  const failure = await submitGuess(id, user.id, body.modelId);
  if (failure) return apiError(failure);
  const game = await readPublicGame(id, user.id);
  return apiJson(game);
}
