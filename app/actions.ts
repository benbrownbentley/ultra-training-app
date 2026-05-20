"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createClient,
  getAthleteProfile,
  getRaceAndHistory,
  listJournalEntries,
} from "@/lib/supabase/server";
import { generateTrainingPlan } from "@/lib/claude";
import { blankToNull, getTodayISO } from "@/lib/utils";
import type {
  GymAccess,
  Intent,
  RacePriority,
  Terrain,
  UnitSystem,
  WorkoutStatus,
} from "@/lib/plan";
import type {
  InjuryDetails,
  JournalEntry,
  JournalEntryType,
  PhysioDetails,
  TravelDetails,
} from "@/lib/journal";

// Race row collected by the wizard. A race is always priority "A"; the
// rest are B or C — never "completed", because nothing is logged yet.
export interface WizardRaceInput {
  priority: "A" | "B" | "C";
  name: string;
  date: string;
  distance: string;
  elevationGain: number | null;
  terrain: Terrain | null;
  targetTime: string;
  intent: Intent | null;
}

export interface WizardPayload {
  unitSystem: UnitSystem;
  // Required A race + zero or more optional B/C races (all in priority order).
  aRace: WizardRaceInput;
  otherRaces: WizardRaceInput[];
  // Fitness baseline
  fitnessRating: number;
  weeklyVolumeKm: number | null;
  weeklyHours: number | null;
  longestRunDistance: number | null;
  longestRunDate: string | null;
  // Experience
  yearsRunning: number | null;
  yearsUltras: number | null;
  ultrasCompleted: string;
  longestRaceDistance: number | null;
  longestRaceName: string;
  longestRaceDate: string;
  // About you
  age: number | null;
  sex: string;
  bodyWeight: number | null;
  // Health
  injuryNotes: string;
  chronicConditions: string;
  sleepHours: number | null;
  stressBaseline: number;
  // Schedule
  trainingDays: string[];
  longRunDay: string;
  qualityDay: string;
  strengthFreq: string;
  // Equipment
  gymAccess: GymAccess | null;
  equipment: string[];
  outdoorTerrain: string[];
  crossTrainingEnjoys: string[];
}

/**
 * Resolves the current user from the cookie-aware server client. Middleware
 * already gates protected routes, but each action still re-checks — auth
 * decisions must never depend on the middleware being correctly configured
 * for a given matcher.
 */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");
  return { user, supabase };
}

export async function logWorkout(id: number, status: WorkoutStatus) {
  const loggedAt = status === "pending" ? null : new Date().toISOString();
  const { user, supabase } = await requireUser();

  // Two layers of isolation: RLS rejects cross-user updates server-side, and
  // the explicit user_id filter narrows the query before it leaves the app.
  // Belt-and-suspenders — if either layer is misconfigured the other catches it.
  const { error } = await supabase
    .from("workouts")
    .update({ status, logged_at: loggedAt })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;

  revalidatePath("/");
}

