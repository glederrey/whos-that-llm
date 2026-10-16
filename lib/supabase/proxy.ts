import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasAdminFlag } from "@/lib/admin-model";
import { authCookieOptions } from "@/lib/auth-cookies";
import { publicEnv } from "./env";

function isPrivatePath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function hide(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/404";
  url.search = "";
  return NextResponse.rewrite(url, { status: 404 });
}

function withPath(request: NextRequest) {
  return NextResponse.next({ request });
}

export async function updateSession(request: NextRequest) {
  const hidden = isPrivatePath(request.nextUrl.pathname);
  let response = withPath(request);
  const env = publicEnv();
  if (!env) return hidden ? hide(request) : response;

  const secure = request.nextUrl.protocol === "https:";
  const supabase = createServerClient(env.url, env.key, {
    cookieOptions: authCookieOptions(secure),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = withPath(request);
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, { ...options, ...authCookieOptions(secure) });
        }
      },
    },
  });

  const code = request.nextUrl.searchParams.get("code");
  if (code && request.nextUrl.pathname === "/") {
    await supabase.auth.exchangeCodeForSession(code);
    const url = request.nextUrl.clone();
    url.searchParams.delete("code");
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set({ ...cookie, ...authCookieOptions(secure) });
    }
    return redirect;
  }

  const { data } = await supabase.auth.getUser();
  if (hidden && !hasAdminFlag(data.user)) return hide(request);
  return response;
}
