"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthResult =
  | { ok: false; error: string }
  | { ok: true; status: "confirm_email"; email: string };

export type OAuthResult =
  | { ok: false; error: string }
  | { ok: true; url: string };

interface Credentials {
  email: string;
  password: string;
}

/**
 * Email/password sign-in. On success, redirects to / so the freshly written
 * session cookie is picked up by the next request's middleware + server reads.
 * On failure, returns the Supabase error message so the form can display it.
 */
export async function signIn({ email, password }: Credentials): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: error.message };
  }

  redirect("/");
}

/**
 * Email/password sign-up. Two success paths depending on Supabase project
 * settings:
 *   - Email confirmation OFF → an active session is created; redirect to /.
 *   - Email confirmation ON  → no session yet; return a confirm_email status
 *     so the UI can ask the user to check their inbox.
 */
export async function signUp({ email, password }: Credentials): Promise<AuthResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data.session) {
    redirect("/");
  }

  return { ok: true, status: "confirm_email", email };
}

/**
 * Initiates the Google OAuth flow. Supabase returns a provider URL we have
 * to navigate to client-side — we don't redirect from the action itself
 * because the URL is external and client-side navigation handles it cleanly.
 *
 * The redirectTo origin is built from request headers so the same code works
 * for localhost dev and the Vercel deployment without any env var plumbing.
 */
export async function signInWithGoogle(): Promise<OAuthResult> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return { ok: false, error: "Could not determine request origin." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${proto}://${host}/auth/callback`,
    },
  });

  if (error || !data.url) {
    return { ok: false, error: error?.message ?? "OAuth init failed." };
  }

  return { ok: true, url: data.url };
}
