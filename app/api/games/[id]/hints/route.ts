import { isUuid } from "@/lib/paths";
import { apiError, apiJson, readJsonBody } from "@/lib/http";
import { buyHint, readPublicGame } from "@/lib/rounds";
import { requireUser } from "@/lib/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;
  if (!isUuid(id)) return apiJson({ error: "not_found" }, 404);
  const body = (await readJsonBody(request)) as { key?: string };
  const failure = await buyHint(id, user.id, body.key ?? "");
  if (failure) return apiError(failure);
  const game = await readPublicGame(id, user.id);
  return apiJson(game);
}
