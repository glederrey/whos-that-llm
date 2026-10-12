import "server-only";

import { requireOwner } from "./admin-access";
import {
  analyticsTruncated,
  canonicalModel,
  currentDayRange,
  currentUtcDate,
  mergeCurrentDay,
  modelAliases,
  parseActivity,
  parseAnalyticsModels,
  parseKeyUsage,
  summarize,
  type ActivityPeriod,
  type ActivityRow,
  type KeyUsage,
} from "./openrouter-usage";
import { readServerEnv } from "./server-env";

const base = "https://openrouter.ai/api/v1";

export type Section<T> = { ok: true; value: T } | { ok: false; error: string };

export type OpenRouterSpend = {
  totals: Section<KeyUsage>;
  activity: Section<{ week: ActivityPeriod; month: ActivityPeriod }>;
};

export async function loadOpenRouterSpend(now: Date = new Date(), knownModels: readonly string[] = []): Promise<OpenRouterSpend> {
  await requireOwner();
  const [totals, activity] = await Promise.all([loadTotals(), loadActivity(now, knownModels)]);
  return { totals, activity };
}

async function loadTotals(): Promise<Section<KeyUsage>> {
  const key = readServerEnv("OPENROUTER_API_KEY");
  if (!key) return { ok: false, error: "OPENROUTER_API_KEY is not set on the server." };
  const result = await get(`${base}/key`, key);
  if (!result.ok) return result;
  const usage = parseKeyUsage(result.value);
  return usage ? { ok: true, value: usage } : { ok: false, error: "OpenRouter returned key usage in a shape this page does not read." };
}

async function loadActivity(
  now: Date,
  knownModels: readonly string[],
): Promise<Section<{ week: ActivityPeriod; month: ActivityPeriod }>> {
  const key = readServerEnv("OPENROUTER_MANAGEMENT_KEY") ?? readServerEnv("OPENROUTER_API_KEY");
  if (!key) return { ok: false, error: "OPENROUTER_MANAGEMENT_KEY is not set on the server." };
  const result = await get(`${base}/activity`, key);
  if (!result.ok) {
    const forbidden = /^OpenRouter 40[13]/.test(result.error);
    return forbidden
      ? {
          ok: false,
          error: `${result.error} Per-model activity needs an OpenRouter management key. Set OPENROUTER_MANAGEMENT_KEY on the server.`,
        }
      : result;
  }
  const rows = parseActivity(result.value);
  if (!rows) return { ok: false, error: "OpenRouter returned activity in a shape this page does not read." };
  // Activity stops at the last completed UTC day, so a model used only today never appears and the
  // 7- and 30-day totals leave out charges the key's all-time total still includes.
  const today = await loadCurrentDay(now, key);
  if (!today.ok) return today;
  const known = [...new Set([...rows.map((row) => row.model), ...knownModels])];
  const aliases = modelAliases(result.value);
  const merged = mergeCurrentDay(rows, today.value, (slug) => canonicalModel(slug, aliases, known));
  return { ok: true, value: { week: summarize(merged, 7, now), month: summarize(merged, 30, now) } };
}

async function loadCurrentDay(now: Date, key: string): Promise<Section<ActivityRow[]>> {
  const result = await post(`${base}/analytics/query`, key, {
    metrics: ["total_usage", "request_count", "tokens_prompt", "tokens_completion", "tokens_total"],
    dimensions: ["model"],
    granularity: "day",
    time_range: currentDayRange(now),
    limit: 1000,
  });
  if (!result.ok) {
    const forbidden = /^OpenRouter 40[13]/.test(result.error);
    return forbidden
      ? {
          ok: false,
          error: `${result.error} Today's per-model activity needs an OpenRouter management key. Set OPENROUTER_MANAGEMENT_KEY on the server.`,
        }
      : result;
  }
  if (analyticsTruncated(result.value)) return { ok: false, error: "OpenRouter returned a partial activity list for today." };
  const rows = parseAnalyticsModels(result.value, currentUtcDate(now));
  if (!rows) return { ok: false, error: "OpenRouter returned today's activity in a shape this page does not read." };
  const date = currentUtcDate(now);
  return { ok: true, value: rows.filter((row) => row.date === date) };
}

async function get(url: string, key: string): Promise<Section<unknown>> {
  return send(url, key);
}

async function post(url: string, key: string, body: unknown): Promise<Section<unknown>> {
  return send(url, key, JSON.stringify(body));
}

async function send(url: string, key: string, body?: string): Promise<Section<unknown>> {
  const token = key.trim();
  if (!token || token === "[SENSITIVE]") {
    return { ok: false, error: "OpenRouter key is not set on the server." };
  }
  try {
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return { ok: false, error: `OpenRouter ${response.status}${await errorDetail(response)}.` };
    }
    return { ok: true, value: await response.json() };
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
