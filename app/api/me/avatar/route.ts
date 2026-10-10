import { apiJson } from "@/lib/http";
import { saveAvatar } from "@/lib/profile-data";
import { currentUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return apiJson({ error: "unauthorized" }, 401);
  const form = await request.formData().catch(() => null);
  const file = form?.get("avatar");
  if (!(file instanceof File)) return apiJson({ error: "avatar" }, 422);
  const saved = await saveAvatar(user.id, new Uint8Array(await file.arrayBuffer()));
  if ("error" in saved) return apiJson({ error: "avatar" }, 422);
  return apiJson({ ok: true });
}
