"use server";

import { z } from "zod";
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
  WorkoutKind,
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
  // Two distinct hours fields. "Current" = what the athlete trains
  // now; "Available" = what they could dedicate going forward. The
  // wizard previously collapsed both into a single column.
  weeklyHoursCurrent: number | null;
  weeklyHoursAvailable: number | null;
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
  // Schedule — long-run + quality days are multi-select arrays so the
  // user can flag any day they're flexible about.
  trainingDays: string[];
  longRunDays: string[];
  qualityDays: string[];
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

// Zod schema for the actuals payload. Drives both saveActuals and the
// shape Claude reads back via formatHistory — keep them in sync.
const ActualsSchema = z.object({
  duration_min: z.number().nullable().optional(),
  distance_km: z.number().nullable().optional(),
  elevation_gain_m: z.number().nullable().optional(),
  hr_avg: z.number().int().min(0).max(250).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().nullable().optional(),
  detail: z
    .object({
      zones: z
        .array(z.object({ label: z.string(), minutes: z.number() }))
        .optional(),
      sets: z
        .array(
          z.object({
            exerciseName: z.string(),
            reps: z.number(),
            weight: z.number(),
            unit: z.string(),
          }),
        )
        .optional(),
      exercises: z
        .array(
          z.object({
            name: z.string(),
            done: z.boolean(),
            pain: z.number().nullable().optional(),
            note: z.string().nullable().optional(),
          }),
        )
        .optional(),
    })
    .nullable()
    .optional(),
});

