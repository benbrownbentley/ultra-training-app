import { createClient } from "@supabase/supabase-js";
import type {
  AthleteProfile,
  Plan,
  Workout,
  WorkoutKind,
  WorkoutStatus,
} from "./plan";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Add them to .env.local (and to Vercel for production).",
  );
}

export const supabase = createClient(url, key);

interface WorkoutRow {
  id: number;
  date: string;
  kind: WorkoutKind;
  title: string;
  details: string;
  position: number;
  status: WorkoutStatus;
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
      .select("id, date, kind, title, details, position, status")
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
    list.push({
      id: row.id,
      kind: row.kind,
      title: row.title,
      details: row.details,
      status: row.status,
    });
    byDate.set(row.date, list);
  }

  const days = Array.from(byDate.entries()).map(([date, workouts]) => ({
    date,
    workouts,
  }));

  return { race, days };
}

export async function getAthleteProfile(): Promise<AthleteProfile> {
  const { data, error } = await supabase
    .from("athlete_profile")
    .select("weekly_volume, longest_run_km, easy_pace, injury_notes")
    .order("id", { ascending: false })
    .limit(1)
    .single<AthleteProfile>();

  if (error) throw error;
  if (!data) throw new Error("No athlete_profile row found.");
  return data;
}
