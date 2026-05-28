import "server-only";

// Server-to-server engine for advancing a chunked-generation job by one
// step (one phase, or the finalize step). Shared by:
//
//   1. The `advanceJob` server action (client-driven) — authenticates
//      the user via the session cookie, then delegates here with
//      `user.id` already validated.
//
//   2. The `/api/regen/advance` route handler — server-to-server
//      self-fetch fired by `after()` so the chain keeps progressing
//      even when the user has navigated away from the regen page.
//      Authenticated by a shared secret header, NOT a user session.
//
// Both callers also schedule the NEXT self-fetch via `after()` when
// this call leaves the job in a non-terminal state, so the chain
// self-drives across multiple Vercel function invocations (each
// getting its own 60s budget).
//
// All data reads here use `supabaseAdmin` so the route-handler caller
// (which has no session cookie) can still pull race/profile/journal
// context. The action caller could equivalently reuse its
// session-scoped helpers, but routing both paths through the same
// admin queries means the engine's behaviour is identical regardless
// of which surface invoked it.

import { revalidatePath } from "next/cache";
import {
  classifyGenerationError,
  makeRequestId,
  type PlanGenErrorCode,
} from "@/lib/plan-gen-result";
import {
  loadJob,
  reopenJobForResume,
  runFinalize,
  runOnePhase,
} from "@/lib/plan-generation-orchestrator";
import { pickNextPhase } from "@/lib/plan-generation-helpers";
import type { GenerationPhase } from "@/lib/plan-generation-types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AthleteProfile, Race } from "@/lib/plan";
import { formatJournalDetails, type JournalEntry } from "@/lib/journal";
import type { LoggedWorkout } from "@/lib/claude";
import type { GenerationSummary } from "@/lib/preview";
import { getTodayISO } from "@/lib/utils";

const RACE_COLUMNS =
  "id, name, distance, date, elevation_gain, terrain, target_time, intent, priority, elevation_loss, cutoff_time, climate, course_profile, support";
const PROFILE_COLUMNS =
  "unit_system, weekly_volume, longest_run_distance, easy_pace, injury_notes, experience, gym_access, equipment, weekly_hours, weekly_hours_current, cross_training, other_commitments, sleep_stress, fitness_rating, weekly_volume_km, longest_run_date, years_running, years_ultras, ultras_completed, longest_race_distance, longest_race_name, longest_race_date, previous_endurance, age, body_weight, sex, chronic_conditions, sleep_hours, stress_baseline, training_days, long_run_day, quality_day, long_run_days, quality_days, strength_freq, time_of_day, job_type, outdoor_terrain, cross_training_enjoys, max_hr, resting_hr, lactate_threshold_hr, vo2_max, training_preferences, theme, daily_reminder, regen_complete_notify, weekly_summary";
const JOURNAL_COLUMNS =
  "id, type, entry_date, title, body, details, consumed, created_at";

export type AdvanceJobEngineResult =
  | {
      ok: true;
      status: "pending" | "complete";
      completedPhases: GenerationPhase[];
      workoutCount: number;
      previewId: number | null;
      // True when the engine ran finalize for a wizard-trigger job —
      // both wrappers re-render Today / Plan so the new workouts land.
      revalidateHomeAndPlan: boolean;
      trigger: "wizard" | "regen";
    }
  | {
      ok: false;
      code: PlanGenErrorCode;
      requestId: string;
      jobId: number;
    };

/**
 * Runs the next step (phase or finalize) for `jobId` on behalf of
 * `userId`. Mirrors `advanceJob`'s body exactly so the action and the
 * self-fetch route handler reach the same orchestrator with the same
 * inputs.
 *
 * `today` is passed in (not computed here) so a route handler with a
 * stable request clock can match what the original action saw — keeps
 * the "tomorrow onwards" filter coherent for the lifetime of the chain.
 */