// Persists captured actuals to the workouts row. Distinct from logWorkout
// (which is the one-tap "mark done" path) because users can come back and
// refine actuals on an already-logged workout without touching status.
export async function saveActuals(
  id: number,
  actualsInput: unknown,
): Promise<void> {
  const a = ActualsSchema.parse(actualsInput);
  const { user, supabase } = await requireUser();
  const { error } = await supabase
    .from("workouts")
    .update({
      actual_duration_min: a.duration_min ?? null,
      actual_distance_km: a.distance_km ?? null,
      actual_elevation_gain_m: a.elevation_gain_m ?? null,
      actual_hr_avg: a.hr_avg ?? null,
      actual_rpe: a.rpe ?? null,
      actual_notes: a.notes ?? null,
      actual_detail: a.detail ?? null,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/");
  revalidatePath(`/workout/${id}`);
}

const CustomActivitySchema = z.object({
  kind: z.enum(["run", "gym", "mobility"]),
  title: z.string().min(1).max(120),
  details: z.string().min(1).max(500),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Inserts a user-initiated workout on a given date. Sets is_custom=true so
// the regen RPC (migration 0014) preserves it across plan swaps.
export async function addCustomActivity(input: {
  kind: WorkoutKind;
  title: string;
  details: string;
  date: string;
}): Promise<void> {
  const parsed = CustomActivitySchema.parse(input);
  const { user, supabase } = await requireUser();

  // Append at the end of the date's existing workouts so the new card lands
  // below the planned ones rather than reshuffling positions.
  const { data: existing, error: posErr } = await supabase
    .from("workouts")
    .select("position")
    .eq("user_id", user.id)
    .eq("date", parsed.date)
    .order("position", { ascending: false })
    .limit(1);
  if (posErr) throw posErr;

  const nextPosition = (existing?.[0]?.position ?? -1) + 1;
  const { error } = await supabase.from("workouts").insert({
    user_id: user.id,
    date: parsed.date,
    kind: parsed.kind,
    title: parsed.title,
    details: parsed.details,
    status: "pending",
    position: nextPosition,
    is_custom: true,
  });
  if (error) throw error;
  revalidatePath("/");
}

/**
 * Phase 1 of the regenerate flow: generate a candidate plan and stash it
 * in plan_previews. Does NOT touch the live workouts or journal — the
 * commit phase handles that. Returns the new preview id so the caller can
 * route to /regen?preview=<id>.
 *
 * Discards any existing pending preview for this user first so at most
 * one is ever in flight (acceptance criterion #4 — no accumulation).
 */
export async function previewPlan(
  notes?: string,
): Promise<{ previewId: number }> {
  const today = getTodayISO();
  const { user } = await requireUser();

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

  // Mark any older pending preview as discarded before creating a new
  // one. Done before the Claude call so a fast-clicking user can't end up
  // with two pending rows even briefly. If the Claude call fails after
  // this point, the user has no pending preview to fall back on — they
  // have to trigger a fresh regen from scratch. Acceptable trade-off
  // because (a) the previous preview's diff was likely stale by the time
  // they re-clicked, and (b) the unique partial index
  // plan_previews_one_pending_per_user is the authoritative enforcement;
  // this in-app discard is just defense.
  await discardAllPendingPreviews(user.id);

  const result = await generateTrainingPlan({
    race,
    profile,
    startDate: today,
    history,
    notes: blankToNull(notes ?? ""),
    journalEntries: journalContext,
  });

  const futureOnly = result.workouts.filter((w) => w.date >= today);
  const insertRow = {
    user_id: user.id,
    workouts: futureOnly,
    notes: blankToNull(notes ?? ""),
    generation_summary: result.summary,
    status: "pending" as const,
  };

  // Try the insert. If a concurrent request snuck a pending row in
  // first, the partial unique index throws a 23505 unique violation —
  // catch it, re-discard, retry once. Anything else propagates.
  let attempt = await supabaseAdmin
    .from("plan_previews")
    .insert(insertRow)
    .select("id")
    .single();
  if (attempt.error && (attempt.error as { code?: string }).code === "23505") {
    await discardAllPendingPreviews(user.id);
    attempt = await supabaseAdmin
      .from("plan_previews")
      .insert(insertRow)
      .select("id")
      .single();
  }
  if (attempt.error) throw attempt.error;
  if (!attempt.data) throw new Error("Failed to create preview.");

  return { previewId: attempt.data.id };
}

// Internal helper — marks every pending preview for a user as
// discarded. Used by previewPlan both as the initial cleanup step and
// inside the unique-violation retry loop.
async function discardAllPendingPreviews(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("plan_previews")
    .update({ status: "discarded", decided_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) throw error;
}

/**
 * Phase 2: swap the pending preview's workouts into the active plan.
 * Verifies user_id ownership + pending status. After committing, marks
 * unconsumed journal entries as seen so the next preview only carries
 * truly-new context.
 */
export async function commitPlan(previewId: number): Promise<void> {
  const today = getTodayISO();
  const { user } = await requireUser();

  const { data: preview, error: fetchErr } = await supabaseAdmin
    .from("plan_previews")
    .select("id, user_id, workouts, status")
    .eq("id", previewId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!preview) throw new Error("Preview not found.");
  if (preview.user_id !== user.id) throw new Error("Preview not yours.");
  if (preview.status !== "pending")
    throw new Error("Preview is no longer pending.");

  // Delete + bulk insert run inside one Postgres transaction via the
  // commit_plan_preview RPC. If the insert fails, the delete rolls back
  // and the user keeps their existing plan instead of an empty one.
  const { error: rpcErr } = await supabaseAdmin.rpc("commit_plan_preview", {
    p_user_id: user.id,
    p_today: today,
    p_workouts: preview.workouts,
  });
  if (rpcErr) throw rpcErr;

  // Mark the preview as accepted before the journal flip — if the flip
  // fails for any reason, the next regen still sees the previous "NEW"
  // entries, which is safer than losing them.
  const { error: acceptErr } = await supabaseAdmin
    .from("plan_previews")
    .update({ status: "accepted", decided_at: new Date().toISOString() })
    .eq("id", previewId)
    .eq("user_id", user.id);
  if (acceptErr) throw acceptErr;

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

/**
 * Phase 2b: explicitly drop a pending preview without committing. Used by
 * the "Keep current plan" CTA. No data side effects beyond the preview
 * row's own status flip.
 */
export async function discardPreview(previewId: number): Promise<void> {
  const { user } = await requireUser();
  const { error } = await supabaseAdmin
    .from("plan_previews")
    .update({ status: "discarded", decided_at: new Date().toISOString() })
    .eq("id", previewId)
    .eq("user_id", user.id)
    .eq("status", "pending");
  if (error) throw error;
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
    // Generate a preview, then route the user to the regen preview screen
    // so they can review the diff before the plan actually changes.
    const { previewId } = await previewPlan();
    redirect(`/regen?preview=${previewId}`);
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
  weeklyHoursCurrent: number | null;
  weeklyHoursAvailable: number | null;
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
  longRunDays: string[];
  qualityDays: string[];
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
    // `weekly_hours` is the legacy column now meaning "available."
    weekly_hours: payload.weeklyHoursAvailable,
    weekly_hours_current: payload.weeklyHoursCurrent,
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
    // Write both shapes so legacy readers (Claude prompt fallback) still
    // find something. New code prefers `*_days` arrays.
    long_run_day: payload.longRunDays[0] ?? null,
    quality_day: payload.qualityDays[0] ?? null,
    long_run_days: payload.longRunDays,
    quality_days: payload.qualityDays,
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

  // Upsert preserves the app-level preference columns (theme, daily
  // reminder, etc.) which aren't in this form's row — they're managed
  // by their own actions and would be wiped by delete+insert.
  const { error: profErr } = await supabaseAdmin
    .from("athlete_profile")
    .upsert(row, { onConflict: "user_id" });
  if (profErr) throw profErr;

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

// ─── Preferences ─────────────────────────────────────────────────

const ThemeSchema = z.enum(["light", "dark", "system"]);
const UnitSystemSchema = z.enum(["metric", "imperial"]);
const NotificationKeySchema = z.enum([
  "daily_reminder",
  "regen_complete",
  "weekly_summary",
]);

// Upsert preference values onto the user's athlete_profile row. Each
// action validates input via zod, then writes a single column. We use
// upsert so a brand-new user (no profile row yet — e.g. mid-wizard)
// gets a sensible default row written under the hood.
async function upsertProfileColumn(
  userId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("athlete_profile")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function setTheme(themeInput: string): Promise<void> {
  const theme = ThemeSchema.parse(themeInput);
  const { user } = await requireUser();
  await upsertProfileColumn(user.id, { theme });
  revalidatePath("/profile");
}

export async function setUnitSystem(unitInput: string): Promise<void> {
  const unit_system = UnitSystemSchema.parse(unitInput);
  const { user } = await requireUser();
  await upsertProfileColumn(user.id, { unit_system });
  // Distance/elevation/weight strings change everywhere — revalidate
  // every surface that renders them.
  revalidatePath("/");
  revalidatePath("/plan");
  revalidatePath("/journal");
  revalidatePath("/profile");
}

export async function setNotificationPreference(
  keyInput: string,
  value: boolean,
): Promise<void> {
  const key = NotificationKeySchema.parse(keyInput);
  // Map UI keys to DB columns. `regen_complete` → `regen_complete_notify`
  // is the only renaming; the others match 1:1.
  const column =
    key === "regen_complete" ? "regen_complete_notify" : key;
  const { user } = await requireUser();
  await upsertProfileColumn(user.id, { [column]: value });
  revalidatePath("/profile");
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
    weekly_hours: data.weeklyHoursAvailable,
    weekly_hours_current: data.weeklyHoursCurrent,
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
    // Legacy single-value columns keep the first array element so
    // older readers still see something.
    long_run_day: data.longRunDays[0] ?? null,
    quality_day: data.qualityDays[0] ?? null,
    long_run_days: data.longRunDays,
    quality_days: data.qualityDays,
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

  // Upsert (not delete+insert) so a user who re-runs the wizard keeps
  // their app-level preferences (theme, daily_reminder, …) — those
  // columns aren't in `profileRow` and would be wiped by a fresh insert.
  const { error: profErr } = await supabaseAdmin
    .from("athlete_profile")
    .upsert(profileRow, { onConflict: "user_id" });
  if (profErr) throw profErr;

  // Initial plan generation bypasses the preview pipeline — there's no
  // existing plan to diff against, so we commit directly.
  //
  // Re-fetch race + profile from the database rather than hand-rolling
  // the shape. Cheap, and it keeps the wizard's Claude payload identical
  // to previewPlan's — schema changes break in one place (the type
  // definitions in lib/plan.ts), not two.
  const today = getTodayISO();
  const [{ race }, profile] = await Promise.all([
    getRaceAndHistory(today),
    getAthleteProfile(),
  ]);
  if (!race) throw new Error("No race configured.");
  if (!profile) throw new Error("No athlete profile configured.");

  const result = await generateTrainingPlan({
    race,
    profile,
    startDate: today,
    history: [],
    journalEntries: [],
  });

  // Commit via the same RPC the preview→commit path uses, so the initial
  // generation also gets atomic delete+insert semantics.
  const { error: rpcErr } = await supabaseAdmin.rpc("commit_plan_preview", {
    p_user_id: user.id,
    p_today: today,
    p_workouts: result.workouts,
  });
  if (rpcErr) throw rpcErr;

  revalidatePath("/");
}
