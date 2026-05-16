"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
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

  const workouts = await generateTrainingPlan({
    race,
    baseline: {
      weeklyVolume: "25-30 km",
      longestRunKm: 22,
      easyPace: "6:00/km",
      injuryNotes:
        "Sprained left ankle and posterior tibialis tendonitis in the right ankle. Both lower legs need careful management — prefer low-impact cross-training (bike, pool) over high-mileage running on consecutive days, build mileage gradually, and prioritize recovery and mobility.",
    },
    startDate: today,
  });

  const { error: delErr } = await supabaseAdmin
    .from("workouts")
    .delete()
    .gte("id", 0);
  if (delErr) throw delErr;

  const { error: insErr } = await supabaseAdmin
    .from("workouts")
    .insert(workouts);
  if (insErr) throw insErr;

  revalidatePath("/");
}
