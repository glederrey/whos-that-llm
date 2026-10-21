import { apiError, apiJson, readJsonBody } from "@/lib/http";
import { setUsername } from "@/lib/rounds";
import { requireUser } from "@/lib/session";

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const body = (await readJsonBody(request)) as { username?: string };
  const failure = await setUsername(user.id, body.username ?? "");
  if (failure) return apiError(failure);
  return apiJson({ ok: true });
}
