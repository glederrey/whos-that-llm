import { allCompanies, parseBoardCompany } from "@/lib/company";
import { parseDifficulty } from "@/lib/difficulty";
import { apiError, apiJson } from "@/lib/http";
import { startAllModels, startCompany, startDaily } from "@/lib/rounds";
import { currentUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return apiJson({ error: "unauthorized" }, 401);
  const body = (await request.json().catch(() => ({}))) as {
    gameMode?: string;
    poolKey?: string | null;
    noHint?: boolean;
    difficulty?: string;
    companyId?: string;
  };
  if (body.gameMode === "company") {
    const companyId = parseBoardCompany(body.companyId);
    if (companyId === allCompanies) return apiJson({ error: "company" }, 422);
    const result = await startCompany(user.id, companyId, Boolean(body.noHint));
    if ("error" in result) return apiError(result);
    return apiJson({ gameId: result.gameId });
  }
  if (body.gameMode !== "all" && body.gameMode !== "daily") return apiJson({ error: "not_found" }, 404);
  const difficulty = parseDifficulty(body.difficulty);
  if (!difficulty) return apiJson({ error: "difficulty" }, 422);
  const result = body.gameMode === "daily"
    ? await startDaily(user.id, Boolean(body.noHint), difficulty)
    : await startAllModels(user.id, Boolean(body.noHint), difficulty);
  if ("error" in result) return apiError(result);
  return apiJson({ gameId: result.gameId });
}
