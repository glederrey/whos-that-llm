import "server-only";

import { requireOwner } from "./admin-access";
import {
  parseActivity,
  parseKeyUsage,
  summarize,
  type ActivityPeriod,
  type KeyUsage,
} from "./openrouter-usage";

const base = "https://openrouter.ai/api/v1";

export type Section<T> = { ok: true; value: T } | { ok: false; error: string };

export type OpenRouterSpend = {
  totals: Section<KeyUsage>;
  activity: Section<{ week: ActivityPeriod; month: ActivityPeriod }>;
};

export async function loadOpenRouterSpend(now: Date = new Date()): Promise<OpenRouterSpend> {
  await requireOwner();
  const [totals, activity] = await Promise.all([loadTotals(), loadActivity(now)]);
  return { totals, activity };
}

async function loadTotals(): Promise<Section<KeyUsage>> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, error: "OPENROUTER_API_KEY is not set on the server." };
  const result = await get(`${base}/key`, key);
  if (!result.ok) return result;
  const usage = parseKeyUsage(result.value);
  return usage ? { ok: true, value: usage } : { ok: false, error: "OpenRouter returned key usage in a shape this page does not read." };
}

async function loadActivity(now: Date): Promise<Section<{ week: ActivityPeriod; month: ActivityPeriod }>> {
  const key = process.env.OPENROUTER_MANAGEMENT_KEY || process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, error: "OPENROUTER_API_KEY is not set on the server." };
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
  return { ok: true, value: { week: summarize(rows, 7, now), month: summarize(rows, 30, now) } };
}

async function get(url: string, key: string): Promise<Section<unknown>> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", authorization: `Bearer ${key}` },
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
