import type { GameStatus } from "./game";
import { avatarPublicUrl, profileStats, publicImageCacheControl, readImage, traitFound, type ProfileStats } from "./profile";
import { presentLogo, serviceOrThrow } from "./rounds";
import { publicEnv } from "./supabase/env";

export type HistoryRow = {
  id: string;
  startedAt: string;
  status: GameStatus;
  score: number | null;
  messageCount: number;
  modelName: string | null;
  companyName: string | null;
  logoPath: string | null;
  companyFound: boolean;
  regionFound: boolean;
};

const pageSize = 10;

export function profilePageSize() {
  return pageSize;
}

export async function loadProfileStats(userId: string): Promise<ProfileStats> {
  const client = serviceOrThrow();
  const { data, error } = await client.from("games").select("status, score, message_count").eq("user_id", userId);
  if (error) throw new Error("Could not read profile stats.");
  return profileStats(
    (data ?? []).map((row) => ({
      status: row.status as GameStatus,
      score: row.score as number | null,
      messageCount: Number(row.message_count ?? 0),
    })),
  );
}

type ModelRef = {
  name: string;
  company_id: string;
  logo_path: string | null;
  companies: { name: string; logo_path: string } | { name: string; logo_path: string }[] | null;
};

export async function loadHistory(userId: string, page: number) {
  const client = serviceOrThrow();
  const { count, error: countError } = await client
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countError) throw new Error("Could not read profile history.");
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Number.isFinite(page) && page >= 1 ? Math.min(Math.trunc(page), pageCount) : 1;
  const from = (safePage - 1) * pageSize;
  const { data, error } = await client
    .from("games")
    .select(
      "id, status, score, message_count, started_at, traits, models(name, company_id, logo_path, companies(name, logo_path))",
    )
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error("Could not read profile history.");

  const ids = (data ?? []).map((row) => row.id as string);
  const flags = new Map<string, { company: boolean; region: boolean }>();
  if (ids.length > 0) {
    const { data: guesses, error: guessError } = await client
      .from("guesses")
      .select("game_id, company_correct, region_correct")
      .in("game_id", ids);
    if (guessError) throw new Error("Could not read profile history.");
    for (const guess of guesses ?? []) {
      const key = guess.game_id as string;
      const current = flags.get(key) ?? { company: false, region: false };
      flags.set(key, {
        company: current.company || Boolean(guess.company_correct),
        region: current.region || Boolean(guess.region_correct),
      });
    }
  }

  const rows: HistoryRow[] = (data ?? []).map((row) => {
    const status = row.status as GameStatus;
    const given = Array.isArray((row.traits as { given?: unknown } | null)?.given)
      ? (row.traits as { given: string[] }).given
      : [];
    const seen = flags.get(row.id as string) ?? { company: false, region: false };
    const model = first(row.models as ModelRef | ModelRef[] | null);
    const company = model ? first(model.companies) : null;
    const finished = status !== "active";
    return {
      id: row.id as string,
      startedAt: row.started_at as string,
      status,
      score: row.score as number | null,
      messageCount: Number(row.message_count ?? 0),
      modelName: finished ? (model?.name ?? "Unknown model") : null,
      companyName: finished ? (company?.name ?? null) : null,
      logoPath:
        finished && model ? presentLogo(model.logo_path || company?.logo_path || "", model.company_id) : null,
      companyFound: traitFound({ status, given, companyCorrect: seen.company, regionCorrect: seen.region, trait: "company" }),
      regionFound: traitFound({ status, given, companyCorrect: seen.company, regionCorrect: seen.region, trait: "region" }),
    };
  });
  return { rows, total, page: safePage };
}

export async function saveAvatar(userId: string, bytes: Uint8Array): Promise<{ error: "avatar" } | { path: string }> {
  const image = readImage(bytes);
  if (!image) return { error: "avatar" };
  const client = serviceOrThrow();
  const { data: existing } = await client.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
  const path = `${userId}/${Date.now()}.${image.ext}`;
  const { error } = await client.storage.from("avatars").upload(path, new Blob([bytes as BlobPart], { type: image.mime }), {
    contentType: image.mime,
    cacheControl: publicImageCacheControl,
    upsert: false,
  });
  if (error) return { error: "avatar" };
  const { error: updateError } = await client.from("profiles").update({ avatar_path: path }).eq("id", userId);
  if (updateError) return { error: "avatar" };
  const previous = existing?.avatar_path as string | null;
  if (previous && previous !== path) {
    await client.storage.from("avatars").remove([previous]);
  }
  return { path };
}

export function currentAvatarUrl(path: string | null): string | null {
  const env = publicEnv();
  if (!env) return null;
  return avatarPublicUrl(env.url, path);
}

function first<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value;
}
