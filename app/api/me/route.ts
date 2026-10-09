import { apiError, apiJson } from "@/lib/http";
import { setUsername } from "@/lib/rounds";
import { currentUser } from "@/lib/session";

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return apiJson({ error: "unauthorized" }, 401);
  const body = (await request.json().catch(() => ({}))) as { username?: string };
  const failure = await setUsername(user.id, body.username ?? "");
  if (failure) return apiError(failure);
  return apiJson({ ok: true });
}
