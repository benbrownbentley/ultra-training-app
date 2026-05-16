import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type {
  AthleteProfile,
  Plan,
  Race,
  Workout,
  WorkoutKind,
  WorkoutStatus,
} from "@/lib/plan";

/**
 * Server Supabase client. Use this inside Server Components, Server Actions,
 * and Route Handlers. Reads and writes the user's session cookies — required
 * for auth-aware queries. Each call returns a fresh instance bound to the
 * current request.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component context — cookie mutations are picked up by
            // middleware and the response, so swallowing this is correct.
          }
        },
      },
    },
  );
}

interface WorkoutRow {
  id: number;
  date: string;
  kind: WorkoutKind;
  title: string;
  details: string;
  position: number;
  status: WorkoutStatus;
}

const RACE_COLUMNS =
  "name, distance, date, elevation_gain, terrain, target_time, intent";
const PROFILE_COLUMNS =
  "unit_system, weekly_volume, longest_run_distance, easy_pace, injury_notes, experience, gym_access, equipment, weekly_hours, cross_training, other_commitments, sleep_stress";

export async function getPlan(): Promise<Plan | null> {
  const supabase = await createClient();
  const [raceResult, workoutsResult] = await Promise.all([
    supabase
      .from("race")
      .select(RACE_COLUMNS)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle<Race>(),
    supabase
      .from("workouts")
      .select("id, date, kind, title, details, position, status")
      .order("date", { ascending: true })
      .order("position", { ascending: true })
      .returns<WorkoutRow[]>(),
  ]);

  if (raceResult.error) throw raceResult.error;
  if (workoutsResult.error) throw workoutsResult.error;

  if (!raceResult.data) return null;
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

export async function getAthleteProfile(): Promise<AthleteProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("athlete_profile")
    .select(PROFILE_COLUMNS)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle<AthleteProfile>();

  if (error) throw error;
  return data;
}

interface WorkoutDetail {
  id: number;
  date: string;
  kind: WorkoutKind;
  title: string;
  details: string;
  position: number;
  status: WorkoutStatus;
  logged_at: string | null;
}

export async function getWorkoutById(
  id: number,
): Promise<WorkoutDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .select("id, date, kind, title, details, position, status, logged_at")
    .eq("id", id)
    .maybeSingle<WorkoutDetail>();

  if (error) throw error;
  return data;
}

export async function getRace(): Promise<Race | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("race")
    .select(RACE_COLUMNS)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle<Race>();

  if (error) throw error;
  return data;
}
