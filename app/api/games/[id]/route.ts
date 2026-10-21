import { apiJson } from "@/lib/http";
import { readPublicGame } from "@/lib/rounds";
import { requireUser } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;
  const game = await readPublicGame(id, user.id);
  if (!game) return apiJson({ error: "not_found" }, 404);
  return apiJson(game);
}
