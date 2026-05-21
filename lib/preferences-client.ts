"use client";

// Client-side write helpers for preference toggles. Previously these
// went through Server Actions, which auto-refresh the RSC tree —
// triggering a 22-request cascade after every toggle. Going straight
// to the browser Supabase client cuts it to a single REST POST and
// returns the latency to ~instant.
//
// RLS on athlete_profile + the explicit user_id filter keep this safe
// from cross-user writes; the unique constraint on user_id makes the
// upsert behave like update-on-existing-row.

import { createClient } from "@/lib/supabase/client";

export type PrefResult =
  | { ok: true }
  | { ok: false; error: string; code?: string; hint?: string };

async function upsertPref(
  patch: Record<string, unknown>,
): Promise<PrefResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, error: "Not authenticated" };
  }
  const { error } = await supabase
    .from("athlete_profile")
    .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" });
  if (error) {
    return {
      ok: false,
      error: error.message,
      code: error.code,
      hint: error.hint ?? undefined,
    };
  }
  return { ok: true };
}

const VALID_THEMES = ["light", "dark", "system"] as const;
const VALID_UNITS = ["metric", "imperial"] as const;
const VALID_NOTIF_KEYS = [
  "daily_reminder",
  "regen_complete",
  "weekly_summary",
] as const;

export async function clientSetTheme(theme: string): Promise<PrefResult> {
  if (!VALID_THEMES.includes(theme as (typeof VALID_THEMES)[number])) {
    return { ok: false, error: "Invalid theme" };
  }
  return upsertPref({ theme });
}

export async function clientSetUnitSystem(
  unit: string,
): Promise<PrefResult> {
  if (!VALID_UNITS.includes(unit as (typeof VALID_UNITS)[number])) {
    return { ok: false, error: "Invalid unit system" };
  }
  return upsertPref({ unit_system: unit });
}

export async function clientSetNotificationPreference(
  key: string,
  value: boolean,
): Promise<PrefResult> {
  if (
    !VALID_NOTIF_KEYS.includes(key as (typeof VALID_NOTIF_KEYS)[number])
  ) {
    return { ok: false, error: "Invalid preference key" };
  }
  // Map UI key to DB column — same renaming the prior server action did.
  const column =
    key === "regen_complete" ? "regen_complete_notify" : key;
  return upsertPref({ [column]: value });
}
