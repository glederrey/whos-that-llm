import { apiJson } from "@/lib/http";
import { readPublicGame } from "@/lib/rounds";
import { currentUser } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return apiJson({ error: "unauthorized" }, 401);
  const { id } = await context.params;
  const game = await readPublicGame(id, user.id);
  if (!game) return apiJson({ error: "not_found" }, 404);
  return apiJson(game);
}
