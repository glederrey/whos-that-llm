import { parseCategoryId } from "@/lib/admin-category";
import { allCompanies, parseBoardCompany } from "@/lib/company";
import { parseDifficulty } from "@/lib/difficulty";
import { apiError, apiJson, readJsonBody } from "@/lib/http";
import { startAllModels, startCategory, startCompany, startDaily } from "@/lib/rounds";
import { requireUser } from "@/lib/session";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const body = (await readJsonBody(request)) as {
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
  if (body.gameMode === "class") {
    const categoryId = parseCategoryId(body.poolKey ?? "");
    if (!categoryId) return apiJson({ error: "category" }, 422);
    const result = await startCategory(user.id, categoryId, Boolean(body.noHint));
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
