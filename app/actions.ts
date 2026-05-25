"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createClient,
  getAthleteProfile,
  getLatestAcceptedSummary,
  getRaceAndHistory,
  listJournalEntries,
} from "@/lib/supabase/server";
import { generateTrainingPlan } from "@/lib/claude";
import {
  classifyGenerationError,
  makeRequestId,
  type PlanGenFailure,
} from "@/lib/plan-gen-result";
import {
  getJobStatus,
  loadJob,
  precreateGenerationJob as precreateGenerationJobHelper,
  reopenJobForResume,
  runFinalize,
  runMetaPlanForJob as runMetaPlanForJobHelper,
  runOnePhase,
} from "@/lib/plan-generation-orchestrator";
import { pickNextPhase } from "@/lib/plan-generation-helpers";
import type {
  GenerationPhase,
  JobStatusSnapshot,
} from "@/lib/plan-generation-types";
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
      skipped_exercises: z.array(z.string()).optional(),
      added_exercises: z
        .array(
          z.object({
            name: z.string(),
            plannedSets: z.number(),
            plannedReps: z.number(),
            plannedWeight: z.number(),
            plannedUnit: z.string(),
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
  kind: z.enum(["run", "gym", "mobility", "hike", "cross", "physio"]),
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
  // Phase 2: write the legacy `{ notes }` shape for user-added custom
  // activities. Extending the sheet UI to capture structure (per-kind
  // segments / exercises / etc.) is deferred per PHASE_2_SPEC.md §6
  // step 16; the renderer treats notes-only rows as minimal cards.
  const { error } = await supabase.from("workouts").insert({
    user_id: user.id,
    date: parsed.date,
    kind: parsed.kind,
    title: parsed.title,
    planned_detail: { notes: parsed.details },
    why: null,
    source: "manual",
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
 * commit phase handles that. Returns a typed envelope — on success,
 * either `{ ok: true, previewId }` (legacy single-call) or `{ ok:
 * true, jobId, previewId? }` (chunked path); on failure,
 * `{ ok: false, code, requestId }` so the UI renders the branded retry
 * state instead of letting the Vercel 504 reach the user. See
 * lib/plan-gen-result.ts.
 *
 * On the chunked path the orchestrator generates synchronously inside
 * this action call — it just persists per-phase state in
 * plan_generation_jobs as it goes, so a separately-polled status
 * action can show progress. The client routes to `/regen?job=<id>`
 * for chunked or `/regen?preview=<id>` for legacy.
 *
 * Discards any existing pending preview for this user first so at most
 * one is ever in flight (acceptance criterion #4 — no accumulation).
 */
export async function previewPlan(notes?: string): Promise<
  | {
      ok: true;
      previewId: number | null;
      jobId: number | null;
    }
  | PlanGenFailure
> {
  const today = getTodayISO();
  const { user } = await requireUser();

  const [{ race, otherRaces, history }, profile, journal, previousSummary] =
    await Promise.all([
      getRaceAndHistory(today),
      getAthleteProfile(),
      listJournalEntries(),
      getLatestAcceptedSummary(),
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

  // Phase 2.5.2 chunked path. Returns in ~50ms (single DB insert)
  // so the sheet closes immediately and the user lands on the
  // building page. The meta-plan call fires in the background via
  // GeneratingPhaseState's onMount → runMetaPlanForJob; the
  // per-phase loop then takes over.
  if (planChunkingEnabled()) {
    const precreate = await precreateGenerationJobHelper({
      user,
      trigger: "regen",
      notes: blankToNull(notes ?? ""),
    });
    if (!precreate.ok) {
      return {
        ok: false,
        code: precreate.code,
        requestId: precreate.requestId,
      };
    }
    return {
      ok: true,
      jobId: precreate.jobId,
      // previewId lands on the final advanceJob call after the last
      // phase commits.
      previewId: null,
    };
  }

  // Legacy single-call path. Catch generation failures and convert to
  // the typed envelope. Lets the client UI distinguish timeout /
  // validation / anthropic / unknown and render the appropriate
  // branded state. Everything else (auth, Supabase IO) still throws.
  let result;
  try {
    result = await generateTrainingPlan({
      race,
      otherRaces,
      profile,
      startDate: today,
      // history rows already carry planned_detail directly out of
      // getRaceAndHistory — formatStrengthActuals reads the structured
      // payload, no per-row decoration needed.
      history,
      notes: blankToNull(notes ?? ""),
      journalEntries: journalContext,
      previousSummary,
      isWizard: false,
    });
  } catch (err) {
    const code = classifyGenerationError(err);
    const requestId = makeRequestId();
    console.error(`[previewPlan] generation failed (code=${code}, req=${requestId})`, err);
    return { ok: false, code, requestId };
  }

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

  return { ok: true, previewId: attempt.data.id, jobId: null };
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
    // Generate a preview, then route the user to the regen preview
    // screen so they can review the diff before the plan changes. On
    // generation failure, route to /regen?error=<code>. On the
    // chunked path the orchestrator returns a jobId — route to
    // /regen?job=<id> so the user sees the per-phase progress UI;
    // the legacy path returns a previewId and we go straight to the
    // diff view.
    const r = await previewPlan();
    if (!r.ok) {
      redirect(`/regen?error=${r.code}&req=${r.requestId}`);
    }
    if (r.jobId) {
      redirect(`/regen?job=${r.jobId}`);
    }
    redirect(`/regen?preview=${r.previewId}`);
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

// Server-side validation of race payloads. Doubles as inline
// documentation of valid input ranges. The client form has lighter
// checks; this is the authoritative gate.
const RaceFormPayloadSchema = z.object({
  id: z.number().int().positive().optional(),
  priority: z.enum(["A", "B", "C", "completed"]),
  name: z.string().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  distance: z.string().min(1).max(40),
  elevationGain: z.number().int().min(0).max(20000).nullable(),
  terrain: z.enum(["trail", "road", "mixed", "technical"]).nullable(),
  targetTime: z.string().max(20),
  intent: z.enum(["competitive", "moderate", "relaxed"]).nullable(),
  elevationLoss: z.number().int().min(0).max(20000).nullable(),
  cutoffTime: z.string().max(20),
  climate: z.string().max(60),
  courseProfile: z.string().max(120),
  support: z.string().max(120),
});

// Inserts or updates a race row. Caller supplies an `id` to update; omit
// for an add. We `redirect` rather than revalidate so the form route
// returns the user to the race-calendar landing.
export async function saveRace(payload: RaceFormPayload) {
  const data = RaceFormPayloadSchema.parse(payload);
  const { user } = await requireUser();
  const row = {
    user_id: user.id,
    priority: data.priority,
    name: data.name.trim(),
    date: data.date,
    distance: data.distance.trim(),
    elevation_gain: data.elevationGain,
    terrain: data.terrain,
    target_time: blankToNull(data.targetTime),
    intent: data.intent,
    elevation_loss: data.elevationLoss,
    cutoff_time: blankToNull(data.cutoffTime),
    climate: blankToNull(data.climate),
    course_profile: blankToNull(data.courseProfile),
    support: blankToNull(data.support),
  };

  if (data.id) {
    const { error } = await supabaseAdmin
      .from("race")
      .update(row)
      .eq("id", data.id)
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

// Server-side validation for the athlete profile payload. The numeric
// bounds are deliberately generous — we're rejecting obvious garbage
// (NaN coercions, negatives where they make no sense, absurd values),
// not arguing with the athlete about their training volume.
const AthleteFormPayloadSchema = z.object({
  unitSystem: z.enum(["metric", "imperial"]),
  fitnessRating: z.number().int().min(1).max(5).nullable(),
  weeklyVolumeKm: z.number().min(0).max(500).nullable(),
  weeklyHoursCurrent: z.number().min(0).max(80).nullable(),
  weeklyHoursAvailable: z.number().min(0).max(80).nullable(),
  longestRunDistance: z.number().min(0).max(500).nullable(),
  longestRunDate: z.string().nullable(),
  yearsRunning: z.number().int().min(0).max(80).nullable(),
  yearsUltras: z.number().int().min(0).max(80).nullable(),
  ultrasCompleted: z.string().max(60),
  longestRaceDistance: z.number().min(0).max(1000).nullable(),
  longestRaceName: z.string().max(120),
  longestRaceDate: z.string().max(40),
  previousEndurance: z.array(z.string().max(60)).max(20),
  age: z.number().int().min(1).max(120).nullable(),
  bodyWeight: z.number().min(20).max(250).nullable(),
  sex: z.string().max(40),
  injuryNotes: z.string().max(2000),
  chronicConditions: z.string().max(2000),
  sleepHours: z.number().min(0).max(24).nullable(),
  stressBaseline: z.number().int().min(1).max(5).nullable(),
  trainingDays: z.array(z.string().max(8)).max(7),
  longRunDays: z.array(z.string().max(8)).max(7),
  qualityDays: z.array(z.string().max(8)).max(7),
  strengthFreq: z.string().max(40),
  timeOfDay: z.string().max(40),
  jobType: z.string().max(60),
  gymAccess: z.enum(["full", "limited", "none"]).nullable(),
  equipment: z.string().max(500),
  outdoorTerrain: z.array(z.string().max(60)).max(20),
  crossTrainingEnjoys: z.array(z.string().max(60)).max(20),
  maxHr: z.number().int().min(60).max(230).nullable(),
  restingHr: z.number().int().min(30).max(110).nullable(),
  lactateThresholdHr: z.number().int().min(60).max(230).nullable(),
  vo2Max: z.number().min(15).max(95).nullable(),
  trainingPreferences: z.string().max(2000),
  // Legacy free-text fields preserved so older rows don't lose data.
  experience: z.string().max(2000),
  easyPace: z.string().max(40),
  weeklyVolume: z.string().max(40),
  crossTraining: z.string().max(500),
  otherCommitments: z.string().max(2000),
  sleepStress: z.string().max(2000),
});

// Single-row upsert on athlete_profile keyed by user_id. We delete +
// insert so the row is fully replaced (avoids stale columns when
// fields are cleared back to null by the form).
export async function saveAthleteProfile(rawPayload: AthleteFormPayload) {
  const payload = AthleteFormPayloadSchema.parse(rawPayload);
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

// Preferences (theme, unit_system, notification toggles) used to live
// here as Server Actions. They moved to lib/preferences-client.ts
// (called from the browser) in polish-5 because Server Actions
// auto-refresh the RSC tree on every call — that cascade was the
// source of multi-second toggle latency in Profile. Reads still
// come from getAthleteProfile / the athlete_profile row directly.

// Finalises the intake wizard: replaces race rows + athlete_profile with
// the fresh inputs, then triggers the first plan generation. Caller is
// Wizard race input schema — one for the A race and each B/C race.
const WizardRaceSchema = z.object({
  priority: z.enum(["A", "B", "C"]),
  name: z.string().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  distance: z.string().min(1).max(40),
  elevationGain: z.number().int().min(0).max(20000).nullable(),
  terrain: z.enum(["trail", "road", "mixed", "technical"]).nullable(),
  targetTime: z.string().max(20),
  intent: z.enum(["competitive", "moderate", "relaxed"]).nullable(),
});

// Wizard payload schema — keep range bounds aligned with
// AthleteFormPayloadSchema so the validation surface is identical.
const WizardPayloadSchema = z.object({
  unitSystem: z.enum(["metric", "imperial"]),
  aRace: WizardRaceSchema,
  otherRaces: z.array(WizardRaceSchema).max(10),
  fitnessRating: z.number().int().min(1).max(5),
  weeklyVolumeKm: z.number().min(0).max(500).nullable(),
  weeklyHoursCurrent: z.number().min(0).max(80).nullable(),
  weeklyHoursAvailable: z.number().min(0).max(80).nullable(),
  longestRunDistance: z.number().min(0).max(500).nullable(),
  longestRunDate: z.string().nullable(),
  yearsRunning: z.number().int().min(0).max(80).nullable(),
  yearsUltras: z.number().int().min(0).max(80).nullable(),
  ultrasCompleted: z.string().max(60),
  longestRaceDistance: z.number().min(0).max(1000).nullable(),
  longestRaceName: z.string().max(120),
  longestRaceDate: z.string().max(40),
  age: z.number().int().min(1).max(120).nullable(),
  sex: z.string().max(40),
  bodyWeight: z.number().min(20).max(250).nullable(),
  injuryNotes: z.string().max(2000),
  chronicConditions: z.string().max(2000),
  sleepHours: z.number().min(0).max(24).nullable(),
  stressBaseline: z.number().int().min(1).max(5),
  trainingDays: z.array(z.string().max(8)).max(7),
  longRunDays: z.array(z.string().max(8)).max(7),
  qualityDays: z.array(z.string().max(8)).max(7),
  strengthFreq: z.string().max(40),
  gymAccess: z.enum(["full", "limited", "none"]).nullable(),
  equipment: z.array(z.string().max(60)).max(20),
  outdoorTerrain: z.array(z.string().max(60)).max(20),
  crossTrainingEnjoys: z.array(z.string().max(60)).max(20),
});

// expected to manage the post-submit UX (the wizard shows generating →
// done states inline), so we don't redirect here. Returns a typed
// envelope: legacy path resolves to { ok: true }, chunked path to
// { ok: true, jobId } so the wizard can transition to the per-phase
// progress UI and poll. Failures collapse into PlanGenFailure with a
// stable code so the wizard renders the branded retry state.
export async function submitWizard(
  rawData: WizardPayload,
): Promise<{ ok: true; jobId: number | null } | PlanGenFailure> {
  const data = WizardPayloadSchema.parse(rawData);
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
  const [{ race, otherRaces }, profile] = await Promise.all([
    getRaceAndHistory(today),
    getAthleteProfile(),
  ]);
  if (!race) throw new Error("No race configured.");
  if (!profile) throw new Error("No athlete profile configured.");

  // Phase 2.5.2 chunked path. Wizard returns in ~50ms so the
  // generating screen renders immediately. Meta-plan runs in the
  // background via GeneratingPhaseState's mount handler, and the
  // per-phase loop takes over from there.
  if (planChunkingEnabled()) {
    const precreate = await precreateGenerationJobHelper({
      user,
      trigger: "wizard",
      notes: null,
    });
    if (!precreate.ok) {
      return {
        ok: false,
        code: precreate.code,
        requestId: precreate.requestId,
      };
    }
    return { ok: true, jobId: precreate.jobId };
  }

  // Legacy single-call path. Wrap in try/catch so a 504 / Anthropic
  // failure / validation-after-retry surfaces the typed envelope and
  // the wizard renders the branded error state.
  let result;
  try {
    result = await generateTrainingPlan({
      race,
      otherRaces,
      profile,
      startDate: today,
      history: [],
      journalEntries: [],
      isWizard: true,
    });
  } catch (err) {
    const code = classifyGenerationError(err);
    const requestId = makeRequestId();
    console.error(`[submitWizard] generation failed (code=${code}, req=${requestId})`, err);
    return { ok: false, code, requestId };
  }

  // Commit via the same RPC the preview→commit path uses, so the initial
  // generation also gets atomic delete+insert semantics.
  const { error: rpcErr } = await supabaseAdmin.rpc("commit_plan_preview", {
    p_user_id: user.id,
    p_today: today,
    p_workouts: result.workouts,
  });
  if (rpcErr) throw rpcErr;

  revalidatePath("/");
  return { ok: true, jobId: null };
}

/**
 * Polling endpoint for the GeneratingPhaseState component. Returns
 * the current job's progress (status, completed phases, workout
 * count, optional previewId/failureCode). Called every 2 seconds by
 * the progress UI; cheap reads only, no Claude calls. RLS scopes to
 * own-row reads.
 */
export async function getGenerationJobStatus(
  jobId: number,
): Promise<JobStatusSnapshot | null> {
  const { user } = await requireUser();
  return getJobStatus(user.id, jobId);
}

/**
 * Phase 2.5.2 optimistic-routing entry point. Returns a jobId in
 * ~50ms (single DB insert) so the regen sheet / wizard can close
 * and route to the building page immediately. The slow meta-plan
 * call runs separately via `runMetaPlanForJob`, fired by
 * GeneratingPhaseState on mount. See PROJECT_BRIEF.md → Phase 2.5.2.
 */
export async function precreateGenerationJob(args: {
  trigger: "wizard" | "regen";
  notes?: string | null;
}): Promise<{ ok: true; jobId: number } | PlanGenFailure> {
  const { user } = await requireUser();
  const result = await precreateGenerationJobHelper({
    user,
    trigger: args.trigger,
    notes: args.notes,
  });
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      requestId: result.requestId,
    };
  }
  return { ok: true, jobId: result.jobId };
}

/**
 * Phase 2.5.2: runs the meta-plan call for an already-precreated
 * job. The building page fires this on mount when the job's status
 * is `kicking-off`; once it returns ok, the status is `pending` and
 * the advance loop takes over. Idempotent — safe under
 * React StrictMode double-mount.
 */
export async function runMetaPlanForJob(jobId: number): Promise<
  { ok: true } | PlanGenFailure
> {
  const today = getTodayISO();
  const { user } = await requireUser();
  const [{ race, otherRaces }, profile] = await Promise.all([
    getRaceAndHistory(today),
    getAthleteProfile(),
  ]);
  if (!race || !profile) {
    return {
      ok: false,
      code: "unknown",
      requestId: makeRequestId(),
    };
  }
  const result = await runMetaPlanForJobHelper({
    jobId,
    user,
    race,
    otherRaces,
    profile,
    startDate: today,
  });
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      requestId: result.requestId,
    };
  }
  return { ok: true };
}

/**
 * Phase 2.5.1: client-driven phase loop. Runs ONE phase per call,
 * then returns the updated job state so the caller can decide
 * whether to advance again. Idempotent — checks completed_phases
 * before running, so a double-click or React StrictMode double-mount
 * picks the NEXT pending phase rather than re-running the last one.
 *
 * Wall-clock budget per call: ~20-60s for a phase chunk; ~2s for the
 * finalize step. Both fit comfortably inside any function timeout.
 *
 * Returns:
 * - `{ ok: true, status: "pending", completedPhases }` after a phase
 *   chunk lands but more phases remain — client fires advanceJob again.
 * - `{ ok: true, status: "complete", completedPhases, previewId }`
 *   when the final phase committed. previewId is null on wizard
 *   trigger (direct commit), set on regen trigger (preview row).
 * - `PlanGenFailure & { jobId }` on any failure — the client routes
 *   to the branded error UX with a Resume CTA.
 */
export async function advanceJob(jobId: number): Promise<
  | {
      ok: true;
      status: "pending" | "complete";
      completedPhases: GenerationPhase[];
      // Phase 2.5.2: returned alongside completedPhases so
      // GeneratingPhaseState can skip the extra
      // getGenerationJobStatus refetch per phase. Reflects the
      // total workouts accumulated across all phases that have
      // landed (NOT just this phase's contribution).
      workoutCount: number;
      previewId: number | null;
    }
  | (PlanGenFailure & { jobId: number })
> {
  const today = getTodayISO();
  const { user } = await requireUser();

  // Load the job + the pipeline context the orchestrator helpers
  // need. Both reads happen unconditionally because a phase chunk
  // needs the full race/profile/history fan-in to build the prompt.
  const [job, raceData, profile, journal, previousSummary] = await Promise.all([
    loadJob(user.id, jobId),
    getRaceAndHistory(today),
    getAthleteProfile(),
    listJournalEntries(),
    getLatestAcceptedSummary(),
  ]);
  if (!job) {
    return {
      ok: false,
      code: "unknown",
      requestId: makeRequestId(),
      jobId,
    };
  }
  // Kicking-off jobs haven't received their meta-plan yet — the
  // client should call runMetaPlanForJob first. Surface a typed
  // failure rather than try to run a phase against an empty meta.
  if (job.status === "kicking-off") {
    return {
      ok: false,
      code: "unknown",
      requestId: makeRequestId(),
      jobId,
    };
  }
  // Reject if the job is in a terminal state. The client shouldn't
  // be calling advanceJob on a complete/cancelled job — but if it
  // does (e.g. stale tab, double-fire), we surface a typed failure
  // rather than re-running work.
  if (job.status === "complete") {
    return {
      ok: true,
      status: "complete",
      completedPhases: job.completed_phases,
      workoutCount: Array.isArray(job.partial_workouts)
        ? job.partial_workouts.length
        : 0,
      previewId: job.preview_id,
    };
  }
  if (job.status === "cancelled") {
    return {
      ok: false,
      code: "unknown",
      requestId: makeRequestId(),
      jobId,
    };
  }
  // Failed → flip back to pending so the Resume path's first
  // advanceJob picks up at the failed phase (or its successor if
  // failure_phase was already retried).
  if (job.status === "failed") {
    await reopenJobForResume(user.id, jobId);
  }

  if (!raceData.race || !profile) {
    return {
      ok: false,
      code: "unknown",
      requestId: makeRequestId(),
      jobId,
    };
  }

  const journalContext = journal.map((e) => ({
    type: e.type,
    entry_date: e.entry_date,
    title: e.title,
    body: e.body,
    details_lines: formatJournalDetails(e),
    consumed: e.consumed,
  }));
  const pipelineArgs = {
    user,
    race: raceData.race,
    otherRaces: raceData.otherRaces,
    profile,
    startDate: today,
    history: raceData.history,
    notes: job.notes ?? null,
    journalEntries: journalContext,
    previousSummary,
    trigger: job.trigger,
  } as const;

  // Pick the next pending phase: first entry in meta_plan.phases
  // whose name isn't already in completed_phases. Helper extracted
  // to lib/plan-generation-helpers.ts so the logic is unit-testable.
  const nextPhase = pickNextPhase(job.meta_plan, job.completed_phases);

  if (nextPhase) {
    const phaseResult = await runOnePhase({
      pipelineArgs,
      jobId,
      phase: nextPhase,
      metaPlan: job.meta_plan,
      completedPhases: job.completed_phases,
      partialWorkouts: job.partial_workouts,
    });
    if (!phaseResult.ok) {
      return {
        ok: false,
        code: phaseResult.code,
        requestId: phaseResult.requestId,
        jobId,
      };
    }
    // After a successful phase chunk, return "pending" so the client
    // fires one more advanceJob — that call sees no remaining phases
    // and runs the finalize step (assembled-plan validator + commit).
    // Cleaner than splitting the commit into the same call as the
    // last phase chunk; one call per discrete step.
    return {
      ok: true,
      status: "pending",
      completedPhases: phaseResult.completedPhases,
      workoutCount: phaseResult.workouts.length,
      previewId: null,
    };
  }

  // No pending phases left → run the finalize step. We need the
  // per-phase summaries to compose the regen summary, but we don't
  // persist them across advanceJob calls (each call is stateless).
  // For Phase 2.5.1 we synthesize a single combined summary from
  // the job's meta_plan + workouts; the explicit per-phase summary
  // arrays from each generatePhase call don't survive between
  // advanceJob calls, which is fine because the regen result page's
  // FROM YOUR COACH card uses meta_plan.meta_summary anyway.
  const finalize = await runFinalize({
    pipelineArgs,
    jobId,
    metaPlan: job.meta_plan,
    workouts: job.partial_workouts,
    summaries: [],
    completedPhases: job.completed_phases,
  });
  if (!finalize.ok) {
    return {
      ok: false,
      code: finalize.code,
      requestId: finalize.requestId,
      jobId,
    };
  }
  // Wizard's final commit publishes new workouts to the live plan —
  // bust the Today / Plan caches so the user lands on fresh data.
  if (job.trigger === "wizard") {
    revalidatePath("/");
    revalidatePath("/plan");
  }
  return {
    ok: true,
    status: "complete",
    completedPhases: job.completed_phases,
    workoutCount: Array.isArray(job.partial_workouts)
      ? job.partial_workouts.length
      : 0,
    previewId: finalize.previewId,
  };
}

/**
 * Resume a failed or pending generation job. Picks up at the first
 * phase not in `completed_phases`. The "Resume generation" CTA in the
 * friendly error UX (wizard + regen) calls this.
 */
export async function resumeGenerationJob(jobId: number): Promise<
  | {
      ok: true;
      jobId: number;
      previewId: number | null;
      trigger: "wizard" | "regen";
    }
  | PlanGenFailure
> {
  const { user } = await requireUser();

  // Phase 2.5.2 hotfix: resume used to call runGenerationPipeline
  // synchronously, which (a) blocked the action for the full ~4 min
  // pipeline runtime — the same problem 2.5.1 fixed for kickoff but
  // never applied to resume — and (b) on failure rebounded to the
  // same error URL with router.replace, producing no visible UI
  // change ("dead button"). Fix: just flip the job back to pending
  // and return. The client-side advance loop in GeneratingPhaseState
  // picks up at the failed phase via the existing /regen?job=<id>
  // path, retrying it under the same per-phase UX as a fresh regen.
  // No race/profile/history fetches needed here — advanceJob loads
  // the pipeline context itself.
  const status = await getJobStatus(user.id, jobId);
  if (!status) {
    return {
      ok: false,
      code: "unknown",
      requestId: makeRequestId(),
    };
  }

  await reopenJobForResume(user.id, jobId);
  if (status.trigger === "wizard") revalidatePath("/");
  return {
    ok: true,
    jobId,
    // previewId lands when the final advanceJob call commits — null
    // here because resumption only flips the status; the work happens
    // client-side via the advance loop.
    previewId: null,
    trigger: status.trigger,
  };
}

/**
 * True when the chunked-generation orchestrator should run instead of
 * the legacy single-call path. **On by default** as of the Phase 2.5
 * deploy. To roll back without a code change, set
 * `PLAN_CHUNKING_ENABLED=false` in Vercel → Project → Settings →
 * Environment Variables. The legacy single-call path stays in the
 * codebase until Phase 2.6 cleanup, so rollback is a single flag
 * flip — no redeploy. Documented in .env.example.
 */
function planChunkingEnabled(): boolean {
  return process.env.PLAN_CHUNKING_ENABLED !== "false";
}
