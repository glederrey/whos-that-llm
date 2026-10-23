import { isUuid } from "@/lib/paths";
import { apiError, apiJson, readJsonBody } from "@/lib/http";
import { readPublicGame, submitGuess, submitOriginGuess } from "@/lib/rounds";
import { requireUser } from "@/lib/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;
  if (!isUuid(id)) return apiJson({ error: "not_found" }, 404);
  const body = (await readJsonBody(request)) as { modelId?: string; origin?: string };
  if (body.origin) {
    const originFailure = await submitOriginGuess(id, user.id, body.origin);
    if (originFailure) return apiError(originFailure);
    return apiJson(await readPublicGame(id, user.id));
  }
  if (!body.modelId) return apiJson({ error: "conflict" }, 409);
  const failure = await submitGuess(id, user.id, body.modelId);
  if (failure) return apiError(failure);
  const game = await readPublicGame(id, user.id);
  return apiJson(game);
}
