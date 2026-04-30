import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Public paths that DO NOT require authentication.
 * - /api/auth/signup: creates the very first user.
 * - /api/invites/:token/accept: token-gated, used by un-authed invitees.
 * - /accept-invite/[token]: the static page invitees land on.
 * - /signup, /login: auth pages.
 */
const PUBLIC_PATHS = ["/", "/signup", "/login", "/api/auth/signup"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/accept-invite/")) return true;
  if (pathname.startsWith("/api/invites/") && pathname.endsWith("/accept")) {
    return true;
  }
  // Next.js / static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/static")
  ) {
    return true;
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });

  // No env vars → can't do auth; let through (dev/scaffold safety).
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return res;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set({ name, value, ...options });
          });
        },
      },
    },
  );

  // Refresh the session cookie on every request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return res;

  // Gate /api/* and authenticated app routes.
  const requiresAuth =
    pathname.startsWith("/api/") || pathname.startsWith("/app");

  if (requiresAuth && !user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
