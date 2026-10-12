import { siteOrigin } from "./site";

const allowedOrigins = new Set([siteOrigin, "http://localhost:3000", "http://127.0.0.1:3000"]);

export function authCookieOptions(secure: boolean) {
  return {
    httpOnly: true as const,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };
}

export function cookiesAreSecure(protocol: string | null | undefined, production = process.env.NODE_ENV === "production"): boolean {
  const value = (protocol ?? "").split(",")[0]?.trim().replace(/:$/, "") ?? "";
  if (value === "https") return true;
  if (value === "http") return false;
  return production;
}

export function authRedirectOrigin(protocol: string | null, host: string | null): string {
  const proto = (protocol ?? "https").split(",")[0]?.trim() || "https";
  const name = (host ?? "").split(",")[0]?.trim() ?? "";
  const origin = `${proto}://${name}`;
  return allowedOrigins.has(origin) ? origin : siteOrigin;
}

export function allowedAuthUrl(value: string, supabaseUrl: string): boolean {
  try {
    const url = new URL(value);
    const base = new URL(supabaseUrl);
    if (url.origin !== base.origin || url.pathname !== "/auth/v1/authorize") return false;
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}
