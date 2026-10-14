import "server-only";

import { requireOwner } from "./admin-access";
import { createServiceClient } from "./supabase/server";
import { validProviderSlug } from "./provider-check";

export type ProviderBook = {
  trusted: Set<string>;
  ignored: string[];
};

export type ProviderRecord = {
  slug: string;
  blacklisted: boolean;
  reason: string | null;
  model: string | null;
  inputText: string | null;
  outputText: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  cachedTokens: number | null;
  gptTokens: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ProviderVerdict = {
  slug: string;
  blacklisted: boolean;
  reason: string | null;
  model: string;
  inputText: string;
  outputText: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  gptTokens: number;
};

function clientOrThrow() {
  const client = createServiceClient();
  if (!client) throw new Error("Supabase server env is missing.");
  return client;
}

export async function loadProviderBook(): Promise<ProviderBook> {
  const client = clientOrThrow();
  const { data, error } = await client.from("openrouter_providers").select("slug, blacklisted");
  if (error) throw new Error(error.message);
  const trusted = new Set<string>();
  const ignored: string[] = [];
  for (const row of data ?? []) {
    const slug = typeof row.slug === "string" ? row.slug.trim() : "";
    if (!slug) continue;
    if (row.blacklisted) ignored.push(slug);
    else trusted.add(slug);
  }
  return { trusted, ignored };
}

export async function saveProviderVerdict(verdict: ProviderVerdict): Promise<void> {
  const slug = verdict.slug.trim();
  if (!validProviderSlug(slug)) return;
  const client = clientOrThrow();
  const { error } = await client.from("openrouter_providers").upsert(
    {
      slug,
      blacklisted: verdict.blacklisted,
      reason: verdict.reason,
      model: verdict.model,
      input_text: verdict.inputText,
      output_text: verdict.outputText,
      input_tokens: verdict.inputTokens,
      output_tokens: verdict.outputTokens,
      reasoning_tokens: verdict.reasoningTokens,
      cached_tokens: verdict.cachedTokens,
      gpt_tokens: verdict.gptTokens,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slug" },
  );
  if (error) throw new Error(error.message);
}

export async function loadProviderRecords(): Promise<ProviderRecord[]> {
  await requireOwner();
  const client = clientOrThrow();
  const { data, error } = await client
    .from("openrouter_providers")
    .select(
      "slug, blacklisted, reason, model, input_text, output_text, input_tokens, output_tokens, reasoning_tokens, cached_tokens, gpt_tokens, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    slug: row.slug as string,
    blacklisted: Boolean(row.blacklisted),
    reason: (row.reason as string | null) ?? null,
    model: (row.model as string | null) ?? null,
    inputText: (row.input_text as string | null) ?? null,
    outputText: (row.output_text as string | null) ?? null,
    inputTokens: numberOrNull(row.input_tokens),
    outputTokens: numberOrNull(row.output_tokens),
    reasoningTokens: numberOrNull(row.reasoning_tokens),
    cachedTokens: numberOrNull(row.cached_tokens),
    gptTokens: numberOrNull(row.gpt_tokens),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

export async function clearProviderBlacklist(slug: string): Promise<boolean> {
  await requireOwner();
  const clean = slug.trim();
  if (!validProviderSlug(clean)) return false;
  const client = clientOrThrow();
  const { error } = await client
    .from("openrouter_providers")
    .update({ blacklisted: false, updated_at: new Date().toISOString() })
    .eq("slug", clean)
    .eq("blacklisted", true);
  return !error;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}
