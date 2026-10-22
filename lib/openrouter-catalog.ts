import "server-only";

import { requireOwner } from "./admin-access";
import { mergeCatalogPages, nextModelsUrl, parseCatalogPage, type CatalogModel, type CatalogPage } from "./roster-sync";
import { readServerEnv } from "./server-env";

const firstPage = "https://openrouter.ai/api/v1/models";

type CatalogResult = { ok: true; models: CatalogModel[] } | { ok: false; error: string };

export async function loadOpenRouterCatalog(): Promise<CatalogResult> {
  await requireOwner();
  return fetchOpenRouterCatalog();
}

/** No owner check. The caller has already authorized the request. */
export async function fetchOpenRouterCatalog(): Promise<CatalogResult> {
  const key = readServerEnv("OPENROUTER_API_KEY");
  if (!key) return { ok: false, error: "OPENROUTER_API_KEY is not set on the server." };
  try {
    const pages: CatalogPage[] = [];
    const seen = new Set<string>();
    let pageUrl: string | null = firstPage;
    for (let page = 0; page < 20 && pageUrl; page += 1) {
      if (seen.has(pageUrl)) return { ok: false, error: "OpenRouter returned a partial model list." };
      seen.add(pageUrl);
      const response = await fetch(pageUrl, {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${key}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) return { ok: false, error: `OpenRouter ${response.status}${await errorDetail(response)}.` };
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return { ok: false, error: "OpenRouter returned models in a shape this page does not read." };
      }
      const parsed = parseCatalogPage(body);
      if (!parsed) return { ok: false, error: "OpenRouter returned models in a shape this page does not read." };
      pages.push(parsed);
      if (!parsed.next) {
        pageUrl = null;
        break;
      }
      const next = nextModelsUrl(parsed.next);
      if (!next) return { ok: false, error: "OpenRouter returned models in a shape this page does not read." };
      pageUrl = next;
    }
    if (pageUrl) return { ok: false, error: "OpenRouter returned a partial model list." };
    const models = mergeCatalogPages(pages);
    if (!models) {
      const any = pages.some((page) => page.models.length > 0);
      return {
        ok: false,
        error: any ? "OpenRouter returned a partial model list." : "OpenRouter returned models in a shape this page does not read.",
      };
    }
    return { ok: true, models };
  } catch {
    return { ok: false, error: "OpenRouter could not be reached." };
  }
}

async function errorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    const message = body.error?.message;
    return typeof message === "string" && message ? `: ${message.slice(0, 160)}` : "";
  } catch {
    return "";
  }
}
