// Classifies a workout into one of five render variants based on its
// status and date relative to today. The drill-down page (Workout
// Detail), the Today / Plan WorkoutCard, and anywhere else that wants
// to differentiate "missed past" from "upcoming today" reads from
// this helper so the semantics stay aligned.

import type { WorkoutStatus } from "@/lib/plan";

export type Variant =
  | "upcoming" // pending + today
  | "logged" // status === completed
  | "skipped" // status === skipped
  | "missed" // pending + past
  | "future"; // pending + future

export function classifyWorkout(
  status: WorkoutStatus,
  dateIso: string,
  todayIso: string,
): Variant {
  if (status === "completed") return "logged";
  if (status === "skipped") return "skipped";
  if (dateIso < todayIso) return "missed";
  if (dateIso > todayIso) return "future";
  return "upcoming";
}
