import { apiError, apiJson, readJsonBody } from "@/lib/http";
import { readPublicGame, submitGuess } from "@/lib/rounds";
import { requireUser } from "@/lib/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;
  const body = (await readJsonBody(request)) as { modelId?: string };
  if (!body.modelId) return apiJson({ error: "conflict" }, 409);
  const failure = await submitGuess(id, user.id, body.modelId);
  if (failure) return apiError(failure);
  const game = await readPublicGame(id, user.id);
  return apiJson(game);
}
