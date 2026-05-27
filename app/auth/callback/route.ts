import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback. Handles two distinct Supabase flows that funnel through the
 * same URL:
 *
 *   1. OAuth (Google) — Supabase redirects with `?code=`. Exchange for a
 *      session via exchangeCodeForSession.
 *   2. Email confirmation (signup verification, email change, etc.) —
 *      Supabase redirects with `?token_hash=` + `?type=`. Exchange via
 *      verifyOtp.
 *
 * Either way the SSR client writes the session cookies, so the next request is
 * authenticated. On any failure we bounce to /sign-in with an error marker so
 * the UI surfaces it instead of silently looping.
 *
 * `?next=` controls where the user lands after a successful exchange (defaults
 * to "/"). It's validated as a same-origin relative path to avoid open-redirect
 * abuse via a crafted email link.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = sanitiseNext(searchParams.get("next")) ?? "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (error) {
      return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
}

/**
 * Allow only same-origin relative paths in `next`, so a crafted email link
 * can't bounce an authenticated user off to another site (open redirect /
 * phishing setup). Rejects absolute URLs and protocol-relative `//host` paths.
 */
function sanitiseNext(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
