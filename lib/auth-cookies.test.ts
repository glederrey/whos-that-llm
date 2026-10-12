import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { allowedAuthUrl, authCookieOptions, authRedirectOrigin, cookiesAreSecure } from "./auth-cookies";

const root = path.resolve(import.meta.dirname, "..");

test("session cookies are httpOnly, secure on https, and SameSite lax", () => {
  const secure = authCookieOptions(true);
  assert.equal(secure.httpOnly, true);
  assert.equal(secure.secure, true);
  assert.equal(secure.sameSite, "lax");
  assert.equal(secure.path, "/");
  assert.equal(authCookieOptions(false).secure, false);
  assert.equal(cookiesAreSecure("https"), true);
  assert.equal(cookiesAreSecure("http"), false);
  assert.equal(cookiesAreSecure(null, true), true);
  assert.equal(cookiesAreSecure(null, false), false);
});

test("auth redirects stay on this site or local development", () => {
  assert.equal(authRedirectOrigin("https", "www.whos-that-llm.com"), "https://www.whos-that-llm.com");
  assert.equal(authRedirectOrigin("http", "localhost:3000"), "http://localhost:3000");
  assert.equal(authRedirectOrigin("https", "example.com"), "https://www.whos-that-llm.com");
  assert.equal(authRedirectOrigin(null, null), "https://www.whos-that-llm.com");
});

test("the provider handoff stays on the Supabase auth endpoint", () => {
  const base = "https://example.supabase.co";
  assert.equal(allowedAuthUrl(`${base}/auth/v1/authorize?provider=google`, base), true);
  assert.equal(allowedAuthUrl("https://example.com/auth/v1/authorize", base), false);
  assert.equal(allowedAuthUrl(`${base}/auth/v1/token`, base), false);
  assert.equal(allowedAuthUrl("http://localhost:54321/auth/v1/authorize", "http://localhost:54321"), true);
});

test("sign-in does not keep the session in the browser client", () => {
  for (const relative of ["components/login-form.tsx", "components/reset-password.tsx", "components/account-menu.tsx"]) {
    const text = fs.readFileSync(path.join(root, relative), "utf8");
    assert.equal(text.includes("createBrowserSupabase"), false, relative);
    assert.equal(text.includes("signInWithPassword"), false, relative);
    assert.equal(text.includes("localStorage"), false, relative);
  }
  assert.equal(fs.existsSync(path.join(root, "lib/supabase/browser.ts")), false);
  const server = fs.readFileSync(path.join(root, "lib/supabase/server.ts"), "utf8");
  const proxy = fs.readFileSync(path.join(root, "lib/supabase/proxy.ts"), "utf8");
  assert.match(server, /authCookieOptions\(secure\)/);
  assert.match(proxy, /authCookieOptions\(secure\)/);
  assert.match(server, /import "server-only"/);
});
