// Banner state derivation + server-side hydration helper for the
// global RegenStatusBanner. The banner is the v2 "where is my regen?"
// surface — see PROJECT_BRIEF.md → "Regen async + notification UX
// (2026-05-28)" for why this replaces the standalone /regen page as
// the primary in-app indicator.
//
// `bannerStateFromRow` is the pure mapping job-row → banner state.
// Server initial render and client Realtime updates both route
// through it so the two paths can never disagree about how a given
// row should render.
//
// `getBannerStateForUser` is the server-only initial-state fetch
// called by the root layout. Reads the user's most-recent regen-
// trigger job; wizard-trigger jobs are excluded because wizard
// finalize publishes workouts directly to the live plan — there's no
// preview to review, so the banner has nothing to surface for them.

import type {
  GenerationPhase,
  MetaPlan,
} from "@/lib/plan-generation-types";
import type { PlanGenErrorCode } from "@/lib/plan-gen-result";

export type BannerKind = "idle" | "in_progress" | "ready" | "error";

export interface BannerState {
  kind: BannerKind;
  jobId: number | null;
  previewId: number | null;
  // 1-based index of the phase currently in flight (or "all done"
  // when the chain is in the finalize step). Null in idle/error.
  phaseIndex: number | null;
  phaseTotal: number | null;
  // Human-readable label for the current phase, capitalised. Null on
  // finalize (no specific phase) and on idle/error.
  phaseLabel: string | null;
  // Failure code so the banner can pick a copy variant for the error
  // state. Null off the error branch.
  failureCode: PlanGenErrorCode | null;
  // notes captured on the failed regen so the retry can re-fire
  // previewPlan with the same input.
  failedNotes: string | null;
  // ISO timestamp of the job row's last update. Used by the lazy
  // watchdog (RegenStatusProvider) to detect chains that have gone
  // silent — if state is in_progress and lastUpdatedAt is older than
  // ~3 min, fire a resume so the chain picks up where it died. Null
  // off the in-flight branches.
  lastUpdatedAt: string | null;
}

/**
 * Shape of the data we read for derivation. Defined explicitly so
 * tests can construct minimal fixtures and so the server / Realtime
 * paths converge on the same field names.
 */
export interface BannerJobRow {
  id: number;
  status: "kicking-off" | "pending" | "complete" | "failed" | "cancelled";
  trigger: "wizard" | "regen";
  meta_plan: MetaPlan | null;
  completed_phases: GenerationPhase[];
  preview_id: number | null;
  failure_code: PlanGenErrorCode | null;
  notes: string | null;
  // Postgres timestamptz, bumped by the orchestrator on every phase
  // advance + the final status flip. Used as the heartbeat for the
  // lazy watchdog.
  updated_at: string;
}

/**
 * Optional companion row — when the job has a preview_id, the client
 * also needs to know whether that preview is still pending. Once
 * accepted/discarded the banner no longer surfaces "Review →".
 */
export interface BannerPreviewRow {
  id: number;
  status: "pending" | "accepted" | "discarded";
}

const IDLE: BannerState = {
  kind: "idle",
  jobId: null,
  previewId: null,
  phaseIndex: null,
  phaseTotal: null,
  phaseLabel: null,
  failureCode: null,
  failedNotes: null,
  lastUpdatedAt: null,
};

/**
 * Pure derivation. Given a job row (and the linked preview row, when
 * the job is `complete` and has a preview_id), returns the banner
 * shape the UI should render. Null `job` → IDLE.
 *
 * Wizard-trigger jobs always derive to IDLE — wizard finalize commits
 * workouts directly to the live plan, so there's no "review" surface
 * the banner needs to point at. (The wizard's own progress page
 * already handles the in-flight UX.)
 */
