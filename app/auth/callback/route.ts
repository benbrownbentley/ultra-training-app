import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback. Supabase redirects here with a `?code=` param after the
 * user finishes authenticating with the upstream provider (Google). We
 * exchange the code for a session — the SSR client writes the session
 * cookies via `setAll`, so the next request is authenticated.
 *
 * On any failure path we bounce to /sign-in with an error marker so the
 * UI can surface it instead of silently looping.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
  }

  return NextResponse.redirect(`${origin}/`);
}
