import { tokenMatches, wantsApply } from "@/lib/api-request";
import { expireOpenGames } from "@/lib/expire-games-run";
import { apiJson } from "@/lib/http";
import { readServerEnv } from "@/lib/server-env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Bot call. A dry run unless the query is exactly `?apply=true`. The token is the only auth. */
export async function POST(request: Request) {
  if (!tokenMatches(request.headers.get("authorization"), readServerEnv("API_TOKEN"))) {
    return new Response(null, { status: 404 });
  }
  const apply = wantsApply(new URL(request.url).searchParams.get("apply"));
  try {
    return apiJson(await expireOpenGames(apply));
  } catch {
    return apiJson({ error: "database" }, 500);
  }
}
