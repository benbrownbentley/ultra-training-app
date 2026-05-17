"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient, getAthleteProfile } from "@/lib/supabase/server";
import { generateTrainingPlan } from "@/lib/claude";
import { getTodayISO } from "@/lib/utils";
import type {
  GymAccess,
  Intent,
  Race,
  Terrain,
  UnitSystem,
  WorkoutStatus,
} from "@/lib/plan";

export interface WizardPayload {
  unitSystem: UnitSystem;
  raceName: string;
  raceDistance: string;
  raceDate: string;
  elevationGain: number | null;
  terrain: Terrain | null;
  targetTime: string;
  intent: Intent | null;
  weeklyVolume: string;
  longestRunDistance: number;
  easyPace: string;
  experience: string;
  injuryNotes: string;
  gymAccess: GymAccess | null;
  equipment: string;
  weeklyHours: number | null;
  crossTraining: string;
  otherCommitments: string;
  sleepStress: string;
}

/**
 * Resolves the current user from the cookie-aware server client. Middleware
 * already gates protected routes, but each action still re-checks — auth
 * decisions must never depend on the middleware being correctly configured
 * for a given matcher.
 */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");
  return { user, supabase };
}

export async function logWorkout(id: number, status: WorkoutStatus) {
  const loggedAt = status === "pending" ? null : new Date().toISOString();
  const { user, supabase } = await requireUser();

  // Two layers of isolation: RLS rejects cross-user updates server-side, and
  // the explicit user_id filter narrows the query before it leaves the app.
  // Belt-and-suspenders — if either layer is misconfigured the other catches it.
  const { error } = await supabase
    .from("workouts")
    .update({ status, logged_at: loggedAt })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;

  revalidatePath("/");
}

export async function regeneratePlan() {
  const today = getTodayISO();
  const { user, supabase } = await requireUser();

  const [raceResult, historyResult, profile] = await Promise.all([
    supabase
      .from("race")
      .select(
        "name, distance, date, elevation_gain, terrain, target_time, intent",
      )
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle<Race>(),
    supabase
      .from("workouts")
      .select("date, kind, title, details, status")
      .lt("date", today)
      .order("date", { ascending: true })
      .order("position", { ascending: true }),
    getAthleteProfile(),
  ]);

  if (raceResult.error) throw raceResult.error;
  if (!raceResult.data) throw new Error("No race configured.");
  if (historyResult.error) throw historyResult.error;
  if (!profile) {
    throw new Error(
      "No athlete profile configured. Run the intake wizard first.",
    );
  }

  const workouts = await generateTrainingPlan({
    race: raceResult.data,
    profile,
    startDate: today,
    history: historyResult.data ?? [],
  });

  const futureOnly = workouts
    .filter((w) => w.date >= today)
    .map((w) => ({ ...w, user_id: user.id }));

  // Admin client for the bulk delete+insert to bypass per-row RLS overhead,
  // but always scope by user_id so we never touch another user's rows.
  const { error: delErr } = await supabaseAdmin
    .from("workouts")
    .delete()
    .eq("user_id", user.id)
    .gte("date", today);
  if (delErr) throw delErr;

  const { error: insErr } = await supabaseAdmin
    .from("workouts")
    .insert(futureOnly);
  if (insErr) throw insErr;

  revalidatePath("/");
}

function blankToNull(s: string): string | null {
  const trimmed = s.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function submitWizard(data: WizardPayload) {
  const { user } = await requireUser();

  const raceRow = {
    name: data.raceName.trim(),
    distance: data.raceDistance.trim(),
    date: data.raceDate,
    elevation_gain: data.elevationGain,
    terrain: data.terrain,
    target_time: blankToNull(data.targetTime),
    intent: data.intent,
    user_id: user.id,
  };

  const profileRow = {
    unit_system: data.unitSystem,
    weekly_volume: data.weeklyVolume.trim(),
    longest_run_distance: data.longestRunDistance,
    easy_pace: data.easyPace.trim(),
    injury_notes: blankToNull(data.injuryNotes),
    experience: blankToNull(data.experience),
    gym_access: data.gymAccess,
    equipment: blankToNull(data.equipment),
    weekly_hours: data.weeklyHours,
    cross_training: blankToNull(data.crossTraining),
    other_commitments: blankToNull(data.otherCommitments),
    sleep_stress: blankToNull(data.sleepStress),
  };

  // Clear and re-insert this user's race row.
  const { error: raceDelErr } = await supabaseAdmin
    .from("race")
    .delete()
    .eq("user_id", user.id);
  if (raceDelErr) throw raceDelErr;

  const { error: raceInsErr } = await supabaseAdmin
    .from("race")
    .insert(raceRow);
  if (raceInsErr) throw raceInsErr;

  // Same for the athlete profile.
  const { error: profDelErr } = await supabaseAdmin
    .from("athlete_profile")
    .delete()
    .eq("user_id", user.id);
  if (profDelErr) throw profDelErr;

  const { error: profInsErr } = await supabaseAdmin
    .from("athlete_profile")
    .insert({ ...profileRow, user_id: user.id });
  if (profInsErr) throw profInsErr;

  await regeneratePlan();

  redirect("/");
}
