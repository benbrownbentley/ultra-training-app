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
  // Instrumentation running totals. Each advanceJob call is stateless,
  // so the per-phase accumulators only survive on the row — runOnePhase
  // reads the prior value off here and writes the incremented value back.
  // `validator_retries` is NOT NULL default 0; the token totals are null
  // until the first phase lands.
  validator_retries: number;
  total_tokens_in: number | null;
  total_tokens_out: number | null;
}

const JOB_COLUMNS =
  "id, user_id, trigger, meta_plan, completed_phases, partial_workouts, notes, preview_id, status, failure_code, failure_phase, created_at, validator_retries, total_tokens_in, total_tokens_out";

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
  // Time the meta-plan Claude call so the summary line + meta_duration_ms
  // column can attribute wall-clock between the meta step and the phases.
  const metaStartedAt = Date.now();
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
    // Log the meta timing even on failure — a meta call that runs long
    // then errors is exactly the kind of thing the latency audit wants
    // to see. markJobFailed emits the per-job summary line afterwards.
    logMetaMetrics({ durationMs: Date.now() - metaStartedAt, ok: false });
    // Mark the job failed so the friendly error UX can render the
    // Resume CTA — though resume on meta-plan-failure means re-running
    // the meta-plan, which is what runMetaPlanForJob does anyway.
    await markJobFailed(args.jobId, code, "meta", [], []);
    return { ok: false, code, requestId, jobId: args.jobId };
  }
  const metaDurationMs = Date.now() - metaStartedAt;
  const enrichedMeta: MetaPlan = {
    ...metaPlan,
    phases: enrichPhaseWeeks(metaPlan.phases),
  };
  await supabaseAdmin
    .from("plan_generation_jobs")
    .update({
      meta_plan: enrichedMeta,
      status: "pending",
      // Persisted in the same write that flips status so the summary
      // line at finalize can read it back off the row.
      meta_duration_ms: metaDurationMs,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.jobId)
    .eq("user_id", args.user.id);
  // Emit alongside the per-phase metric lines so a single
  // [plan-gen-metrics] grep catches the meta call too. generateMetaPlan
  // doesn't surface usage today, so tokens are omitted (see TECH_DEBT).
  logMetaMetrics({ durationMs: metaDurationMs, ok: true });
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
  // Running totals carried on the job row (each advanceJob call is
  // stateless, so they don't survive in caller memory). runOnePhase
  // increments and writes them back, and returns the new cumulative
  // values so the legacy in-memory loop can thread them too.
  priorValidatorRetries: number;
  priorTokensIn: number;
  priorTokensOut: number;
}): Promise<
  | {
      ok: true;
      completedPhases: GenerationPhase[];
      workouts: GeneratedWorkout[];
      summary: GenerationSummary;
      validatorRetries: number;
      tokensIn: number;
      tokensOut: number;
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
    priorValidatorRetries,
    priorTokensIn,
    priorTokensOut,
  } = args;

  const phaseStartedAt = Date.now();
  const priorSummaries = buildPriorPhaseSummaries(
    metaPlan,
    completedPhases,
    partialWorkouts,
  );

  // Time the Claude call on its own so the per-phase line can separate
  // generation latency from the supabase write below.
  const claudeStartedAt = Date.now();
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
  const claudeDurationMs = Date.now() - claudeStartedAt;

  const nextWorkouts = [...partialWorkouts, ...phaseResult.workouts];
  const nextCompleted: GenerationPhase[] = [...completedPhases, phase.phase];
  const nextValidatorRetries = priorValidatorRetries + phaseResult.validatorRetries;
  const nextTokensIn = priorTokensIn + phaseResult.usage.inputTokens;
  const nextTokensOut = priorTokensOut + phaseResult.usage.outputTokens;

  // Time the DB write separately so the latency audit can rule it in or
  // out as a contributor (expected tiny, but worth confirming).
  const dbStartedAt = Date.now();
  await supabaseAdmin
    .from("plan_generation_jobs")
    .update({
      completed_phases: nextCompleted,
      partial_workouts: nextWorkouts,
      // Running totals live on the row — read prior off args, write the
      // incremented value here so the next stateless advanceJob call and
      // the finalize summary see the cumulative figure.
      validator_retries: nextValidatorRetries,
      total_tokens_in: nextTokensIn,
      total_tokens_out: nextTokensOut,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("user_id", pipelineArgs.user.id);
  const dbDurationMs = Date.now() - dbStartedAt;

  // Emit the per-phase metrics line. Stays at the orchestrator layer
  // so Phase 2.5.1's move to client-driven looping doesn't lose the
  // structured logging — the call site moved, the shape didn't.
  // Phase 2.5.2: forwards the SDK's cache fields so per-phase rows
  // include cache_read/creation counters for the prompt-cache audit.
  logPhaseMetrics({
    phase: phase.phase,
    workouts: phaseResult.workouts,
    durationMs: Date.now() - phaseStartedAt,
    claudeDurationMs,
    dbDurationMs,
    validatorRetries: phaseResult.validatorRetries,
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
    validatorRetries: nextValidatorRetries,
    tokensIn: nextTokensIn,
    tokensOut: nextTokensOut,
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
    await finalizeMetrics({ jobId, status: "complete", failureCode: null });
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
  await finalizeMetrics({ jobId, status: "complete", failureCode: null });
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
    // Seed the running totals from the row so a resumed job keeps
    // accumulating instead of resetting its retry/token counters.
    row.validator_retries,
    row.total_tokens_in ?? 0,
    row.total_tokens_out ?? 0,
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
  // Running totals seed for the in-memory loop. Fresh runs start at 0;
  // the resume path passes the values already on the row so the metrics
  // keep accumulating rather than resetting on resume.
  priorValidatorRetries = 0,
  priorTokensIn = 0,
  priorTokensOut = 0,
): Promise<RunGenerationResult> {
  const completedSet = new Set(completedPhases);
  let workouts = [...partialWorkouts];
  let completed = [...completedPhases];
  let validatorRetries = priorValidatorRetries;
  let tokensIn = priorTokensIn;
  let tokensOut = priorTokensOut;
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
      priorValidatorRetries: validatorRetries,
      priorTokensIn: tokensIn,
      priorTokensOut: tokensOut,
    });
    if (!phaseResult.ok) return phaseResult;
    workouts = phaseResult.workouts;
    completed = phaseResult.completedPhases;
    validatorRetries = phaseResult.validatorRetries;
    tokensIn = phaseResult.tokensIn;
    tokensOut = phaseResult.tokensOut;
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
  // Single failure writer for the pipeline, so this is the right place
  // to emit the terminal summary + total_duration_ms for every failure
  // path (meta, phase, finalize).
  await finalizeMetrics({ jobId, status: "failed", failureCode: code });
}

/**
 * Terminal-state instrumentation. Called once when a job reaches
 * `complete` (from runFinalize) or `failed` (from markJobFailed). Reads
 * the running totals straight off the row — they only exist there, since
 * advanceJob is stateless across calls — computes end-to-end wall-clock
 * from created_at, persists total_duration_ms, and emits the per-job
 * summary line the SQL queries read. The caller has already written
 * status / failure_code / completed_at; this only adds total_duration_ms,
 * so it doesn't clobber those.
 */
async function finalizeMetrics(args: {
  jobId: number;
  status: "complete" | "failed";
  failureCode: PlanGenErrorCode | null;
}): Promise<void> {
  const { data: row } = await supabaseAdmin
    .from("plan_generation_jobs")
    .select(
      "created_at, meta_duration_ms, validator_retries, total_tokens_in, total_tokens_out",
    )
    .eq("id", args.jobId)
    .single<{
      created_at: string;
      meta_duration_ms: number | null;
      validator_retries: number;
      total_tokens_in: number | null;
      total_tokens_out: number | null;
    }>();
  if (!row) return; // Defensive — the caller just wrote to this row.

  const totalDurationMs = Date.now() - new Date(row.created_at).getTime();

  await supabaseAdmin
    .from("plan_generation_jobs")
    .update({ total_duration_ms: totalDurationMs })
    .eq("id", args.jobId);

  // One terminal line per job. Same [plan-gen-metrics] prefix so any
  // grep that finds the phase rows finds the summary too.
  console.log(
    `[plan-gen-metrics] ${JSON.stringify({
      phase: "summary",
      status: args.status,
      failure_code: args.failureCode,
      total_duration_s: Math.round(totalDurationMs / 1000),
      meta_duration_s:
        row.meta_duration_ms != null
          ? Math.round(row.meta_duration_ms / 1000)
          : null,
      validator_retries: row.validator_retries,
      total_tokens_in: row.total_tokens_in,
      total_tokens_out: row.total_tokens_out,
    })}`,
  );
}

// Emits a [plan-gen-metrics] line for the meta-plan call. The meta call
// produces no workouts and (today) exposes no usage, so the shape is a
// stripped-down phase row: just the phase tag, duration, and ok flag.
// Same prefix so one grep catches meta + phases + summary.
function logMetaMetrics(args: { durationMs: number; ok: boolean }): void {
  console.log(
    `[plan-gen-metrics] ${JSON.stringify({
      phase: "meta",
      duration_s: Math.round(args.durationMs / 1000),
      ok: args.ok,
    })}`,
  );
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
  claudeDurationMs: number;
  dbDurationMs: number;
  validatorRetries: number;
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
    claudeDurationMs: args.claudeDurationMs,
    dbDurationMs: args.dbDurationMs,
    validatorRetries: args.validatorRetries,
    whys: args.workouts.map((w) => w.why ?? ""),
    isWizard: args.isWizard,
    // `retried` is derived from validatorRetries inside buildPlanGenMetrics.
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
