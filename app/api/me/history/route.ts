import { apiJson } from "@/lib/http";
import { loadHistory, profilePageSize } from "@/lib/profile-data";
import { historyItem } from "@/lib/profile-history";
import { parseHistoryFilter } from "@/lib/profile-filter";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The signed-in player's Games list for one filter and one page. The cup goes to the best solved round of that filter. */
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const requested = Number(params.page);
  const history = await loadHistory(auth.user.id, Number.isFinite(requested) ? requested : 1, parseHistoryFilter(params));
  return apiJson({
    items: history.rows.map((row) => historyItem(row, history.best)),
    total: history.total,
    page: history.page,
    pageCount: Math.max(1, Math.ceil(history.total / profilePageSize())),
  });
}