export async function runAdvanceJobEngine(args: {
  userId: string;
  jobId: number;
  today?: string;
}): Promise<AdvanceJobEngineResult> {
  const { userId, jobId } = args;
  const today = args.today ?? getTodayISO();

  // Load job + pipeline context in parallel. Same admin-scoped reads
  // the action would do via session-scoped helpers; here we filter on
  // user_id explicitly because there's no RLS to lean on.
  const [job, raceData, profile, journal, previousSummary] = await Promise.all([
    loadJob(userId, jobId),
    fetchRaceAndHistoryForUser(userId, today),
    fetchAthleteProfileForUser(userId),
    fetchJournalEntriesForUser(userId),
    fetchLatestAcceptedSummaryForUser(userId),
  ]);

  if (!job) {
    return { ok: false, code: "unknown", requestId: makeRequestId(), jobId };
  }

  // kicking-off jobs need runMetaPlanForJob to land the meta-plan
  // first. The self-drive loop doesn't restart that — the client owns
  // the precreate → meta path so a stalled meta call gets surfaced as
  // an error rather than silently retried server-side.
  if (job.status === "kicking-off") {
    return { ok: false, code: "unknown", requestId: makeRequestId(), jobId };
  }
  if (job.status === "complete") {
    return {
      ok: true,
      status: "complete",
      completedPhases: job.completed_phases,
      workoutCount: Array.isArray(job.partial_workouts)
        ? job.partial_workouts.length
        : 0,
      previewId: job.preview_id,
      revalidateHomeAndPlan: false,
      trigger: job.trigger,
    };
  }
  if (job.status === "cancelled") {
    return { ok: false, code: "unknown", requestId: makeRequestId(), jobId };
  }
  if (job.status === "failed") {
    // Resume path — flip back to pending so the orchestrator picks
    // up at the failed phase or its successor.
    await reopenJobForResume(userId, jobId);
  }

  if (!raceData.race || !profile) {
    return { ok: false, code: "unknown", requestId: makeRequestId(), jobId };
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
    user: { id: userId },
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

  const nextPhase = pickNextPhase(job.meta_plan, job.completed_phases);

  if (nextPhase) {
    try {
      const phaseResult = await runOnePhase({
        pipelineArgs,
        jobId,
        phase: nextPhase,
        metaPlan: job.meta_plan,
        completedPhases: job.completed_phases,
        partialWorkouts: job.partial_workouts,
        priorValidatorRetries: job.validator_retries,
        priorTokensIn: job.total_tokens_in ?? 0,
        priorTokensOut: job.total_tokens_out ?? 0,
      });
      if (!phaseResult.ok) {
        return {
          ok: false,
          code: phaseResult.code,
          requestId: phaseResult.requestId,
          jobId,
        };
      }
      return {
        ok: true,
        status: "pending",
        completedPhases: phaseResult.completedPhases,
        workoutCount: phaseResult.workouts.length,
        previewId: null,
        revalidateHomeAndPlan: false,
        trigger: job.trigger,
      };
    } catch (err) {
      // runOnePhase's own failure path marks the job failed; this
      // catch is for unexpected throws (network blips, malformed
      // pipelineArgs, etc.) so the chain doesn't silently die.
      return {
        ok: false,
        code: classifyGenerationError(err),
        requestId: makeRequestId(),
        jobId,
      };
    }
  }

  // No pending phases left → finalize. Wizard finalize commits
  // directly; regen finalize inserts a plan_previews row.
  try {
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
    return {
      ok: true,
      status: "complete",
      completedPhases: job.completed_phases,
      workoutCount: Array.isArray(job.partial_workouts)
        ? job.partial_workouts.length
        : 0,
      previewId: finalize.previewId,
      // Wizard finalize publishes workouts directly to the live plan
      // (no preview row). Flag the caller to bust the Today / Plan
      // caches so the user lands on the new plan immediately.
      revalidateHomeAndPlan: job.trigger === "wizard",
      trigger: job.trigger,
    };
  } catch (err) {
    return {
      ok: false,
      code: classifyGenerationError(err),
      requestId: makeRequestId(),
      jobId,
    };
  }
}

/**
 * Helper: both wrappers call this after a successful engine run when
 * the result still has more work to do. Fires an un-awaited self-fetch
 * to `/api/regen/advance` inside `after()` so the request survives
 * function-return and lands as a fresh Vercel invocation with its own
 * 60s budget. Errors are swallowed — the recovery layers (lazy
 * client-side watchdog + daily janitor cron) catch any chain that
 * silently dies. Without that fail-soft, a transient network blip
 * on the self-fetch would bubble back to the user's response.
 */
export async function scheduleSelfAdvance(jobId: number): Promise<void> {
  const baseUrl = process.env.SITE_URL;
  const secret = process.env.REGEN_ADVANCE_SECRET;
  if (!baseUrl || !secret) {
    // Logged once per request — the production deploy should have
    // both set. In dev without SITE_URL the client-driven loop still
    // works as before; the self-drive path is just inactive.
    console.warn(
      "[regen-advance-engine] SITE_URL or REGEN_ADVANCE_SECRET not set; self-drive disabled",
    );
    return;
  }
  await fetch(`${baseUrl}/api/regen/advance`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-regen-advance-secret": secret,
    },
    body: JSON.stringify({ jobId }),
  }).catch((err) => {
    console.error(
      `[regen-advance-engine] self-fetch failed jobId=${jobId} err=${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  });
}

/**
 * Applies side effects derived from an engine result that the engine
 * can't perform itself (revalidatePath needs a Next.js request
 * context). Called by both the action and the route AFTER the
 * response is shaped.
 */
export function applyPostAdvanceSideEffects(
  result: AdvanceJobEngineResult,
): void {
  if (!result.ok) return;
  if (result.revalidateHomeAndPlan) {
    revalidatePath("/");
    revalidatePath("/plan");
  }
}

// =============================================================
// Admin-scoped data fetches
// =============================================================
// These mirror the session-scoped helpers in lib/supabase/server.ts
// but use the service-role client + an explicit userId. RLS isn't
// available here, so the .eq("user_id", userId) filter is the only
// authorisation gate — every query MUST include it.

async function fetchAthleteProfileForUser(
  userId: string,
): Promise<AthleteProfile | null> {
  const { data, error } = await supabaseAdmin
    .from("athlete_profile")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle<AthleteProfile>();
  if (error) throw error;
  return data;
}

async function fetchRaceAndHistoryForUser(
  userId: string,
  beforeDate: string,
): Promise<{
  race: Race | null;
  otherRaces: Race[];
  history: LoggedWorkout[];
}> {
  const [racesResult, historyResult] = await Promise.all([
    supabaseAdmin
      .from("race")
      .select(RACE_COLUMNS)
      .eq("user_id", userId)
      .neq("priority", "completed")
      .order("priority", { ascending: true })
      .order("date", { ascending: true })
      .returns<Race[]>(),
    supabaseAdmin
      .from("workouts")
      .select(
        "date, kind, title, planned_detail, status, actual_duration_min, actual_distance_km, actual_elevation_gain_m, actual_hr_avg, actual_rpe, actual_notes, actual_detail",
      )
      .eq("user_id", userId)
      .lt("date", beforeDate)
      .order("date", { ascending: true })
      .order("position", { ascending: true })
      .returns<LoggedWorkout[]>(),
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

async function fetchJournalEntriesForUser(
  userId: string,
): Promise<JournalEntry[]> {
  const { data, error } = await supabaseAdmin
    .from("journal_entries")
    .select(JOURNAL_COLUMNS)
    .eq("user_id", userId)
    .order("entry_date", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return (data ?? []) as JournalEntry[];
}

async function fetchLatestAcceptedSummaryForUser(
  userId: string,
): Promise<GenerationSummary | null> {
  const { data, error } = await supabaseAdmin
    .from("plan_previews")
    .select("generation_summary")
    .eq("user_id", userId)
    .eq("status", "accepted")
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ generation_summary: GenerationSummary | null }>();
  if (error) throw error;
  return data?.generation_summary ?? null;
}

// Exported only for tests — keeps the admin-scoped fetches reachable
// from unit tests without forcing them through the runAdvanceJobEngine
// happy path (which needs a whole job row + meta-plan to exercise).
export const __testables = {
  fetchAthleteProfileForUser,
  fetchRaceAndHistoryForUser,
  fetchJournalEntriesForUser,
  fetchLatestAcceptedSummaryForUser,
};
