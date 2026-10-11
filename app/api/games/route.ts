import { parseDifficulty } from "@/lib/difficulty";
import { apiError, apiJson } from "@/lib/http";
import { startAllModels } from "@/lib/rounds";
import { currentUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return apiJson({ error: "unauthorized" }, 401);
  const body = (await request.json().catch(() => ({}))) as {
    category?: string;
    poolKey?: string | null;
    noHint?: boolean;
    difficulty?: string;
  };
  if (body.category !== "all") return apiJson({ error: "not_found" }, 404);
  const difficulty = parseDifficulty(body.difficulty);
  if (!difficulty) return apiJson({ error: "difficulty" }, 422);
  const result = await startAllModels(user.id, Boolean(body.noHint), difficulty);
  if ("error" in result) return apiError(result);
  return apiJson({ gameId: result.gameId });
}
