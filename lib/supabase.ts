import { createClient } from "@supabase/supabase-js";
import type { Plan, Workout, WorkoutKind } from "./plan";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Add them to .env.local (and to Vercel for production).",
  );
}

export const supabase = createClient(url, key);

interface WorkoutRow {
  date: string;
  kind: WorkoutKind;
  title: string;
  details: string;
  position: number;
}

interface RaceRow {
  name: string;
  distance: string;
  date: string;
}

export async function getPlan(): Promise<Plan> {
  const [raceResult, workoutsResult] = await Promise.all([
    supabase
      .from("race")
      .select("name, distance, date")
      .order("id", { ascending: false })
      .limit(1)
      .single<RaceRow>(),
    supabase
      .from("workouts")
      .select("date, kind, title, details, position")
      .order("date", { ascending: true })
      .order("position", { ascending: true })
      .returns<WorkoutRow[]>(),
  ]);

  if (raceResult.error) throw raceResult.error;
  if (workoutsResult.error) throw workoutsResult.error;

  const race = raceResult.data;
  const rows = workoutsResult.data ?? [];

  const byDate = new Map<string, Workout[]>();
  for (const row of rows) {
    const list = byDate.get(row.date) ?? [];
    list.push({ kind: row.kind, title: row.title, details: row.details });
    byDate.set(row.date, list);
  }

  const days = Array.from(byDate.entries()).map(([date, workouts]) => ({
    date,
    workouts,
  }));

  return { race, days };
}