export async function regeneratePlan(notes?: string) {
  const today = getTodayISO();
  const { user } = await requireUser();

  // All Supabase reads go through lib/supabase/server.ts — keeps query logic
  // out of the actions file so it can be reused and is easy to find during
  // a future React Native migration.
  const [{ race, history }, profile, journal] = await Promise.all([
    getRaceAndHistory(today),
    getAthleteProfile(),
    listJournalEntries(),
  ]);

  if (!race) throw new Error("No race configured.");
  if (!profile) {
    throw new Error(
      "No athlete profile configured. Run the intake wizard first.",
    );
  }

  const journalContext = journal.map((e) => ({
    type: e.type,
    entry_date: e.entry_date,
    title: e.title,
    body: e.body,
    details_lines: formatJournalDetails(e),
    consumed: e.consumed,
  }));

  const workouts = await generateTrainingPlan({
    race,
    profile,
    startDate: today,
    history,
    notes: blankToNull(notes ?? ""),
    journalEntries: journalContext,
  });

  const futureOnly = workouts
    .filter((w) => w.date >= today)
    .map((w) => ({ ...w, user_id: user.id }));

  // Admin client for the bulk delete+insert to bypass per-row RLS overhead,
  // but always scope by user_id so we never touch another user's rows.
  const { error: delErr } = await supabaseAdmin
    .from("workouts")
    .delete()
    .eq("user_id", user.id)
    .gte("date", today);
  if (delErr) throw delErr;

  const { error: insErr } = await supabaseAdmin
    .from("workouts")
    .insert(futureOnly);
  if (insErr) throw insErr;

  // Flip every unconsumed entry to "seen" — they've now influenced a plan,
  // so the Journal feed should stop badging them as PENDING.
  const { error: markErr } = await supabaseAdmin
    .from("journal_entries")
    .update({ consumed: true })
    .eq("user_id", user.id)
    .eq("consumed", false);
  if (markErr) throw markErr;

  revalidatePath("/");
  revalidatePath("/plan");
  revalidatePath("/journal");
}

// Renders the type-specific `details` JSON into bullet lines for the
// Claude prompt. Pure formatting — no business logic.
function formatJournalDetails(entry: JournalEntry): string[] {
  if (entry.type === "travel" && entry.details) {
    const d = entry.details;
    return [
      `dates: ${d.start_date} → ${d.end_date}`,
      `impact: ${d.impact.length ? d.impact.join(", ") : "unspecified"}`,
    ];
  }
  if (entry.type === "injury" && entry.details) {
    const d = entry.details;
    const lines = [
      `body_part: ${d.body_part}`,
      `side: ${d.side}`,
      `severity: ${d.severity}/10`,
    ];
    if (d.pain_quality.length)
      lines.push(`pain_quality: ${d.pain_quality.join(", ")}`);
    if (d.restrictions.length)
      lines.push(`restrictions: ${d.restrictions.join(", ")}`);
    if (d.started_date) lines.push(`started: ${d.started_date}`);
    if (d.check_back_in_days)
      lines.push(`check_back_in: ${d.check_back_in_days} days`);
    return lines;
  }
  if (entry.type === "physio" && entry.details) {
    const d = entry.details;
    const lines = [`diagnosis: ${d.diagnosis}`];
    if (d.physio_name) lines.push(`physio: ${d.physio_name}`);
    if (d.visit_date) lines.push(`visit: ${d.visit_date}`);
    if (d.restrictions.length)
      lines.push(`restrictions: ${d.restrictions.join(", ")}`);
    if (d.exercises.length) {
      const ex = d.exercises
        .map(
          (e) =>
            `${e.name} — ${e.sets_reps}${e.load ? ` @ ${e.load}` : ""}${
              e.frequency ? ` (${e.frequency})` : ""
            }`,
        )
        .join("; ");
      lines.push(`exercises: ${ex}`);
    }
    if (d.duration_value && d.duration_unit === "weeks")
      lines.push(`duration: ${d.duration_value} weeks`);
    if (d.duration_unit === "until_resolved")
      lines.push("duration: until symptoms resolve");
    return lines;
  }
  return [];
}

export interface CreateJournalArgs {
  type: JournalEntryType;
  entryDate?: string;
  title?: string | null;
  body?: string | null;
  details?: TravelDetails | InjuryDetails | PhysioDetails | null;
  // Regenerate the plan immediately after saving. Used by the "Save & regen"
  // CTA on every entry form so the new context lands in tomorrow's plan.
  regenAfter?: boolean;
}

