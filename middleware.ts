import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth middleware. Runs on every request that isn't a static asset.
 * Two jobs:
 *   1. Refresh the Supabase session token by calling getUser() — without this
 *      the session silently expires.
 *   2. Gate route access: unauthenticated requests bounce to /sign-in, and
 *      authenticated requests bounce away from the entry forms.
 * The auth surfaces (/sign-in, /sign-up, /forgot-password, /reset-password,
 * /auth/*) are reachable unauthenticated. /auth/* (OAuth code exchange) and
 * /reset-password (recovery-session new-password form) additionally stay
 * reachable while authenticated.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute =
    path.startsWith("/sign-in") ||
    path.startsWith("/sign-up") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/auth");

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Signed-in users get bounced away from the entry forms, but /auth/* (OAuth
  // code exchange) and /reset-password (the recovery session is a real session,
  // yet the user still needs to reach the new-password form) must stay
  // reachable while authenticated.
  if (
    user &&
    isAuthRoute &&
    !path.startsWith("/auth") &&
    !path.startsWith("/reset-password")
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
