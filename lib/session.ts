import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { apiJson } from "./http";
import { currentAvatarUrl } from "./profile-data";
import { createSessionClient } from "./supabase/server";

/**
 * The signed-in user as far as the verified JWT claims tell. `getClaims()` checks the signature
 * locally (asymmetric signing keys, cached JWKS), so it costs no round trip to Supabase Auth.
 * `identities` is rebuilt from `app_metadata.providers`, which is enough for `hasPasswordLogin`.
 */
export type SessionUser = {
  id: string;
  email: string | undefined;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  identities: { provider: string }[];
};

export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSessionClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const appMetadata = (claims.app_metadata ?? {}) as Record<string, unknown>;
  const providers = Array.isArray(appMetadata.providers) ? (appMetadata.providers as unknown[]) : [];
  return {
    id: claims.sub,
    email: claims.email,
    app_metadata: appMetadata,
    user_metadata: (claims.user_metadata ?? {}) as Record<string, unknown>,
    identities: providers.filter((p): p is string => typeof p === "string").map((provider) => ({ provider })),
  };
});

/**
 * The user as Supabase Auth says right now: one round trip. For checks where a stale token must
 * not count, such as the admin flag. A revoked admin keeps a valid JWT until it expires.
 */
export const strictUser = cache(async (): Promise<User | null> => {
  const supabase = await createSessionClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function requireUser() {
  const user = await currentUser();
  if (!user) return { response: apiJson({ error: "unauthorized" }, 401) };
  return { user };
}

export const currentProfile = cache(async () => {
  const user = await currentUser();
  const supabase = await createSessionClient();
  if (!user || !supabase) return { user: null, username: null as string | null, avatarUrl: null as string | null };
  const { data } = await supabase
    .from("profiles")
    .select("username, avatar_path")
    .eq("id", user.id)
    .maybeSingle();
  return {
    user,
    username: (data?.username as string | null) ?? null,
    avatarUrl: currentAvatarUrl((data?.avatar_path as string | null) ?? null),
  };
});
