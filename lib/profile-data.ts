import type { Difficulty } from "./difficulty";
import { regionLabel, sizeLabel, type FrozenModel, type GameStatus, type ScoreLine, type Traits } from "./game";
import { avatarPublicUrl, profileStats, publicImageCacheControl, readImage, traitFound, type ProfileStats } from "./profile";
import { presentLogo, serviceOrThrow } from "./rounds";
import { playedRoundFacts } from "./round-facts";
import { buildShareCard, shareText } from "./share-card";
import { publicEnv } from "./supabase/env";

export type HistoryRow = {
  id: string;
  startedAt: string;
  status: GameStatus;
  score: number | null;
  messageCount: number;
  tokens: number;
  modelName: string | null;
  companyName: string | null;
  logoPath: string | null;
  companyFound: boolean;
  regionFound: boolean;
  mode: string;
  difficulty: Difficulty | null;
  companyPlace: string | null;
  noHint: boolean;
  modelFacts: string[];
  breakdown: ScoreLine[] | null;
  shareText: string | null;
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
  size: FrozenModel["size"] | null;
  released_on: string | null;
  companies: { name: string; region: FrozenModel["region"]; logo_path: string } | { name: string; region: FrozenModel["region"]; logo_path: string }[] | null;
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
  const [{ data, error }, { data: gameModes, error: gameModeError }] = await Promise.all([
    client
      .from("games")
      .select(
        "id, status, score, message_count, started_at, traits, game_mode, pool_key, difficulty, no_hint, model_id, daily_key, score_breakdown, models(name, company_id, logo_path, size, released_on, companies(name, region, logo_path))",
      )
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .range(from, from + pageSize - 1),
    client.from("game_modes").select("id, name"),
  ]);
  if (error || gameModeError) throw new Error("Could not read profile history.");
  const gameModeNames = new Map((gameModes ?? []).map((gameMode) => [gameMode.id as string, gameMode.name as string]));
  const classIds = [
    ...new Set(
      (data ?? [])
        .filter((row) => row.game_mode === "class" && typeof row.pool_key === "string" && row.pool_key.length > 0)
        .map((row) => row.pool_key as string),
    ),
  ];
  const categoryNames = new Map<string, string>();
  if (classIds.length > 0) {
    const { data: categories, error: categoryError } = await client.from("categories").select("id, name").in("id", classIds);
    if (categoryError) throw new Error("Could not read profile history.");
    for (const category of categories ?? []) {
      if (typeof category.name === "string") categoryNames.set(category.id as string, category.name);
    }
  }

  const ids = (data ?? []).map((row) => row.id as string);
  const flags = new Map<string, { company: boolean; region: boolean }>();
  const tokens = new Map<string, number>();
  if (ids.length > 0) {
    const { data: usage, error: usageError } = await client
      .from("usage")
      .select("game_id, input_tokens, output_tokens")
      .in("game_id", ids)
      .is("error_code", null);
    if (usageError) throw new Error("Could not read profile history.");
    for (const entry of usage ?? []) {
      const key = entry.game_id as string;
      tokens.set(key, (tokens.get(key) ?? 0) + Number(entry.input_tokens ?? 0) + Number(entry.output_tokens ?? 0));
    }

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
    const frozen = playedModel(row.traits, typeof row.model_id === "string" ? row.model_id : "");
    const breakdown = asBreakdown(row.score_breakdown);
    const traits = asTraits(row.traits);
    const card = finished
      ? buildShareCard({
          id: row.id as string,
          gameMode: row.game_mode as string,
          poolKey: typeof row.pool_key === "string" ? row.pool_key : null,
          difficulty: row.difficulty,
          status,
          messageCount: Number(row.message_count ?? 0),
          score: row.score as number | null,
          breakdown,
          modelId: typeof row.model_id === "string" ? row.model_id : "",
          traits: traits ?? { given: [], models: {} },
          categoryName: typeof row.pool_key === "string" ? (categoryNames.get(row.pool_key) ?? null) : null,
          dailyKey: typeof row.daily_key === "string" ? row.daily_key : null,
        })
      : null;
    const facts = playedRoundFacts({
      gameModeId: row.game_mode as string,
      gameModeName: gameModeNames.get(row.game_mode as string),
      difficulty: row.difficulty,
    });
    return {
      id: row.id as string,
      startedAt: row.started_at as string,
      status,
      score: row.score as number | null,
      messageCount: Number(row.message_count ?? 0),
      tokens: tokens.get(row.id as string) ?? 0,
      modelName: finished ? (frozen?.name ?? model?.name ?? "Unknown model") : null,
      companyName: finished ? (frozen?.companyName ?? company?.name ?? null) : null,
      logoPath: finished
        ? presentLogo(
            frozen?.logoPath || model?.logo_path || company?.logo_path || "",
            frozen?.companyId || model?.company_id || "",
          )
        : null,
      modelFacts: finished
        ? modelFacts(frozen, company?.name ?? null, company?.region ?? null, model?.size ?? null, model?.released_on ?? null)
        : [],
      breakdown: finished ? breakdown : null,
      shareText: card ? shareText(card) : null,
      companyFound: traitFound({ status, given, companyCorrect: seen.company, regionCorrect: seen.region, trait: "company" }),
      regionFound: traitFound({ status, given, companyCorrect: seen.company, regionCorrect: seen.region, trait: "region" }),
      mode: facts.mode,
      difficulty: facts.difficulty,
      companyPlace: row.game_mode === "company" ? (frozen?.companyName ?? company?.name ?? null) : null,
      noHint: Boolean(row.no_hint),
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

function playedModel(traits: unknown, modelId: string): FrozenModel | null {
  if (!modelId || !traits || typeof traits !== "object") return null;
  const model = (traits as Traits).models?.[modelId];
  if (!model || typeof model.name !== "string" || model.name.trim().length === 0) return null;
  return model;
}

function asTraits(value: unknown): Traits | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { given?: unknown; models?: unknown };
  if (!Array.isArray(record.given) || !record.models || typeof record.models !== "object") return null;
  return record as Traits;
}

function asBreakdown(value: unknown): ScoreLine[] | null {
  if (!Array.isArray(value)) return null;
  const lines: ScoreLine[] = [];
  for (const line of value) {
    if (!line || typeof line !== "object") continue;
    const label = (line as { label?: unknown }).label;
    if (typeof label !== "string") continue;
    const points = (line as { points?: unknown }).points;
    const multiplier = (line as { multiplier?: unknown }).multiplier;
    lines.push({
      label,
      points: typeof points === "number" ? points : null,
      multiplier: typeof multiplier === "string" ? multiplier : undefined,
    });
  }
  return lines;
}

function modelFacts(
  frozen: FrozenModel | null,
  companyName: string | null,
  region: FrozenModel["region"] | null,
  size: FrozenModel["size"] | null,
  releasedOn: string | null,
): string[] {
  if (frozen) {
    return [frozen.companyName, regionLabel(frozen.region), String(frozen.year), sizeLabel(frozen.size)].filter(
      (fact) => fact.trim().length > 0,
    );
  }
  const year = releasedOn ? new Date(`${releasedOn}T00:00:00Z`).getUTCFullYear() : null;
  return [companyName ?? "", region ? regionLabel(region) : "", year ? String(year) : "", size ? sizeLabel(size) : ""].filter(
    (fact) => fact.trim().length > 0,
  );
}

function first<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value;
}
