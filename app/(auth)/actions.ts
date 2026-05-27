"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  checkPassword,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from "@/lib/auth-constants";

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
  // Defence-in-depth: Supabase enforces the same floor server-side, but a
  // friendly message beats its raw "Password should be at least 8 characters".
  const check = checkPassword(password);
  if (!check.ok) {
    return { ok: false, error: PASSWORD_REQUIREMENTS_MESSAGE };
  }

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

// ─── Account self-service ─────────────────────────────────────────

export type AccountResult = { ok: true } | { ok: false; error: string };

interface ChangeEmailArgs {
  newEmail: string;
  currentPassword: string;
}

/**
 * Updates the signed-in user's email. Re-authenticates with the current
 * password first so a stolen session can't silently take over the account.
 * Supabase sends confirmation links to both addresses; the change isn't
 * effective until the user clicks them.
 *
 * Side effect: signInWithPassword issues a fresh session cookie for the
 * same user. Harmless in practice (the user is still themselves) but
 * worth knowing if future changes care about session continuity.
 */
export async function changeEmail({
  newEmail,
  currentPassword,
}: ChangeEmailArgs): Promise<AccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Not signed in." };

  // Re-auth gate — Supabase's updateUser doesn't require the current
  // password by itself, so we verify here.
  const { error: pwErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (pwErr) return { ok: false, error: "Current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

interface ChangePasswordArgs {
  currentPassword: string;
  newPassword: string;
}

/**
 * Updates the signed-in user's password. Same re-auth gate as changeEmail
 * (also re-issues a fresh session for the current user — see that
 * function's note).
 */
export async function changePassword({
  currentPassword,
  newPassword,
}: ChangePasswordArgs): Promise<AccountResult> {
  const check = checkPassword(newPassword);
  if (!check.ok) {
    return { ok: false, error: PASSWORD_REQUIREMENTS_MESSAGE };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Not signed in." };

  const { error: pwErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (pwErr) return { ok: false, error: "Current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Unlinks an OAuth identity (Google, etc.) from the current user. The
 * user must keep at least one sign-in method; we pre-check the
 * password-only-via-OAuth case here so the UI can show a friendly
 * message instead of the raw Supabase error.
 */
export async function disconnectProvider(
  provider: "google",
): Promise<AccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: identityData, error: idErr } =
    await supabase.auth.getUserIdentities();
  if (idErr) return { ok: false, error: idErr.message };
  const identities = identityData?.identities ?? [];
  const identity = identities.find((i) => i.provider === provider);
  if (!identity) return { ok: false, error: `${provider} isn't connected.` };

  // If the user has NO email/password identity AND this OAuth provider
  // is their only other identity, unlinking would lock them out. Catch
  // it before Supabase's cryptic error surfaces.
  const hasEmailIdentity = identities.some((i) => i.provider === "email");
  const otherProviders = identities.filter(
    (i) => i.provider !== provider && i.provider !== "email",
  );
  if (!hasEmailIdentity && otherProviders.length === 0) {
    return {
      ok: false,
      error: `Set a password first — ${provider} is your only sign-in method.`,
    };
  }

  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Revokes every session for the current user. Useful when a device is
 * lost. Returns ok so the caller can navigate to the sign-in screen.
 */
export async function signOutAllDevices(): Promise<AccountResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
