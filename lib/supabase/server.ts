// NOTE: This file is intentionally Next.js-specific — it imports `next/headers`
// to read cookies for session-aware queries. It is the one allowed exception to
// the "no next/* imports in lib/" rule. When migrating to React Native (Expo),
// replace this file with lib/supabase/native.ts that uses the Expo SecureStore
// adapter instead — all the query functions below move over unchanged.
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
import type { JournalEntry } from "@/lib/journal";

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
  "id, name, distance, date, elevation_gain, terrain, target_time, intent, priority, elevation_loss, cutoff_time, climate, course_profile, support";
const PROFILE_COLUMNS =
  "unit_system, weekly_volume, longest_run_distance, easy_pace, injury_notes, experience, gym_access, equipment, weekly_hours, cross_training, other_commitments, sleep_stress, fitness_rating, weekly_volume_km, longest_run_date, years_running, years_ultras, ultras_completed, longest_race_distance, longest_race_name, longest_race_date, previous_endurance, age, body_weight, sex, chronic_conditions, sleep_hours, stress_baseline, training_days, long_run_day, quality_day, strength_freq, time_of_day, job_type, outdoor_terrain, cross_training_enjoys, max_hr, resting_hr, lactate_threshold_hr, vo2_max, training_preferences";

export async function getPlan(): Promise<Plan | null> {
  const supabase = await createClient();
  const [raceResult, workoutsResult] = await Promise.all([
    // Pick the goal race: highest priority (A < B < C), then soonest. The
    // "completed" pseudo-priority is excluded — past races never anchor
    // the active plan.
    supabase
      .from("race")
      .select(RACE_COLUMNS)
      .neq("priority", "completed")
      .order("priority", { ascending: true })
      .order("date", { ascending: true })
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

// Returns the current goal race — A first, soonest if multiple, excluding
// anything flagged completed. Used wherever the app talks about "the race".
export async function getRace(): Promise<Race | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("race")
    .select(RACE_COLUMNS)
    .neq("priority", "completed")
    .order("priority", { ascending: true })
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle<Race>();

  if (error) throw error;
  return data;
}

// Returns the user's full race calendar including completed ones — the
// Race Calendar page wants to show the full block.
export async function listRaces(): Promise<Race[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("race")
    .select(RACE_COLUMNS)
    .order("priority", { ascending: true })
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Race[];
}

// Single-race fetch — used by the per-race edit form.
export async function getRaceById(id: number): Promise<Race | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("race")
    .select(RACE_COLUMNS)
    .eq("id", id)
    .maybeSingle<Race>();
  if (error) throw error;
  return data;
}

export interface LoggedWorkoutRow {
  date: string;
  kind: WorkoutKind;
  title: string;
  details: string;
  status: WorkoutStatus;
}

/**
 * Fetches the race and all past workout rows in a single parallel call.
 * Used by regeneratePlan() to build the history payload for Claude.
 * "Past" means any workout with a date strictly before `beforeDate`.
 */
export async function getRaceAndHistory(beforeDate: string): Promise<{
  race: Race | null;
  history: LoggedWorkoutRow[];
}> {
  const supabase = await createClient();
  const [raceResult, historyResult] = await Promise.all([
    supabase
      .from("race")
      .select(RACE_COLUMNS)
      .neq("priority", "completed")
      .order("priority", { ascending: true })
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle<Race>(),
    supabase
      .from("workouts")
      .select("date, kind, title, details, status")
      .lt("date", beforeDate)
      .order("date", { ascending: true })
      .order("position", { ascending: true })
      .returns<LoggedWorkoutRow[]>(),
  ]);

  if (raceResult.error) throw raceResult.error;
  if (historyResult.error) throw historyResult.error;

  return {
    race: raceResult.data,
    history: historyResult.data ?? [],
  };
}

const JOURNAL_COLUMNS =
  "id, type, entry_date, title, body, details, consumed, created_at";

/**
 * Reads all journal entries owned by the current user, newest first.
 * Used by the Journal feed and by regeneratePlan() to pass recent
 * context into the Claude prompt.
 */
export async function listJournalEntries(): Promise<JournalEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select(JOURNAL_COLUMNS)
    .order("entry_date", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return (data ?? []) as JournalEntry[];
}

/**
 * Single-entry fetch. Returns null if the row doesn't exist or RLS hides it.
 */
export async function getJournalEntry(
  id: number,
): Promise<JournalEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select(JOURNAL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as JournalEntry | null) ?? null;
}