export function bannerStateFromRow(
  job: BannerJobRow | null,
  preview: BannerPreviewRow | null,
): BannerState {
  if (!job) return IDLE;
  if (job.trigger !== "regen") return IDLE;

  if (job.status === "kicking-off" || job.status === "pending") {
    return {
      kind: "in_progress",
      jobId: job.id,
      previewId: null,
      ...derivePhaseProgress(job),
      failureCode: null,
      failedNotes: null,
      lastUpdatedAt: job.updated_at,
    };
  }

  if (job.status === "failed") {
    return {
      kind: "error",
      jobId: job.id,
      previewId: null,
      phaseIndex: null,
      phaseTotal: null,
      phaseLabel: null,
      failureCode: job.failure_code,
      failedNotes: job.notes,
      lastUpdatedAt: job.updated_at,
    };
  }

  if (job.status === "complete") {
    // Only surface "ready" while there's a still-pending preview the
    // user hasn't decided on yet. Once accepted/discarded, drop to
    // idle so the banner doesn't keep pointing at a stale preview.
    if (
      job.preview_id !== null &&
      preview !== null &&
      preview.status === "pending"
    ) {
      return {
        kind: "ready",
        jobId: job.id,
        previewId: job.preview_id,
        phaseIndex: null,
        phaseTotal: null,
        phaseLabel: null,
        failureCode: null,
        failedNotes: null,
        lastUpdatedAt: job.updated_at,
      };
    }
    return IDLE;
  }

  // cancelled → idle (legacy rows from cancelAllPendingJobs)
  return IDLE;
}

/**
 * Phase progress slice. For an in-flight job:
 *   - kicking-off → 1 of N, label = first phase name (meta-plan exists
 *     by the time precreate returns, but the empty-shape guard keeps
 *     us safe if the row is read mid-precreate).
 *   - pending mid-phase → completedPhases.length + 1, label = next
 *     pending phase capitalised.
 *   - pending with all phases done → "Finalizing", no label.
 */
function derivePhaseProgress(job: BannerJobRow): {
  phaseIndex: number | null;
  phaseTotal: number | null;
  phaseLabel: string | null;
} {
  const phases = job.meta_plan?.phases ?? [];
  const total = phases.length;
  if (total === 0) {
    return { phaseIndex: null, phaseTotal: null, phaseLabel: null };
  }
  const done = job.completed_phases.length;
  if (done >= total) {
    // Finalize step — past the last phase, waiting on plan_previews insert.
    return {
      phaseIndex: total,
      phaseTotal: total,
      phaseLabel: "Finalizing",
    };
  }
  const current = phases[done]; // 0-based array, "done" entries = currently-running index
  return {
    phaseIndex: done + 1,
    phaseTotal: total,
    phaseLabel: phaseLabel(current.phase),
  };
}

function phaseLabel(phase: GenerationPhase): string {
  // Plain capitalisation — the banner's mono-caps font already pushes
  // it to all-caps visually, and lowercase keys read better in error
  // logs / tests.
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

// ─── Server-side initial hydration ──────────────────────────────
// Imported by the root layout so the first paint already shows the
// right banner state — without this, the client component would
// flash empty for one render before its Realtime subscription
// returned a payload. Lives behind a dynamic import so the pure
// derivation above stays test-importable (the server-only client
// pulls supabaseAdmin at module load).

/**
 * Server-only: returns the banner state for the current user. Reads
 * the most-recent regen-trigger job; if that job is `complete` with
 * a preview_id, also reads the linked preview to gate the "ready"
 * branch on `preview.status === 'pending'`. Returns IDLE when there
 * is no user session.
 *
 * Imported dynamically so the pure `bannerStateFromRow` above stays
 * reachable in Node test runs (which don't have Supabase env vars).
 */
export async function getBannerStateForUser(
  userId: string,
): Promise<BannerState> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const { data: jobRow, error: jobErr } = await supabaseAdmin
    .from("plan_generation_jobs")
    .select(
      "id, status, trigger, meta_plan, completed_phases, preview_id, failure_code, notes, updated_at",
    )
    .eq("user_id", userId)
    .eq("trigger", "regen")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<BannerJobRow>();
  if (jobErr) throw jobErr;
  if (!jobRow) return IDLE;

  let previewRow: BannerPreviewRow | null = null;
  if (jobRow.status === "complete" && jobRow.preview_id !== null) {
    const { data, error } = await supabaseAdmin
      .from("plan_previews")
      .select("id, status")
      .eq("id", jobRow.preview_id)
      .eq("user_id", userId)
      .maybeSingle<BannerPreviewRow>();
    if (error) throw error;
    previewRow = data ?? null;
  }

  return bannerStateFromRow(jobRow, previewRow);
}
