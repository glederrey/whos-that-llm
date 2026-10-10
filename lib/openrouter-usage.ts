export type KeyUsage = {
  allTime: number;
  today: number;
  week: number;
  month: number;
  limit: number | null;
  limitRemaining: number | null;
};

export type ModelActivity = {
  model: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  usd: number;
};

export type ActivityPeriod = {
  days: number;
  models: ModelActivity[];
  requests: number;
  promptTokens: number;
  completionTokens: number;
  usd: number;
};

export type ActivityRow = {
  date: string;
  model: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  usd: number;
};

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseKeyUsage(payload: unknown): KeyUsage | null {
  const data = (payload as { data?: unknown } | null)?.data;
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.usage !== "number" && typeof record.usage !== "string") return null;
  return {
    allTime: num(record.usage),
    today: num(record.usage_daily),
    week: num(record.usage_weekly),
    month: num(record.usage_monthly),
    limit: nullableNum(record.limit),
    limitRemaining: nullableNum(record.limit_remaining),
  };
}

export function parseActivity(payload: unknown): ActivityRow[] | null {
  const data = (payload as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return null;
  const rows: ActivityRow[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (typeof record.model !== "string" || typeof record.date !== "string") continue;
    rows.push({
      date: record.date.slice(0, 10),
      model: record.model,
      requests: num(record.requests),
      promptTokens: num(record.prompt_tokens),
      completionTokens: num(record.completion_tokens),
      reasoningTokens: num(record.reasoning_tokens),
      usd: num(record.usage) + num(record.byok_usage_inference),
    });
  }
  return rows;
}

export function isoDaysBefore(now: Date, days: number): string {
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(base - days * 86_400_000).toISOString().slice(0, 10);
}

export function summarize(rows: ActivityRow[], days: number, now: Date): ActivityPeriod {
  const first = isoDaysBefore(now, days);
  const byModel = new Map<string, ModelActivity>();
  for (const row of rows) {
    if (row.date < first) continue;
    const entry =
      byModel.get(row.model) ??
      { model: row.model, requests: 0, promptTokens: 0, completionTokens: 0, reasoningTokens: 0, usd: 0 };
    entry.requests += row.requests;
    entry.promptTokens += row.promptTokens;
    entry.completionTokens += row.completionTokens;
    entry.reasoningTokens += row.reasoningTokens;
    entry.usd += row.usd;
    byModel.set(row.model, entry);
  }
  const models = [...byModel.values()].sort((a, b) => b.usd - a.usd || b.requests - a.requests || a.model.localeCompare(b.model));
  return {
    days,
    models,
    requests: models.reduce((sum, row) => sum + row.requests, 0),
    promptTokens: models.reduce((sum, row) => sum + row.promptTokens, 0),
    completionTokens: models.reduce((sum, row) => sum + row.completionTokens, 0),
    usd: models.reduce((sum, row) => sum + row.usd, 0),
  };
}
