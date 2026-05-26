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
  // `meta_plan` may be the empty-shape `{ phases: [], meta_summary: "" }`
  // immediately after precreate (status='kicking-off') and before
  // runMetaPlanForJob has run. Phase-loop helpers should never see a
  // job in that state; advanceJob short-circuits on kicking-off.
  meta_plan: MetaPlan;
  completed_phases: GenerationPhase[];
  partial_workouts: GeneratedWorkout[];
  notes: string | null;
  preview_id: number | null;
  status: "kicking-off" | "pending" | "complete" | "failed" | "cancelled";
  failure_code: PlanGenErrorCode | null;
  failure_phase: GenerationPhase | "meta" | null;
  // Postgres timestamptz. Surfaced through JobStatusSnapshot so the
  // generating-screen timer can survive a page refresh — see B11.
  created_at: string;
}

const JOB_COLUMNS =
  "id, user_id, trigger, meta_plan, completed_phases, partial_workouts, notes, preview_id, status, failure_code, failure_phase, created_at";

// =============================================================
// Public helpers — the building blocks the action layer composes
// =============================================================

/**
 * Phase 2.5.2: fast precreate step. Single DB write (~50ms). Cancels
 * any prior pending/kicking-off job and inserts a new row with
 * `status: 'kicking-off'` and an empty meta-plan. Returns the jobId
 * so the client can route to /regen?job=<id> immediately — the
 * building page handles the kicking-off state with a "designing your
 * training arc" UI variant while the meta-plan call runs in the
 * background. See PROJECT_BRIEF.md → Phase 2.5.2.
 */
export async function precreateGenerationJob(args: {
  user: { id: string };
  trigger: "wizard" | "regen";
  notes?: string | null;
}): Promise<
  { ok: true; jobId: number } | RunGenerationFailure
> {
  await cancelAllPendingJobs(args.user.id);
  const insert = await supabaseAdmin
    .from("plan_generation_jobs")
    .insert({
      user_id: args.user.id,
      trigger: args.trigger,
      // Placeholder meta-plan — populated by runMetaPlanForJob below.
      // The empty-phases shape passes the column's NOT NULL constraint
      // while making it obvious the job hasn't designed its arc yet.
      meta_plan: { phases: [], meta_summary: "" },
      completed_phases: [],
      partial_workouts: [],
      notes: args.notes ?? null,
      status: "kicking-off" as const,
    })
    .select("id")
    .single();
  if (insert.error || !insert.data) {
    const requestId = makeRequestId();
    console.error(
      `[orchestrator] precreate insert failed (req=${requestId})`,
      insert.error,
    );
    return { ok: false, code: "unknown", requestId };
  }
  return { ok: true, jobId: insert.data.id };
}

/**
 * Phase 2.5.2: runs the meta-plan call for an already-precreated
 * job. Loads the row, calls generateMetaPlan with the trimmed
 * decision-relevant inputs, validates the result, and UPDATEs the
 * job row with the meta-plan + flips status to 'pending'. Idempotent
 * on a job that's already past 'kicking-off' — returns the existing
 * meta-plan without re-running the Claude call.
 *
 * Wall-clock budget: ~8-10s (down from ~15s pre-trim).
 */
export async function runMetaPlanForJob(args: {
  jobId: number;
  // Pipeline context needed by generateMetaPlan. The narrow subset
  // (race + profile + startDate) is all the meta-plan call uses; the
  // rest of the RunGenerationArgs fan-in is irrelevant here. The
  // action layer reconstitutes the pipeline args from DB reads when
  // it calls this helper.
  user: { id: string };
  race: Race;
  otherRaces?: Race[];
  profile: AthleteProfile;
  startDate: string;
}): Promise<
  { ok: true; metaPlan: MetaPlan } | RunGenerationFailure
