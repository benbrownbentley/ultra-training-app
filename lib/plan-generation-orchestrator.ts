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
import { buildPlanGenMetrics } from "@/lib/plan-gen-metrics";
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
  PhaseMetadata,
} from "@/lib/plan-generation-types";
import {
  buildPriorPhaseSummaries,
  combineSummaries,
} from "@/lib/plan-generation-helpers";

// Orchestrator for the chunked-generation pipeline. Phase 2.5 shipped
// this as a single synchronous pipeline (`runGenerationPipeline`);
// Phase 2.5.1 splits the loop so the server actions return after the
// fast meta-plan step (~10s) and the client drives each subsequent
// phase via `advanceJob`. The pure helpers `runKickoff`,
// `runOnePhase`, and `runFinalize` are the building blocks both
// paths share — the legacy composition (`runGenerationPipeline`)
// stays callable for any code still on the synchronous-orchestrator
// API surface.
//
// Design constraints (see CHUNKING_SPEC.md §3.6 + PHASE_2_5_1_SPEC.md):
// - Per-phase idempotency. `advanceJob` checks `completed_phases`
//   before running, so React StrictMode double-mount or accidental
//   double-clicks don't double-emit a phase.
// - Failure preserves work. Mid-pipeline failures leave
//   `completed_phases` + `partial_workouts` intact so the Resume
//   path picks up at the failed phase, not from scratch.
// - Wizard commits directly via commit_plan_preview RPC. Regen
//   inserts a plan_previews row so the user can review the diff.

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
  | RunGenerationFailure;

export interface RunGenerationFailure {
  ok: false;
  code: PlanGenErrorCode;
  requestId: string;
  jobId?: number;
}

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

// =============================================================
// Public helpers — the building blocks the action layer composes
// =============================================================

/**
 * Step 0 of the chunked pipeline. Cancels any pending job for this
 * user, runs the meta-plan call, validates it, and inserts a new
 * `plan_generation_jobs` row. Returns the new jobId so the client
 * can route to /regen?job=<id> and start the advance loop.
 *
 * Wall-clock budget: ~10-15s. The fast handoff that makes the
 * progress UI feel responsive (Phase 2.5.1).
 */
export async function runKickoff(args: RunGenerationArgs): Promise<
  | { ok: true; jobId: number; metaPlan: MetaPlan }
  | RunGenerationFailure
> {
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
  // Normalise + enrich so downstream readers see weeks counts.
  const enrichedMeta: MetaPlan = {
    ...metaPlan,
    phases: enrichPhaseWeeks(metaPlan.phases),
  };

  // 3. Insert the job row. partial_workouts + completed_phases start
  //    empty; the advance loop populates them per phase.
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
  return { ok: true, jobId: insert.data.id, metaPlan: enrichedMeta };
}

/**
 * One iteration of the per-phase generation loop. Called once per
 * phase from `advanceJob`. The function:
 *
 * 1. Builds prior-phase summaries from the running workouts buffer.
 * 2. Calls `generatePhase` with the bounded date window.
 * 3. Appends emitted workouts + summary to the accumulators.
 * 4. UPDATEs the job row with the new completed_phases + partial.
 * 5. Emits the per-phase `[plan-gen-metrics]` log line.
 *
 * On failure, marks the job failed (preserving prior-phase work) so
 * the Resume path can pick up at this phase. Returns the failure
 * envelope including jobId for the client's error UX.
 */
export async function runOnePhase(args: {
  pipelineArgs: RunGenerationArgs;
  jobId: number;
  phase: PhaseMetadata;
  metaPlan: MetaPlan;
  completedPhases: GenerationPhase[];
  partialWorkouts: GeneratedWorkout[];
}): Promise<
  | {
      ok: true;
      completedPhases: GenerationPhase[];
      workouts: GeneratedWorkout[];
      summary: GenerationSummary;
    }
  | RunGenerationFailure
