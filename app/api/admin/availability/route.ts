import { tokenMatches, wantsApply } from "@/lib/api-request";
import { checkAvailability } from "@/lib/availability-check";
import { apiJson } from "@/lib/http";
import { fetchOpenRouterCatalog } from "@/lib/openrouter-catalog";
import { readServerEnv } from "@/lib/server-env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Bot check. A dry run unless the query is exactly `?apply=true`. The token is the only auth. */
export async function POST(request: Request) {
  if (!tokenMatches(request.headers.get("authorization"), readServerEnv("API_TOKEN"))) {
    return new Response(null, { status: 404 });
  }
  const apply = wantsApply(new URL(request.url).searchParams.get("apply"));
  const catalog = await fetchOpenRouterCatalog();
  if (!catalog.ok) return apiJson({ error: catalog.error }, 502);
  const outcome = await checkAvailability(catalog.models, apply, "token");
  if (!outcome.ok) return apiJson({ error: outcome.error }, outcome.status);
  return apiJson({
    applied: outcome.applied,
    checked: outcome.checked,
    newlyUnavailable: outcome.newlyUnavailable,
    backAvailable: outcome.backAvailable,
  });
}
