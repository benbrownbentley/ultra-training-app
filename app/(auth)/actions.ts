"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthResult =
  | { ok: false; error: string }
  | { ok: true; status: "confirm_email"; email: string };

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