> {
  const {
    pipelineArgs,
    jobId,
    phase,
    metaPlan,
    completedPhases,
    partialWorkouts,
  } = args;

  const startedAt = Date.now();
  const priorSummaries = buildPriorPhaseSummaries(
    metaPlan,
    completedPhases,
    partialWorkouts,
  );

  let phaseResult;
  try {
    phaseResult = await generatePhase({
      race: pipelineArgs.race,
      otherRaces: pipelineArgs.otherRaces,
      profile: pipelineArgs.profile,
      startDate: pipelineArgs.startDate,
      history: pipelineArgs.history,
      notes: pipelineArgs.notes,
      journalEntries: pipelineArgs.journalEntries,
      previousSummary: pipelineArgs.previousSummary,
      isWizard: pipelineArgs.trigger === "wizard",
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
    await markJobFailed(
      jobId,
      code,
      phase.phase,
      partialWorkouts,
      completedPhases,
    );
    return { ok: false, code, requestId, jobId };
  }

  const nextWorkouts = [...partialWorkouts, ...phaseResult.workouts];
  const nextCompleted: GenerationPhase[] = [...completedPhases, phase.phase];

  await supabaseAdmin
    .from("plan_generation_jobs")
    .update({
      completed_phases: nextCompleted,
      partial_workouts: nextWorkouts,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("user_id", pipelineArgs.user.id);

  // Emit the per-phase metrics line. Stays at the orchestrator layer
  // so Phase 2.5.1's move to client-driven looping doesn't lose the
  // structured logging — the call site moved, the shape didn't.
  logPhaseMetrics({
    phase: phase.phase,
    workouts: phaseResult.workouts,
    durationMs: Date.now() - startedAt,
    isWizard: pipelineArgs.trigger === "wizard",
  });

  return {
    ok: true,
    completedPhases: nextCompleted,
    workouts: nextWorkouts,
    summary: phaseResult.summary,
  };
}

/**
 * Final step of the pipeline. Called once after every phase has
 * landed. Runs the assembled-plan validator (catches inter-phase
 * gaps that the per-phase validator can't see) and then commits:
 *
 * - Wizard runs commit via `commit_plan_preview` RPC directly.
 * - Regen inserts a `plan_previews` row so the user reviews a diff.
 *
 * Marks the job complete on success. On validator failure, marks
 * the job failed with code='validation_failed' so the Resume path
 * is available (rare but real — usually means a phase boundary
 * missed race day).
 */
export async function runFinalize(args: {
  pipelineArgs: RunGenerationArgs;
  jobId: number;
  metaPlan: MetaPlan;
  workouts: GeneratedWorkout[];
  summaries: GenerationSummary[];
  completedPhases: GenerationPhase[];
}): Promise<
  { ok: true; previewId: number | null } | RunGenerationFailure
> {
  const {
    pipelineArgs,
    jobId,
    metaPlan,
    workouts,
    summaries,
    completedPhases,
  } = args;

  // Inter-phase gap check.
  const finalIssues = validateGeneratedPlan({
    workouts,
    startDate: pipelineArgs.startDate,
    raceDate: pipelineArgs.race.date,
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

  const assembledSummary = combineSummaries(metaPlan, summaries);

  if (pipelineArgs.trigger === "wizard") {
    const { error: rpcErr } = await supabaseAdmin.rpc("commit_plan_preview", {
      p_user_id: pipelineArgs.user.id,
      p_today: pipelineArgs.startDate,
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
      .eq("user_id", pipelineArgs.user.id);
    return { ok: true, previewId: null };
  }

  // Regen path. Discard any prior pending preview so the unique
  // partial index doesn't trip on the new insert.
  await supabaseAdmin
    .from("plan_previews")
    .update({ status: "discarded", decided_at: new Date().toISOString() })
    .eq("user_id", pipelineArgs.user.id)
    .eq("status", "pending");
  const previewInsert = await supabaseAdmin
    .from("plan_previews")
    .insert({
      user_id: pipelineArgs.user.id,
      workouts: workouts.filter((w) => w.date >= pipelineArgs.startDate),
      notes: pipelineArgs.notes ?? null,
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
    .eq("user_id", pipelineArgs.user.id);
  return { ok: true, previewId };
}

// =============================================================
// Legacy composition path — kept reachable for backwards compat
// and tests that exercise the synchronous pipeline shape.
// =============================================================

/**
 * Legacy entry point. Runs the full pipeline synchronously inside
 * the action that called it — Phase 2.5's original shape. Phase
 * 2.5.1 callers (previewPlan / submitWizard) call `runKickoff`
 * directly and let the client drive the per-phase loop via
 * `advanceJob`, but this function stays in place because:
 *
 * - Existing orchestrator tests exercise the composed pipeline.
 * - The resume path's "kick off resumption" can short-circuit
 *   to a single call when the caller doesn't want to manage the
 *   loop themselves (currently only `resumeGenerationJob` action).
 */
export async function runGenerationPipeline(
  args: RunGenerationArgs,
): Promise<RunGenerationResult> {
  if (typeof args.resumeJobId === "number") {
    return resumeJobLegacy(args, args.resumeJobId);
  }
  const kickoff = await runKickoff(args);
  if (!kickoff.ok) return kickoff;
  return runPhasesAndCommit(args, kickoff.jobId, kickoff.metaPlan, [], []);
}

async function resumeJobLegacy(
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
  if (row.status !== "pending" && row.status !== "failed") {
    const requestId = makeRequestId();
    return { ok: false, code: "unknown", requestId, jobId };
  }
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

/**
 * Legacy phase loop. Composes `runOnePhase` for each remaining phase
 * then `runFinalize` — same behavior as Phase 2.5 with all the work
 * inside one server-action invocation. Kept for the resume action
 * and existing test coverage; new code (Phase 2.5.1 forward) calls
 * `runOnePhase` directly via `advanceJob`.
 */
export async function runPhasesAndCommit(
  args: RunGenerationArgs,
  jobId: number,
  metaPlan: MetaPlan,
  completedPhases: GenerationPhase[],
  partialWorkouts: GeneratedWorkout[],
): Promise<RunGenerationResult> {
  const completedSet = new Set(completedPhases);
  let workouts = [...partialWorkouts];
  let completed = [...completedPhases];
  const summaries: GenerationSummary[] = [];

  for (const phase of metaPlan.phases) {
    if (completedSet.has(phase.phase)) continue;
    const phaseResult = await runOnePhase({
      pipelineArgs: args,
      jobId,
      phase,
      metaPlan,
      completedPhases: completed,
      partialWorkouts: workouts,
    });
    if (!phaseResult.ok) return phaseResult;
    workouts = phaseResult.workouts;
    completed = phaseResult.completedPhases;
    completedSet.add(phase.phase);
    summaries.push(phaseResult.summary);
  }

  const finalize = await runFinalize({
    pipelineArgs: args,
    jobId,
    metaPlan,
    workouts,
    summaries,
    completedPhases: completed,
  });
  if (!finalize.ok) return finalize;
  return { ok: true, jobId, previewId: finalize.previewId };
}

// =============================================================
// Public reads
// =============================================================

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

/**
 * Reads the full job row including meta_plan + completed_phases +
 * partial_workouts. Used by `advanceJob` (which needs to pick the
 * next pending phase and pass the running accumulators into
 * `runOnePhase`) and the resume path. RLS-scoped.
 */
export async function loadJob(
  userId: string,
  jobId: number,
): Promise<JobRow | null> {
  const { data, error } = await supabaseAdmin
    .from("plan_generation_jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle<JobRow>();
  if (error || !data) return null;
  return data;
}

/**
 * Flips a job's status back to `pending` and clears the failure
 * fields. Called by `advanceJob` when the caller's resuming a
 * previously-failed job. Keeps the job's `completed_phases` and
 * `partial_workouts` intact so the resume picks up at the failed
 * phase.
 */
export async function reopenJobForResume(
  userId: string,
  jobId: number,
): Promise<void> {
  await supabaseAdmin
    .from("plan_generation_jobs")
    .update({
      status: "pending",
      failure_code: null,
      failure_phase: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("user_id", userId);
}

// =============================================================
// Internal helpers
// =============================================================

async function cancelAllPendingJobs(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("plan_generation_jobs")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("status", "pending");
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

// Emits a [plan-gen-metrics] line per phase chunk. Same shape as the
// legacy generateTrainingPlan emission so Vercel-log greps still
// work — the only change is `phase` + `chunked: true` markers so
// per-phase rows can be distinguished from full-plan rows in logs.
function logPhaseMetrics(args: {
  phase: GenerationPhase;
  workouts: GeneratedWorkout[];
  durationMs: number;
  isWizard: boolean;
}): void {
  // tokens_in / tokens_out aren't accumulated at this layer — the
  // SDK call lives inside generatePhase. We pass 0/0; the per-phase
  // duration + workout count + why distribution carry the load.
  // Downstream metric scripts already tolerate zeros (see Phase 2.1
  // distribution test fixtures).
  const metrics = buildPlanGenMetrics({
    tokensIn: 0,
    tokensOut: 0,
    durationMs: args.durationMs,
    whys: args.workouts.map((w) => w.why ?? ""),
    isWizard: args.isWizard,
    retried: false,
  });
  console.log(
    `[plan-gen-metrics] ${JSON.stringify({
      ...metrics,
      phase: args.phase,
      chunked: true,
    })}`,
  );
}

// Re-exports for the action layer so callers don't need to import
// from multiple files.
export type { PhaseSummaryForPrompt } from "@/lib/plan-generation-types";

// Defensive: enumerateDates pulled in for completeness in case the
// orchestrator grows a date-range computation later. Currently unused
// directly here — kept off the export surface.
void enumerateDates;
