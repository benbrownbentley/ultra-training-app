"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAthleteProfile } from "@/lib/supabase";
import { generateTrainingPlan } from "@/lib/claude";
import type { WorkoutStatus } from "@/lib/plan";

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
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
  }).format(new Date());

  const { data: race, error: raceError } = await supabaseAdmin
    .from("race")
    .select("name, distance, date")
    .order("id", { ascending: false })
    .limit(1)
    .single();

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

  const workouts = await generateTrainingPlan({
    race,
    baseline: {
      weeklyVolume: profile.weekly_volume,
      longestRunKm: profile.longest_run_km,
      easyPace: profile.easy_pace,
      injuryNotes: profile.injury_notes ?? "No specific injuries reported.",
    },
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
