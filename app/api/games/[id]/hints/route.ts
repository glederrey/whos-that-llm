import { apiError, apiJson } from "@/lib/http";
import { buyHint, readPublicGame } from "@/lib/rounds";
import { currentUser } from "@/lib/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return apiJson({ error: "unauthorized" }, 401);
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { key?: string };
  const failure = await buyHint(id, user.id, body.key ?? "");
  if (failure) return apiError(failure);
  const game = await readPublicGame(id, user.id);
  return apiJson(game);
}
