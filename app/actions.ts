"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
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
