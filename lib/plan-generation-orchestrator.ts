import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  generateMetaPlan,
  generatePhase,
  type GeneratedWorkout,
  type GenerationSummary,
  type JournalContextEntry,
  type LoggedWorkout,
} from "@/lib/claude";
import type { AthleteProfile, Race } from "@/lib/plan";
import {
  classifyGenerationError,
  makeRequestId,
  type PlanGenErrorCode,
} from "@/lib/plan-gen-result";
import {
  enrichPhaseWeeks,
  enumerateDates,
  errorsOnly,
  validateGeneratedPlan,
} from "@/lib/plan-validation";
import type {
  GenerationPhase,
  JobStatusSnapshot,
  MetaPlan,
} from "@/lib/plan-generation-types";
import {
  buildPriorPhaseSummaries,
  combineSummaries,
} from "@/lib/plan-generation-helpers";

// Orchestrator for the Phase 2.5 chunked-generation pipeline. The two
// public entry points are runGenerationPipeline (wizard + regen call
// this) and getJobStatus (polling clients hit this every 2s).
//
// Design constraints (see CHUNKING_SPEC.md §3.6):
// - Idempotent per phase. Re-running a completed phase is wasteful
//   but not catastrophic; the orchestrator skips already-completed
//   phases by reading completed_phases off the job row.
// - Failure carries a typed code + requestId so the UI can render
//   code-specific copy. Mid-pipeline failures preserve completed
//   phases for the Resume path.
// - Wizard commits the assembled plan directly via commit_plan_preview.
//   Regen inserts a plan_previews row instead (preview-then-accept).

export interface RunGenerationArgs {
  user: { id: string };
  race: Race;
  otherRaces?: Race[];
  profile: AthleteProfile;
  startDate: string;
  history: LoggedWorkout[];
  journalEntries?: JournalContextEntry[];
  notes?: string | null;
  previousSummary?: GenerationSummary | null;
  trigger: "wizard" | "regen";
  // Resume support: when set, the orchestrator loads the existing job
  // row and resumes from completed_phases instead of starting fresh.
  resumeJobId?: number;
}

export type RunGenerationResult =
  | { ok: true; jobId: number; previewId: number | null }
  | {
      ok: false;
      code: PlanGenErrorCode;
      requestId: string;
      jobId?: number;
    };

interface JobRow {
  id: number;
  user_id: string;
  trigger: "wizard" | "regen";
  meta_plan: MetaPlan;
  completed_phases: GenerationPhase[];
  partial_workouts: GeneratedWorkout[];
  notes: string | null;
  preview_id: number | null;
  status: "pending" | "complete" | "failed" | "cancelled";
  failure_code: PlanGenErrorCode | null;
  failure_phase: GenerationPhase | "meta" | null;
}

const JOB_COLUMNS =
  "id, user_id, trigger, meta_plan, completed_phases, partial_workouts, notes, preview_id, status, failure_code, failure_phase";

/**
 * Entry point called by submitWizard / previewPlan when the
 * PLAN_CHUNKING_ENABLED feature flag is on. Returns a typed envelope
 * the action layer turns into a redirect (success) or branded error
 * UX (failure). See CHUNKING_SPEC.md §3.6.
 */
export async function runGenerationPipeline(
  args: RunGenerationArgs,
): Promise<RunGenerationResult> {
  // Resume branch: pick up an existing pending job.
  if (typeof args.resumeJobId === "number") {
    return resumeJob(args, args.resumeJobId);
  }
  // Fresh-start branch.
  return startFreshJob(args);
}

// ----- Fresh start ------------------------------------------------

async function startFreshJob(
  args: RunGenerationArgs,
): Promise<RunGenerationResult> {
  // 1. Cancel any prior pending job for this user. Same defense-in-
  //    depth pattern as plan_previews — at most one pending job at a
  //    time per user. Done before the meta-plan call so a fast-clicker
  //    can't end up with two pending rows even briefly.
  await cancelAllPendingJobs(args.user.id);

  // 2. Meta-plan call.
  let metaPlan: MetaPlan;
  try {
    metaPlan = await generateMetaPlan({
      race: args.race,
      otherRaces: args.otherRaces,
      profile: args.profile,
      startDate: args.startDate,
    });
  } catch (err) {
    const code = classifyGenerationError(err);
    const requestId = makeRequestId();
    console.error(
      `[orchestrator] meta-plan failed (code=${code}, req=${requestId})`,
      err,
    );
    return { ok: false, code, requestId };
  }
  // Normalise + enrich the meta-plan so downstream readers see the
  // weeks count baked in.
  const enrichedMeta: MetaPlan = {
    ...metaPlan,
    phases: enrichPhaseWeeks(metaPlan.phases),
  };

  // 3. Insert the job row.
  const insert = await supabaseAdmin
    .from("plan_generation_jobs")
    .insert({
      user_id: args.user.id,
      trigger: args.trigger,
      meta_plan: enrichedMeta,
      completed_phases: [],
      partial_workouts: [],
      notes: args.notes ?? null,
      status: "pending" as const,
    })
    .select("id")
    .single();
  if (insert.error || !insert.data) {
    const requestId = makeRequestId();
    console.error(
      `[orchestrator] failed to insert job row (req=${requestId})`,
      insert.error,
    );
    return { ok: false, code: "unknown", requestId };
  }
  const jobId = insert.data.id;
  return runPhasesAndCommit(args, jobId, enrichedMeta, [], []);
}

