import { apiJson } from "@/lib/http";
import { avatarBodyTooLarge } from "@/lib/profile";
import { saveAvatar } from "@/lib/profile-data";
import { requireUser } from "@/lib/session";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  if (avatarBodyTooLarge(request.headers.get("content-length"))) return apiJson({ error: "avatar" }, 413);
  const form = await request.formData().catch(() => null);
  const file = form?.get("avatar");
  if (!(file instanceof File)) return apiJson({ error: "avatar" }, 422);
  const saved = await saveAvatar(user.id, new Uint8Array(await file.arrayBuffer()));
  if ("error" in saved) return apiJson({ error: "avatar" }, 422);
  return apiJson({ ok: true });
}