export async function createJournalEntry(args: CreateJournalArgs) {
  const { user } = await requireUser();

  const row = {
    user_id: user.id,
    type: args.type,
    entry_date: args.entryDate ?? getTodayISO(),
    title: args.title?.trim() ? args.title.trim() : null,
    body: args.body?.trim() ? args.body.trim() : null,
    details: args.details ?? null,
    consumed: false,
  };

  // Admin client keeps the insert simple even though RLS would accept this
  // shape — admin avoids one extra round-trip for cookie-bound auth.
  const { error } = await supabaseAdmin.from("journal_entries").insert(row);
  if (error) throw error;

  revalidatePath("/journal");

  if (args.regenAfter) {
    await regeneratePlan();
    redirect("/");
  } else {
    redirect("/journal");
  }
}

export async function deleteJournalEntry(id: number) {
  const { user } = await requireUser();
  const { error } = await supabaseAdmin
    .from("journal_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/journal");
}

// ─── Profile actions ─────────────────────────────────────────────

export interface RaceFormPayload {
  id?: number;
  priority: RacePriority;
  name: string;
  date: string;
  distance: string;
  elevationGain: number | null;
  terrain: Terrain | null;
  targetTime: string;
  intent: Intent | null;
  elevationLoss: number | null;
  cutoffTime: string;
  climate: string;
  courseProfile: string;
  support: string;
}