// ----- Resume ------------------------------------------------------

async function resumeJob(
  args: RunGenerationArgs,
  jobId: number,
): Promise<RunGenerationResult> {
  const { data: row, error } = await supabaseAdmin
    .from("plan_generation_jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .eq("user_id", args.user.id)
    .maybeSingle<JobRow>();
  if (error || !row) {
    const requestId = makeRequestId();
    console.error(
      `[orchestrator] resume: job ${jobId} not found (req=${requestId})`,
      error,
    );
    return { ok: false, code: "unknown", requestId };
  }
  // Only pending and failed jobs can be resumed. A completed job has
  // already committed; a cancelled job was deliberately superseded.
  if (row.status !== "pending" && row.status !== "failed") {
    const requestId = makeRequestId();
    return { ok: false, code: "unknown", requestId, jobId };
  }
  // Flip back to pending so polling clients see "generating" again.
  await supabaseAdmin
    .from("plan_generation_jobs")
    .update({
      status: "pending",
      failure_code: null,
      failure_phase: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("user_id", args.user.id);
  return runPhasesAndCommit(
    args,
    jobId,
    row.meta_plan,
    row.completed_phases,
    row.partial_workouts,
  );
}

// ----- Shared phase loop + commit ---------------------------------

async function runPhasesAndCommit(
  args: RunGenerationArgs,
  jobId: number,
  metaPlan: MetaPlan,
  completedPhases: GenerationPhase[],
  partialWorkouts: GeneratedWorkout[],
): Promise<RunGenerationResult> {
  const completedSet = new Set(completedPhases);
  // Working buffers — accumulate as each phase lands.
  const workouts: GeneratedWorkout[] = [...partialWorkouts];
  const summaries: GenerationSummary[] = []; // current-run summaries only

  for (const phase of metaPlan.phases) {
    if (completedSet.has(phase.phase)) continue;

    const priorSummaries = buildPriorPhaseSummaries(
      metaPlan,
      completedPhases,
      workouts,
    );

    let phaseResult;
    try {
      phaseResult = await generatePhase({
        race: args.race,
        otherRaces: args.otherRaces,
        profile: args.profile,
        startDate: args.startDate,
        history: args.history,
        notes: args.notes,
        journalEntries: args.journalEntries,
        previousSummary: args.previousSummary,
        isWizard: args.trigger === "wizard",
        phase,
        metaPlan,
        priorPhaseSummaries: priorSummaries,
      });
    } catch (err) {
      const code = classifyGenerationError(err);
      const requestId = makeRequestId();
      console.error(
        `[orchestrator] phase ${phase.phase} failed (code=${code}, req=${requestId})`,
        err,
      );
      await markJobFailed(jobId, code, phase.phase, workouts, completedPhases);
      return { ok: false, code, requestId, jobId };
    }

    workouts.push(...phaseResult.workouts);
    completedPhases.push(phase.phase);
    completedSet.add(phase.phase);
    summaries.push(phaseResult.summary);
    await supabaseAdmin
      .from("plan_generation_jobs")
      .update({
        completed_phases: completedPhases,
        partial_workouts: workouts,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("user_id", args.user.id);
  }

  // Final validation across the assembled plan. Catches inter-phase
  // gaps that the per-phase validator can't see (e.g., a missing
  // race-day run when TAPER's last date is race day but Claude
  // emitted a mobility there instead of a run).
  const finalIssues = validateGeneratedPlan({
    workouts,
    startDate: args.startDate,
    raceDate: args.race.date,
  });
  const finalErrors = errorsOnly(finalIssues);
  if (finalErrors.length > 0) {
    const requestId = makeRequestId();
    console.warn(
      `[orchestrator] assembled-plan validation failed (req=${requestId})`,
      finalErrors.map((e) => e.code),
    );
    await markJobFailed(
      jobId,
      "validation_failed",
      null,
      workouts,
      completedPhases,
    );
    return { ok: false, code: "validation_failed", requestId, jobId };
  }

  // Commit step. Wizard → direct commit via RPC. Regen → insert a
  // plan_previews row so the user can review before accepting.
  const assembledSummary = combineSummaries(metaPlan, summaries);
  if (args.trigger === "wizard") {
    const { error: rpcErr } = await supabaseAdmin.rpc("commit_plan_preview", {
      p_user_id: args.user.id,
      p_today: args.startDate,
      p_workouts: workouts,
    });
    if (rpcErr) {
      const requestId = makeRequestId();
      console.error(
        `[orchestrator] commit_plan_preview RPC failed (req=${requestId})`,
        rpcErr,
      );
      await markJobFailed(
        jobId,
        "unknown",
        null,
        workouts,
        completedPhases,
      );
      return { ok: false, code: "unknown", requestId, jobId };
    }
    await supabaseAdmin
      .from("plan_generation_jobs")
      .update({
        status: "complete",
        partial_workouts: workouts,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("user_id", args.user.id);
    return { ok: true, jobId, previewId: null };
  }

  // Regen: insert plan_previews row (status: pending). The regen page
  // diffs it against the live plan; accept moves it to status: accepted.
  // Discard any prior pending preview first — mirror previewPlan's
  // single-pending invariant.
  await supabaseAdmin
    .from("plan_previews")
    .update({ status: "discarded", decided_at: new Date().toISOString() })
    .eq("user_id", args.user.id)
    .eq("status", "pending");
  const previewInsert = await supabaseAdmin
    .from("plan_previews")
    .insert({
      user_id: args.user.id,
      workouts: workouts.filter((w) => w.date >= args.startDate),
      notes: args.notes ?? null,
      generation_summary: assembledSummary,
      status: "pending" as const,
    })
    .select("id")
    .single();
  if (previewInsert.error || !previewInsert.data) {
    const requestId = makeRequestId();
    console.error(
      `[orchestrator] preview insert failed (req=${requestId})`,
      previewInsert.error,
    );
    await markJobFailed(
      jobId,
      "unknown",
      null,
      workouts,
      completedPhases,
    );
    return { ok: false, code: "unknown", requestId, jobId };
  }
  const previewId = previewInsert.data.id;
  await supabaseAdmin
    .from("plan_generation_jobs")
    .update({
      status: "complete",
      partial_workouts: workouts,
      preview_id: previewId,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("user_id", args.user.id);
  return { ok: true, jobId, previewId };
}

// ----- Job-status read for polling --------------------------------

/**
 * Returns the polling snapshot the UI uses to drive the progress
 * state machine. RLS scopes to own-row reads; cross-user attempts
 * return null. Lightweight — only the user-visible subset of the
 * row, no Claude-internal raw content.
 */
export async function getJobStatus(
  userId: string,
  jobId: number,
): Promise<JobStatusSnapshot | null> {
  const { data, error } = await supabaseAdmin
    .from("plan_generation_jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle<JobRow>();
  if (error || !data) return null;
  return {
    jobId: data.id,
    status: data.status,
    trigger: data.trigger,
    metaPlan: data.meta_plan,
    completedPhases: data.completed_phases,
    workoutCount: Array.isArray(data.partial_workouts)
      ? data.partial_workouts.length
      : 0,
    previewId: data.preview_id,
    failureCode: data.failure_code,
    failurePhase: data.failure_phase,
  };
}

// ----- Internal helpers -------------------------------------------

async function cancelAllPendingJobs(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("plan_generation_jobs")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("status", "pending");
  // Soft-warn on failure — cancelling prior jobs is best-effort.
  if (error) {
    console.warn("[orchestrator] cancelAllPendingJobs failed:", error);
  }
}

async function markJobFailed(
  jobId: number,
  code: PlanGenErrorCode,
  phase: GenerationPhase | "meta" | null,
  partialWorkouts: GeneratedWorkout[],
  completedPhases: GenerationPhase[],
): Promise<void> {
  await supabaseAdmin
    .from("plan_generation_jobs")
    .update({
      status: "failed",
      failure_code: code,
      failure_phase: phase,
      partial_workouts: partialWorkouts,
      completed_phases: completedPhases,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

// Re-exports for the action layer so callers don't need to import
// from multiple files.
export type { PhaseSummaryForPrompt } from "@/lib/plan-generation-types";

// Defensive: enumerateDates pulled in for completeness in case the
// orchestrator grows a date-range computation later. Currently unused
// directly here — kept off the export surface.
void enumerateDates;