> {
  // Idempotency: if the job already advanced past kicking-off,
  // return whatever meta-plan is on the row without re-running the
  // Claude call. Lets the client safely re-fire on remount.
  const row = await loadJob(args.user.id, args.jobId);
  if (!row) {
    return { ok: false, code: "unknown", requestId: makeRequestId() };
  }
  if (row.status !== "kicking-off") {
    return { ok: true, metaPlan: row.meta_plan };
  }

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
    // Mark the job failed so the friendly error UX can render the
    // Resume CTA — though resume on meta-plan-failure means re-running
    // the meta-plan, which is what runMetaPlanForJob does anyway.
    await markJobFailed(args.jobId, code, "meta", [], []);
    return { ok: false, code, requestId, jobId: args.jobId };
  }
  const enrichedMeta: MetaPlan = {
    ...metaPlan,
    phases: enrichPhaseWeeks(metaPlan.phases),
  };
  await supabaseAdmin
    .from("plan_generation_jobs")
    .update({
      meta_plan: enrichedMeta,
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.jobId)
    .eq("user_id", args.user.id);
  return { ok: true, metaPlan: enrichedMeta };
}

/**
 * Legacy single-call kickoff. Phase 2.5 shipped this; Phase 2.5.2
 * splits it into `precreateGenerationJob` + `runMetaPlanForJob` so
 * the client gets the jobId in ~50ms. This composition wrapper
 * stays callable so legacy synchronous-pipeline code paths
 * (resumeGenerationJob, runGenerationPipeline) keep working
 * unchanged. The fast-handoff path skips this wrapper entirely.
 */
export async function runKickoff(args: RunGenerationArgs): Promise<
  | { ok: true; jobId: number; metaPlan: MetaPlan }
  | RunGenerationFailure
> {
  const precreate = await precreateGenerationJob({
    user: args.user,
    trigger: args.trigger,
    notes: args.notes,
  });
  if (!precreate.ok) return precreate;
  const meta = await runMetaPlanForJob({
    jobId: precreate.jobId,
    user: args.user,
    race: args.race,
    otherRaces: args.otherRaces,
    profile: args.profile,
    startDate: args.startDate,
  });
  if (!meta.ok) {
    return { ...meta, jobId: precreate.jobId };
  }
  return { ok: true, jobId: precreate.jobId, metaPlan: meta.metaPlan };
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
  // Phase 2.5.2: forwards the SDK's cache fields so per-phase rows
  // include cache_read/creation counters for the prompt-cache audit.
  logPhaseMetrics({
    phase: phase.phase,
    workouts: phaseResult.workouts,
    durationMs: Date.now() - startedAt,
    isWizard: pipelineArgs.trigger === "wizard",
    tokensIn: phaseResult.usage.inputTokens,
    tokensOut: phaseResult.usage.outputTokens,
    cacheReadInputTokens: phaseResult.usage.cacheReadInputTokens,
    cacheCreationInputTokens: phaseResult.usage.cacheCreationInputTokens,
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
    // EDGE CASE: if the assembled-plan validator fails here (rare —
    // indicates an inter-phase gap that the per-phase validator
    // didn't catch), Resume from this point would re-run runFinalize
    // against the same workouts and fail the same way. The user
    // effectively needs a fresh regen, not a resume. Worth tracking
    // if we see this in production logs; the per-phase validators
    // should catch most gap cases before we reach here. Phase 2.5.1
    // code review surfaced this as a follow-up to document.
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
    createdAt: data.created_at,
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
  // Cancel anything not yet terminal — both `kicking-off` (Phase
  // 2.5.2 pre-meta state) and `pending` (post-meta, mid-phase loop).
  // A fast re-click during the precreate would otherwise orphan the
  // first row in `kicking-off` forever.
  const { error } = await supabaseAdmin
    .from("plan_generation_jobs")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .in("status", ["kicking-off", "pending"]);
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
// work — `phase` + `chunked: true` markers distinguish per-phase rows
// from full-plan rows. Phase 2.5.2: forwards token counts + cache
// fields from the Claude SDK so the prompt-cache audit can read
// per-phase reads/creations directly off the log lines.
function logPhaseMetrics(args: {
  phase: GenerationPhase;
  workouts: GeneratedWorkout[];
  durationMs: number;
  isWizard: boolean;
  tokensIn: number;
  tokensOut: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}): void {
  const metrics = buildPlanGenMetrics({
    tokensIn: args.tokensIn,
    tokensOut: args.tokensOut,
    cacheReadInputTokens: args.cacheReadInputTokens,
    cacheCreationInputTokens: args.cacheCreationInputTokens,
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
