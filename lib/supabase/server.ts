import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { authCookieOptions, cookiesAreSecure } from "../auth-cookies";
import { publicEnv, secretKey } from "./env";

async function cookieSecure(): Promise<boolean> {
  try {
    const headerList = await headers();
    return cookiesAreSecure(headerList.get("x-forwarded-proto"));
  } catch {
    return cookiesAreSecure(null);
  }
}

export async function createSessionClient() {
  const env = publicEnv();
  if (!env) return null;
  const cookieStore = await cookies();
  const secure = await cookieSecure();
  return createServerClient(env.url, env.key, {
    cookieOptions: authCookieOptions(secure),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, { ...options, ...authCookieOptions(secure) });
          }
        } catch {
          // Server Components cannot always write cookies. The proxy refreshes them.
        }
      },
    },
  });
}

let serviceClient: { key: string; client: SupabaseClient } | null = null;

/**
 * One client per process. It holds no session and no per-request state (persistSession and
 * autoRefreshToken are off), so requests can share it. Keyed on url + secret so a changed env
 * builds a new one.
 */
export function createServiceClient(): SupabaseClient | null {
  const env = publicEnv();
  const secret = secretKey();
  if (!env || !secret) return null;
  const key = `${env.url}\n${secret}`;
  if (serviceClient?.key === key) return serviceClient.client;
  const client = createClient(env.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  serviceClient = { key, client };
  return client;
}
