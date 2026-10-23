import type { Rules } from "./config";
import { difficulties, difficultyFromStored, inDifficultyPool, type Difficulty } from "./difficulty";
import type { FrozenModel, GameStatus, GuessFlags, HintKey, RecordedGuess, ScoreLine, TraitKey, Traits } from "./game";
import { logoPathForPlay, logoPublicUrl } from "./logos";
import { publicEnv } from "./supabase/env";

export type GameRow = {
  id: string;
  user_id: string;
  username: string;
  game_mode: string;
  pool_key: string | null;
  pool_model_ids: string[];
  model_id: string;
  traits: Traits;
  status: GameStatus;
  no_hint: boolean;
  rules: Rules;
  hints: HintKey[];
  difficulty: number | string | null;
  message_count: number;
  awaiting_guess: boolean;
  score: number | null;
  score_breakdown: ScoreLine[] | null;
  score_explanation: string[] | null;
};

export type RpcResult = { ok: boolean; error?: string; gameId?: string; nextAt?: string };

export type ApiFailure = { status: number; error: string; nextAt?: string; paused?: boolean; gameId?: string };

export function fail(status: number, error: string, extra: Partial<ApiFailure> = {}): ApiFailure {
  return { status, error, ...extra };
}

export function fromRpc(result: RpcResult): ApiFailure | null {
  if (result.ok) return null;
  if (result.error === "paused") return fail(503, "paused");
  if (result.error === "not_found") return fail(404, "not_found");
  if (result.error === "username") return fail(422, "username");
  if (result.error === "active_game") return fail(409, "active_game", { gameId: result.gameId });
  if (result.error === "daily_done") return fail(409, "daily_done");
  if (result.error === "hourly_cap") return fail(429, "hourly_cap", { nextAt: result.nextAt });
  if (result.error === "conflict") return fail(409, "conflict");
  if (result.error === "hint") return fail(422, "hint");
  return fail(409, "turn");
}

export type CatalogModel = FrozenModel & { id: string; openrouterId: string; providerSettings: unknown; difficulty: Difficulty };

export const catalogColumns =
  "id, name, company_id, size, released_on, enabled, difficulty, logo_path, openrouter_id, provider_settings, companies(name, origin, logo_path, origins(name, flag, sort_order))";

type CatalogCompany = {
  name: string;
  origin: FrozenModel["origin"];
  logo_path: string;
  origins?: { name: string; flag: string; sort_order: number } | Array<{ name: string; flag: string; sort_order: number }> | null;
};

export function mapCatalog(data: readonly object[]): CatalogModel[] {
  return data.flatMap((row) => {
    const record = row as {
      id: string;
      name: string;
      company_id: string;
      size: FrozenModel["size"];
      released_on: string | null;
      difficulty: unknown;
      logo_path: string | null;
      openrouter_id: string;
      provider_settings: unknown;
      companies: CatalogCompany | CatalogCompany[] | null;
    };
    const difficulty = difficultyFromStored(record.difficulty);
    if (!difficulty || typeof record.released_on !== "string") return [];
    const company = first(record.companies);
    if (!company) return [];
    const origin = first(company.origins ?? null);
    return [{
      id: record.id,
      name: record.name,
      companyId: record.company_id,
      companyName: company.name,
      origin: company.origin,
      ...(origin ? { originName: origin.name, originFlag: origin.flag, originSort: origin.sort_order } : {}),
      size: record.size,
      year: new Date(`${record.released_on}T00:00:00Z`).getUTCFullYear(),
      logoPath: presentLogo(record.logo_path || company.logo_path, record.company_id),
      openrouterId: record.openrouter_id,
      providerSettings: record.provider_settings,
      difficulty,
    }];
  });
}

export function difficultyCounts(models: Array<{ difficulty: Difficulty }>): Record<Difficulty, number> {
  const counts = { easy: 0, medium: 0, hard: 0, impossible: 0 };
  for (const game of difficulties) {
    counts[game] = models.filter((model) => inDifficultyPool(model.difficulty, game)).length;
  }
  return counts;
}

export function first<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value;
}

export function presentLogo(path: string, companyId: string): string {
  const stored = logoPathForPlay(path, companyId);
  const base = publicEnv()?.url;
  if (!base) return stored;
  return logoPublicUrl(base, stored);
}

const keptTraits = new Set<TraitKey>(["company", "origin", "year", "size"]);

export function presentTraits(traits: Traits): Traits {
  const models: Traits["models"] = {};
  for (const [id, model] of Object.entries(traits.models)) {
    models[id] = {
      name: model.name,
      companyId: model.companyId,
      companyName: model.companyName,
      origin: model.origin,
      ...(model.originName ? { originName: model.originName } : {}),
      ...(model.originFlag ? { originFlag: model.originFlag } : {}),
      ...(model.originSort !== undefined ? { originSort: model.originSort } : {}),
      size: model.size,
      year: model.year,
      logoPath: presentLogo(model.logoPath, model.companyId),
    };
  }
  return {
    given: traits.given.filter((key): key is TraitKey => keptTraits.has(key as TraitKey)),
    models,
  };
}

export function recordedGuesses(
  rows: {
    turn?: number;
    guessed_model_id: string | null;
    guessed_origin?: string | null;
    model_correct: boolean;
    company_correct: boolean;
    origin_correct: boolean;
  }[],
): RecordedGuess[] {
  return rows.map((guess) => ({
    turn: guess.turn ?? 0,
    modelId: guess.guessed_model_id,
    origin: guess.guessed_origin || null,
    modelCorrect: Boolean(guess.model_correct),
    companyCorrect: Boolean(guess.company_correct),
    originCorrect: Boolean(guess.origin_correct),
  }));
}

export function sortTranscript(
  rows: { turn: number; role: string; content: string }[],
): { turn: number; role: "user" | "assistant"; content: string }[] {
  return [...rows]
    .sort((a, b) => a.turn - b.turn || (a.role === b.role ? 0 : a.role === "user" ? -1 : 1))
    .map((message) => ({
      turn: message.turn,
      role: message.role as "user" | "assistant",
      content: message.content,
    }));
}

type CorrectnessRow = { model_correct: unknown; company_correct: unknown; origin_correct: unknown };

/** Guess rows with only the three correctness columns, as flags. */
export function guessFlags(rows: CorrectnessRow[]): GuessFlags[] {
  return rows.map((guess) => ({
    modelCorrect: Boolean(guess.model_correct),
    companyCorrect: Boolean(guess.company_correct),
    originCorrect: Boolean(guess.origin_correct),
  }));
}

/** Earlier guesses as the guess check sees them: flags plus the guessed model and origin. */
export function previousGuesses<R>(rows: Array<CorrectnessRow & { guessed_model_id: string | null; guessed_origin: R }>) {
  return rows.map((guess) => ({
    modelId: guess.guessed_model_id,
    origin: guess.guessed_origin,
    modelCorrect: Boolean(guess.model_correct),
    companyCorrect: Boolean(guess.company_correct),
    originCorrect: Boolean(guess.origin_correct),
  }));
}
