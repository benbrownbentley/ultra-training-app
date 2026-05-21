// NOTE: This file is intentionally Next.js-specific — it imports `next/headers`
// to read cookies for session-aware queries. It is the one allowed exception to
// the "no next/* imports in lib/" rule. When migrating to React Native (Expo),
// replace this file with lib/supabase/native.ts that uses the Expo SecureStore
// adapter instead — all the query functions below move over unchanged.
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type {
  ActualDetail,
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
  logged_at: string | null;
  actual_duration_min: number | null;
  actual_distance_km: number | null;
  actual_elevation_gain_m: number | null;
  actual_hr_avg: number | null;
  actual_rpe: number | null;
  actual_notes: string | null;
  actual_detail: ActualDetail | null;
  is_custom: boolean | null;
}

// Single source of truth for the workout column list. Used by getPlan,
// getWorkoutById, and getRaceAndHistory so adding a column lights up
// everywhere automatically.
const WORKOUT_COLUMNS =
  "id, date, kind, title, details, position, status, logged_at, actual_duration_min, actual_distance_km, actual_elevation_gain_m, actual_hr_avg, actual_rpe, actual_notes, actual_detail, is_custom";

const RACE_COLUMNS =
  "id, name, distance, date, elevation_gain, terrain, target_time, intent, priority, elevation_loss, cutoff_time, climate, course_profile, support";
const PROFILE_COLUMNS =
  "unit_system, weekly_volume, longest_run_distance, easy_pace, injury_notes, experience, gym_access, equipment, weekly_hours, weekly_hours_current, cross_training, other_commitments, sleep_stress, fitness_rating, weekly_volume_km, longest_run_date, years_running, years_ultras, ultras_completed, longest_race_distance, longest_race_name, longest_race_date, previous_endurance, age, body_weight, sex, chronic_conditions, sleep_hours, stress_baseline, training_days, long_run_day, quality_day, long_run_days, quality_days, strength_freq, time_of_day, job_type, outdoor_terrain, cross_training_enjoys, max_hr, resting_hr, lactate_threshold_hr, vo2_max, training_preferences, theme, daily_reminder, regen_complete_notify, weekly_summary";

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
      .select(WORKOUT_COLUMNS)
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
      position: row.position,
      logged_at: row.logged_at,
      actual_duration_min: row.actual_duration_min,
      actual_distance_km: row.actual_distance_km,
      actual_elevation_gain_m: row.actual_elevation_gain_m,
      actual_hr_avg: row.actual_hr_avg,
      actual_rpe: row.actual_rpe,
      actual_notes: row.actual_notes,
      actual_detail: row.actual_detail,
      is_custom: Boolean(row.is_custom),
    });
    byDate.set(row.date, list);
  }

  const days = Array.from(byDate.entries()).map(([date, workouts]) => ({
    date,
    workouts,
  }));

  return { race, days };
}

// Wrapped in React's `cache()` so multiple callers in the same request
// (root layout reads theme; Profile page reads units + prefs; etc.)
// share one DB round-trip. Cache is per-request — no cross-user leak.
export const getAthleteProfile = cache(
  async (): Promise<AthleteProfile | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("athlete_profile")
      .select(PROFILE_COLUMNS)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle<AthleteProfile>();

    if (error) throw error;
    return data;
  },
);

interface WorkoutDetail {
  id: number;
  date: string;
  kind: WorkoutKind;
  title: string;
  details: string;
  position: number;
  status: WorkoutStatus;
  logged_at: string | null;
  actual_duration_min: number | null;
  actual_distance_km: number | null;
  actual_elevation_gain_m: number | null;
  actual_hr_avg: number | null;
  actual_rpe: number | null;
  actual_notes: string | null;
  actual_detail: ActualDetail | null;
  is_custom: boolean | null;
}

export async function getWorkoutById(
  id: number,
): Promise<WorkoutDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .select(WORKOUT_COLUMNS)
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
  actual_duration_min: number | null;
  actual_distance_km: number | null;
  actual_elevation_gain_m: number | null;
  actual_hr_avg: number | null;
  actual_rpe: number | null;
  actual_notes: string | null;
  actual_detail: ActualDetail | null;
}

/**
 * Fetches the race and all past workout rows in a single parallel call.
 * Used by regeneratePlan() to build the history payload for Claude.
 * "Past" means any workout with a date strictly before `beforeDate`.
 */
export async function getRaceAndHistory(beforeDate: string): Promise<{
  race: Race | null;
  // B/C races (and any other non-completed lower-priority races) so the
  // plan generator can build tune-ups and avoid stacking hard sessions
  // around them. Excludes the A race (returned in `race`) and any race
  // marked completed.
  otherRaces: Race[];
  history: LoggedWorkoutRow[];
}> {
  const supabase = await createClient();
  const [racesResult, historyResult] = await Promise.all([
    // Fetch ALL upcoming races (not just one); we'll split A vs. others
    // in-memory below. Cheaper than a second query.
    supabase
      .from("race")
      .select(RACE_COLUMNS)
      .neq("priority", "completed")
      .order("priority", { ascending: true })
      .order("date", { ascending: true })
      .returns<Race[]>(),
    supabase
      .from("workouts")
      .select(
        "date, kind, title, details, status, actual_duration_min, actual_distance_km, actual_elevation_gain_m, actual_hr_avg, actual_rpe, actual_notes, actual_detail",
      )
      .lt("date", beforeDate)
      .order("date", { ascending: true })
      .order("position", { ascending: true })
      .returns<LoggedWorkoutRow[]>(),
  ]);

  if (racesResult.error) throw racesResult.error;
  if (historyResult.error) throw historyResult.error;

  const races = racesResult.data ?? [];
  const [race, ...otherRaces] = races;

  return {
    race: race ?? null,
    otherRaces,
    history: historyResult.data ?? [],
  };
}

const PREVIEW_COLUMNS =
  "id, user_id, workouts, notes, generation_summary, status, created_at";

/**
 * Single-row preview fetch by id. RLS makes cross-user reads return null
 * rather than data, so this doubles as the authorisation check for /regen.
 */
export async function getPreviewById(
  id: number,
): Promise<import("@/lib/preview").PreviewRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_previews")
    .select(PREVIEW_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as import("@/lib/preview").PreviewRow | null) ?? null;
}

/**
 * Returns the generation_summary of the most recently accepted preview
 * for the current user, or null if they have no accepted regens yet
 * (first plan or all previous previews were discarded). Used by
 * previewPlan to thread continuity context — "this is what you told the
 * athlete last time" — into the next prompt.
 */
export async function getLatestAcceptedSummary(): Promise<
  import("@/lib/preview").GenerationSummary | null
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_previews")
    .select("generation_summary")
    .eq("status", "accepted")
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      generation_summary: import("@/lib/preview").GenerationSummary | null;
    }>();
  if (error) throw error;
  return data?.generation_summary ?? null;
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
