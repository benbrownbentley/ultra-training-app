"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAthleteProfile } from "@/lib/supabase/server";
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

export async function logWorkout(id: number, status: WorkoutStatus) {
  const loggedAt = status === "pending" ? null : new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("workouts")
    .update({ status, logged_at: loggedAt })
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/");
}

export async function regeneratePlan() {
  const today = getTodayISO();

  const { data: race, error: raceError } = await supabaseAdmin
    .from("race")
    .select(
      "name, distance, date, elevation_gain, terrain, target_time, intent",
    )
    .order("id", { ascending: false })
    .limit(1)
    .single<Race>();

  if (raceError) throw raceError;
  if (!race) throw new Error("No race configured.");

  const [{ data: existing, error: existingErr }, profile] = await Promise.all([
    supabaseAdmin
      .from("workouts")
      .select("date, kind, title, details, status")
      .lt("date", today)
      .order("date", { ascending: true })
      .order("position", { ascending: true }),
    getAthleteProfile(),
  ]);
  if (existingErr) throw existingErr;
  if (!profile) {
    throw new Error(
      "No athlete profile configured. Run the intake wizard first.",
    );
  }

  const workouts = await generateTrainingPlan({
    race,
    profile,
    startDate: today,
    history: existing ?? [],
  });

  const futureOnly = workouts.filter((w) => w.date >= today);

  const { error: delErr } = await supabaseAdmin
    .from("workouts")
    .delete()
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
  const raceRow = {
    name: data.raceName.trim(),
    distance: data.raceDistance.trim(),
    date: data.raceDate,
    elevation_gain: data.elevationGain,
    terrain: data.terrain,
    target_time: blankToNull(data.targetTime),
    intent: data.intent,
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

  const { error: raceDelErr } = await supabaseAdmin
    .from("race")
    .delete()
    .gte("id", 0);
  if (raceDelErr) throw raceDelErr;

  const { error: raceInsErr } = await supabaseAdmin
    .from("race")
    .insert(raceRow);
  if (raceInsErr) throw raceInsErr;

  const { error: profDelErr } = await supabaseAdmin
    .from("athlete_profile")
    .delete()
    .gte("id", 0);
  if (profDelErr) throw profDelErr;

  const { error: profInsErr } = await supabaseAdmin
    .from("athlete_profile")
    .insert(profileRow);
  if (profInsErr) throw profInsErr;

  await regeneratePlan();

  redirect("/");
}