// Inserts or updates a race row. Caller supplies an `id` to update; omit
// for an add. We `redirect` rather than revalidate so the form route
// returns the user to the race-calendar landing.
export async function saveRace(payload: RaceFormPayload) {
  const { user } = await requireUser();
  const row = {
    user_id: user.id,
    priority: payload.priority,
    name: payload.name.trim(),
    date: payload.date,
    distance: payload.distance.trim(),
    elevation_gain: payload.elevationGain,
    terrain: payload.terrain,
    target_time: blankToNull(payload.targetTime),
    intent: payload.intent,
    elevation_loss: payload.elevationLoss,
    cutoff_time: blankToNull(payload.cutoffTime),
    climate: blankToNull(payload.climate),
    course_profile: blankToNull(payload.courseProfile),
    support: blankToNull(payload.support),
  };

  if (payload.id) {
    const { error } = await supabaseAdmin
      .from("race")
      .update(row)
      .eq("id", payload.id)
      .eq("user_id", user.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin.from("race").insert(row);
    if (error) throw error;
  }

  revalidatePath("/");
  revalidatePath("/plan");
  revalidatePath("/profile");
  revalidatePath("/profile/race");
  redirect("/profile/race");
}

export async function deleteRace(id: number) {
  const { user } = await requireUser();
  const { error } = await supabaseAdmin
    .from("race")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/profile/race");
  revalidatePath("/profile");
  redirect("/profile/race");
}

export interface AthleteFormPayload {
  unitSystem: UnitSystem;
  // Fitness baseline
  fitnessRating: number | null;
  weeklyVolumeKm: number | null;
  weeklyHours: number | null;
  longestRunDistance: number | null;
  longestRunDate: string | null;
  // Experience
  yearsRunning: number | null;
  yearsUltras: number | null;
  ultrasCompleted: string;
  longestRaceDistance: number | null;
  longestRaceName: string;
  longestRaceDate: string;
  previousEndurance: string[];
  // Body
  age: number | null;
  bodyWeight: number | null;
  sex: string;
  // Health
  injuryNotes: string;
  chronicConditions: string;
  sleepHours: number | null;
  stressBaseline: number | null;
  // Schedule
  trainingDays: string[];
  longRunDay: string;
  qualityDay: string;
  strengthFreq: string;
  timeOfDay: string;
  jobType: string;
  // Equipment & terrain
  gymAccess: GymAccess | null;
  equipment: string;
  outdoorTerrain: string[];
  crossTrainingEnjoys: string[];
  // HR markers
  maxHr: number | null;
  restingHr: number | null;
  lactateThresholdHr: number | null;
  vo2Max: number | null;
  // Free text
  trainingPreferences: string;
  // Legacy free-text fields kept so existing rows don't lose data
  experience: string;
  easyPace: string;
  weeklyVolume: string;
  crossTraining: string;
  otherCommitments: string;
  sleepStress: string;
}

// Single-row upsert on athlete_profile keyed by user_id. We delete +
// insert so the row is fully replaced (avoids stale columns when
// fields are cleared back to null by the form).
export async function saveAthleteProfile(payload: AthleteFormPayload) {
  const { user } = await requireUser();
  const row = {
    user_id: user.id,
    unit_system: payload.unitSystem,
    // Legacy fields the existing wizard + plan generation still read.
    weekly_volume: payload.weeklyVolume.trim() || `${payload.weeklyVolumeKm ?? ""}`,
    longest_run_distance: payload.longestRunDistance ?? 0,
    easy_pace: payload.easyPace.trim() || "",
    injury_notes: blankToNull(payload.injuryNotes),
    experience: blankToNull(payload.experience),
    gym_access: payload.gymAccess,
    equipment: blankToNull(payload.equipment),
    weekly_hours: payload.weeklyHours,
    cross_training: blankToNull(payload.crossTraining),
    other_commitments: blankToNull(payload.otherCommitments),
    sleep_stress: blankToNull(payload.sleepStress),
    // Expanded fields
    fitness_rating: payload.fitnessRating,
    weekly_volume_km: payload.weeklyVolumeKm,
    longest_run_date: payload.longestRunDate,
    years_running: payload.yearsRunning,
    years_ultras: payload.yearsUltras,
    ultras_completed: blankToNull(payload.ultrasCompleted),
    longest_race_distance: payload.longestRaceDistance,
    longest_race_name: blankToNull(payload.longestRaceName),
    longest_race_date: payload.longestRaceDate || null,
    previous_endurance: payload.previousEndurance,
    age: payload.age,
    body_weight: payload.bodyWeight,
    sex: blankToNull(payload.sex),
    chronic_conditions: blankToNull(payload.chronicConditions),
    sleep_hours: payload.sleepHours,
    stress_baseline: payload.stressBaseline,
    training_days: payload.trainingDays,
    long_run_day: blankToNull(payload.longRunDay),
    quality_day: blankToNull(payload.qualityDay),
    strength_freq: blankToNull(payload.strengthFreq),
    time_of_day: blankToNull(payload.timeOfDay),
    job_type: blankToNull(payload.jobType),
    outdoor_terrain: payload.outdoorTerrain,
    cross_training_enjoys: payload.crossTrainingEnjoys,
    max_hr: payload.maxHr,
    resting_hr: payload.restingHr,
    lactate_threshold_hr: payload.lactateThresholdHr,
    vo2_max: payload.vo2Max,
    training_preferences: blankToNull(payload.trainingPreferences),
  };

  const { error: delErr } = await supabaseAdmin
    .from("athlete_profile")
    .delete()
    .eq("user_id", user.id);
  if (delErr) throw delErr;

  const { error: insErr } = await supabaseAdmin
    .from("athlete_profile")
    .insert(row);
  if (insErr) throw insErr;

  revalidatePath("/profile");
  revalidatePath("/profile/athlete");
  redirect("/profile");
}

// Standard Supabase sign-out — clears the session cookie and bounces to
// the sign-in screen.
export async function signOut() {
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  redirect("/sign-in");
}

// Hard-deletes the user's data and the auth row. Service-role required
// for the auth admin call.
export async function deleteAccount(confirmEmail: string) {
  const { user, supabase } = await requireUser();
  if (!user.email || user.email.toLowerCase() !== confirmEmail.toLowerCase()) {
    throw new Error(
      "Email doesn't match. Type the email associated with this account exactly.",
    );
  }
  // RLS-tied tables clean themselves up via ON DELETE CASCADE when the
  // auth.users row is dropped, but explicit deletes keep the failure
  // mode legible if a future migration loosens the FK.
  await supabaseAdmin.from("workouts").delete().eq("user_id", user.id);
  await supabaseAdmin.from("race").delete().eq("user_id", user.id);
  await supabaseAdmin.from("athlete_profile").delete().eq("user_id", user.id);
  await supabaseAdmin.from("journal_entries").delete().eq("user_id", user.id);
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (error) throw error;
  await supabase.auth.signOut();
  redirect("/sign-up");
}

// Finalises the intake wizard: replaces race rows + athlete_profile with
// the fresh inputs, then triggers the first plan generation. Caller is
// expected to manage the post-submit UX (the wizard shows generating →
// done states inline), so we don't redirect here.
export async function submitWizard(data: WizardPayload) {
  const { user } = await requireUser();

  const raceRows = [data.aRace, ...data.otherRaces].map((r) => ({
    user_id: user.id,
    priority: r.priority,
    name: r.name.trim(),
    distance: r.distance.trim(),
    date: r.date,
    elevation_gain: r.elevationGain,
    terrain: r.terrain,
    target_time: blankToNull(r.targetTime),
    intent: r.intent,
  }));

  const profileRow = {
    user_id: user.id,
    unit_system: data.unitSystem,
    // Legacy columns kept populated so prior consumers (Claude prompt's
    // formatProfile, getAthleteProfile) keep returning sensible values.
    weekly_volume: data.weeklyVolumeKm != null ? String(data.weeklyVolumeKm) : "",
    longest_run_distance: data.longestRunDistance ?? 0,
    easy_pace: "",
    injury_notes: blankToNull(data.injuryNotes),
    experience: null,
    gym_access: data.gymAccess,
    equipment: data.equipment.length ? data.equipment.join(", ") : null,
    weekly_hours: data.weeklyHours,
    cross_training: data.crossTrainingEnjoys.length
      ? data.crossTrainingEnjoys.join(", ")
      : null,
    other_commitments: null,
    sleep_stress: null,
    // Expanded columns
    fitness_rating: data.fitnessRating,
    weekly_volume_km: data.weeklyVolumeKm,
    longest_run_date: data.longestRunDate,
    years_running: data.yearsRunning,
    years_ultras: data.yearsUltras,
    ultras_completed: blankToNull(data.ultrasCompleted),
    longest_race_distance: data.longestRaceDistance,
    longest_race_name: blankToNull(data.longestRaceName),
    longest_race_date: data.longestRaceDate || null,
    previous_endurance: null,
    age: data.age,
    body_weight: data.bodyWeight,
    sex: blankToNull(data.sex),
    chronic_conditions: blankToNull(data.chronicConditions),
    sleep_hours: data.sleepHours,
    stress_baseline: data.stressBaseline,
    training_days: data.trainingDays,
    long_run_day: blankToNull(data.longRunDay),
    quality_day: blankToNull(data.qualityDay),
    strength_freq: blankToNull(data.strengthFreq),
    time_of_day: null,
    job_type: null,
    outdoor_terrain: data.outdoorTerrain,
    cross_training_enjoys: data.crossTrainingEnjoys,
    max_hr: null,
    resting_hr: null,
    lactate_threshold_hr: null,
    vo2_max: null,
    training_preferences: null,
  };

  // Replace race + athlete_profile rows wholesale. Wizard is a one-shot
  // initialisation; partial-update semantics live behind /profile/* edits.
  const { error: raceDelErr } = await supabaseAdmin
    .from("race")
    .delete()
    .eq("user_id", user.id);
  if (raceDelErr) throw raceDelErr;

  if (raceRows.length > 0) {
    const { error: raceInsErr } = await supabaseAdmin
      .from("race")
      .insert(raceRows);
    if (raceInsErr) throw raceInsErr;
  }

  const { error: profDelErr } = await supabaseAdmin
    .from("athlete_profile")
    .delete()
    .eq("user_id", user.id);
  if (profDelErr) throw profDelErr;

  const { error: profInsErr } = await supabaseAdmin
    .from("athlete_profile")
    .insert(profileRow);
  if (profInsErr) throw profInsErr;

  await regeneratePlan();
}
