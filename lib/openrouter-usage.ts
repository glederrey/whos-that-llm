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

export function currentUtcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Start of the current UTC day through `now`. Analytics requires seconds on both ends. */
export function currentDayRange(now: Date): { start: string; end: string } {
  const startMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const endMs = Math.max(now.getTime(), startMs + 1000);
  return { start: stamp(startMs), end: stamp(endMs) };
}

function stamp(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function modelAliases(payload: unknown): Record<string, string> {
  const data = (payload as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return {};
  const aliases: Record<string, string> = {};
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (typeof record.model !== "string" || typeof record.model_permaslug !== "string") continue;
    if (record.model_permaslug && record.model_permaslug !== record.model) aliases[record.model_permaslug] = record.model;
  }
  return aliases;
}

/**
 * Map an activity slug onto a roster OpenRouter id.
 * Activity uses the short slug (`deepseek/deepseek-v4-pro`). The roster stores one dated snapshot
 * (`deepseek/deepseek-v4-pro-0813`). A longer different name, such as luna-pro beside luna, stays as it is.
 */
export function canonicalModel(slug: string, aliases: Record<string, string>, known: readonly string[]): string {
  const aliased = aliases[slug] ?? slug;
  return matchKnown(aliased, known) ?? matchKnown(slug, known) ?? aliased;
}

function matchKnown(slug: string, known: readonly string[]): string | null {
  let best: string | null = null;
  for (const id of known) {
    if (!id || !versionOf(slug, id)) continue;
    if (!best || id.length > best.length) best = id;
  }
  if (best) return best;
  const snapshots = known.filter((id) => id.startsWith(`${slug}-`) && isSnapshot(id.slice(slug.length + 1)));
  return snapshots.length === 1 ? snapshots[0] : null;
}

function isSnapshot(suffix: string): boolean {
  return /^\d{4}$/.test(suffix) || /^\d{8}$/.test(suffix) || /^\d{4}-\d{2}-\d{2}$/.test(suffix);
}

function versionOf(slug: string, id: string): boolean {
  if (slug === id) return true;
  if (!slug.startsWith(`${id}-`)) return false;
  const suffix = slug.slice(id.length + 1);
  return /^\d{4}-\d{2}-\d{2}(?:$|:|-)/.test(suffix) || /^\d{8}(?:$|:|-)/.test(suffix);
}

export function analyticsTruncated(payload: unknown): boolean {
  const outer = (payload as { data?: { metadata?: { truncated?: unknown } } } | null)?.data;
  return outer?.metadata?.truncated === true;
}

export function parseAnalyticsModels(payload: unknown, fallbackDate: string): ActivityRow[] | null {
  const outer = (payload as { data?: unknown } | null)?.data;
  if (!outer || typeof outer !== "object" || Array.isArray(outer)) return null;
  const data = (outer as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  const rows: ActivityRow[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (typeof record.model !== "string" || !record.model) continue;
    const prompt = num(record.tokens_prompt);
    const completion = num(record.tokens_completion);
    const total = num(record.tokens_total);
    const split = prompt + completion > 0;
    const dated = typeof record.date__day === "string" && record.date__day ? record.date__day.slice(0, 10) : fallbackDate;
    rows.push({
      date: dated,
      model: record.model,
      requests: num(record.request_count),
      promptTokens: split ? prompt : total,
      completionTokens: split ? completion : 0,
      reasoningTokens: 0,
      usd: num(record.total_usage),
    });
  }
  return rows;
}

export function mergeCurrentDay(completed: ActivityRow[], current: ActivityRow[], canonical: (slug: string) => string): ActivityRow[] {
  const done = completed.map((row) => ({ ...row, model: canonical(row.model) }));
  const seen = new Set(done.map((row) => `${row.date}\0${row.model}`));
  const extra = new Map<string, ActivityRow>();
  for (const row of current) {
    const model = canonical(row.model);
    const key = `${row.date}\0${model}`;
    if (seen.has(key)) continue;
    const existing = extra.get(key);
    if (!existing) {
      extra.set(key, { ...row, model });
      continue;
    }
    existing.requests += row.requests;
    existing.promptTokens += row.promptTokens;
    existing.completionTokens += row.completionTokens;
    existing.reasoningTokens += row.reasoningTokens;
    existing.usd += row.usd;
  }
  return [...done, ...extra.values()];
}
