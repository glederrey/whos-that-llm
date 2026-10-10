import type { GameStatus } from "./game";
import { avatarPublicUrl, profileStats, readImage, traitFound, type ProfileStats } from "./profile";
import { serviceOrThrow } from "./rounds";
import { publicEnv } from "./supabase/env";

export type HistoryRow = {
  id: string;
  startedAt: string;
  status: GameStatus;
  score: number | null;
  messageCount: number;
  modelName: string | null;
};

export type GameSummary = HistoryRow & {
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

export async function loadHistory(userId: string, page: number, selectedId: string | null) {
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
    .select("id, status, score, message_count, started_at, models(name)")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error("Could not read profile history.");
  const rows: HistoryRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    startedAt: row.started_at as string,
    status: row.status as GameStatus,
    score: row.score as number | null,
    messageCount: Number(row.message_count ?? 0),
    modelName: row.status === "active" ? null : modelName(row.models),
  }));
  const summary = selectedId ? await loadSummary(userId, selectedId) : null;
  return { rows, total, page: safePage, summary };
}

async function loadSummary(userId: string, gameId: string): Promise<GameSummary | null> {
  const client = serviceOrThrow();
  const { data, error } = await client
    .from("games")
    .select("id, status, score, message_count, started_at, traits, models(name)")
    .eq("user_id", userId)
    .eq("id", gameId)
    .maybeSingle();
  if (error || !data) return null;
  const { data: guesses } = await client
    .from("guesses")
    .select("company_correct, region_correct")
    .eq("game_id", gameId);
  const companyCorrect = (guesses ?? []).some((guess) => Boolean(guess.company_correct));
  const regionCorrect = (guesses ?? []).some((guess) => Boolean(guess.region_correct));
  const given = Array.isArray((data.traits as { given?: unknown } | null)?.given)
    ? ((data.traits as { given: string[] }).given)
    : [];
  const status = data.status as GameStatus;
  return {
    id: data.id as string,
    startedAt: data.started_at as string,
    status,
    score: data.score as number | null,
    messageCount: Number(data.message_count ?? 0),
    modelName: status === "active" ? null : modelName(data.models),
    companyFound: traitFound({ status, given, companyCorrect, regionCorrect, trait: "company" }),
    regionFound: traitFound({ status, given, companyCorrect, regionCorrect, trait: "region" }),
  };
}

export async function saveAvatar(userId: string, bytes: Uint8Array): Promise<{ error: "avatar" } | { path: string }> {
  const image = readImage(bytes);
  if (!image) return { error: "avatar" };
  const client = serviceOrThrow();
  const { data: existing } = await client.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
  const path = `${userId}/${Date.now()}.${image.ext}`;
  const { error } = await client.storage.from("avatars").upload(path, new Blob([bytes as BlobPart], { type: image.mime }), {
    contentType: image.mime,
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

function modelName(models: { name: string } | { name: string }[] | null): string {
  if (!models) return "Unknown model";
  if (Array.isArray(models)) return models[0]?.name ?? "Unknown model";
  return models.name;
}
