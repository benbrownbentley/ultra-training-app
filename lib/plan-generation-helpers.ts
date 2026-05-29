// Pure helpers used by the chunked-generation orchestrator. Split out
// of lib/plan-generation-orchestrator.ts so unit tests can import them
// without dragging the Supabase admin client (and its env-var
// requirements) into the test environment.

import type { GeneratedWorkout, GenerationSummary } from "@/lib/claude";
import type {
  GenerationPhase,
  MetaPlan,
  PhaseMetadata,
  PhaseSummaryForPrompt,
} from "@/lib/plan-generation-types";

/**
 * Phase 2.5.1: picks the next pending phase from the meta-plan.
 * Returns `null` when every phase in the meta-plan has already been
 * completed — the orchestrator's `advanceJob` interprets that as a
 * signal to run the finalize step.
 *
 * Order-preserving: returns the FIRST phase whose name isn't in
 * `completedPhases`. The job row's `completed_phases` is appended
 * in completion order, but the meta-plan's `phases` array is the
 * source of truth for sequencing.
 */
export function pickNextPhase(
  metaPlan: MetaPlan,
  completedPhases: GenerationPhase[],
): PhaseMetadata | null {
  const completedSet = new Set(completedPhases);
  return metaPlan.phases.find((p) => !completedSet.has(p.phase)) ?? null;
}

/**
 * True when the job row still has work the chain needs to drive:
 * either pending phases or the finalize step. False once the job
 * reaches a terminal status (`complete` / `failed` / `cancelled`)
 * or while it sits in `kicking-off` — the meta-plan call is
 * client-initiated by `runMetaPlanForJob`, not the self-drive loop,
 * so the chain doesn't try to recover a stuck precreate.
 *
 * Used by both `advanceJob` and the `/api/regen/advance` route to
 * decide whether to schedule a self-fetch for the next phase.
 */
export function hasMoreWork(row: {
  status:
    | "kicking-off"
    | "pending"
    | "complete"
    | "failed"
    | "cancelled";
  meta_plan: MetaPlan | null | undefined;
}): boolean {
  if (row.status !== "pending") return false;
  // Guard against malformed rows landing here — if no phases were
  // ever configured we'd loop forever firing self-fetches that
  // immediately return "no next phase". Treat as terminal.
  const totalPhases = row.meta_plan?.phases?.length ?? 0;
  if (totalPhases === 0) return false;
  // Pending + phases configured = more work. Either a phase still
  // needs to run, or all phases ran but the finalize step (which
  // flips status → complete) hasn't fired yet.
  return true;
}

/**
 * Builds compact per-phase summaries for the prompts of subsequent
 * phases. The Claude prompt sees one bullet per prior phase with
 * count + week range + an auto-generated stats sentence — much
 * smaller than re-emitting the workout array, but enough that Claude
 * understands continuity with what came before.
 */
export function buildPriorPhaseSummaries(
  metaPlan: MetaPlan,
  completedPhases: GenerationPhase[],
  workouts: GeneratedWorkout[],
): PhaseSummaryForPrompt[] {
  const out: PhaseSummaryForPrompt[] = [];
  for (const phaseName of completedPhases) {
    const meta = metaPlan.phases.find((p) => p.phase === phaseName);
    if (!meta) continue;
    const inWindow = workouts.filter(
      (w) => w.date >= meta.weekStartIso && w.date <= meta.weekEndIso,
    );
    out.push({
      phase: phaseName,
      weekStartIso: meta.weekStartIso,
      weekEndIso: meta.weekEndIso,
      weeks: meta.weeks,
      workoutCount: inWindow.length,
      summary: autoPhaseSummary(phaseName, inWindow),
    });
  }
  return out;
}

/**
 * Compact one-sentence rollup of a phase's workouts for use in the
 * next phase's prompt. Counts by kind, captures distance for runs.
 * Intentionally rule-driven (not Claude-generated) so resume paths
 * don't depend on persisted per-phase summary text.
 */
export function autoPhaseSummary(
  phase: GenerationPhase,
  workouts: GeneratedWorkout[],
): string {
  const byKind = new Map<string, number>();
  let totalRunKm = 0;
  for (const w of workouts) {
    byKind.set(w.kind, (byKind.get(w.kind) ?? 0) + 1);
    if (
      w.kind === "run" &&
      w.planned_detail.kind === "run" &&
      typeof w.planned_detail.total_distance_km === "number"
    ) {
      totalRunKm += w.planned_detail.total_distance_km;
    }
  }
  const kindParts = [...byKind.entries()]
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");
  const distancePart =
    totalRunKm > 0 ? `, ~${Math.round(totalRunKm)} km running` : "";
  return `${phase.toUpperCase()} phase covered ${workouts.length} workouts (${kindParts})${distancePart}.`;
}

/**
 * Builds the GenerationSummary stored on the regen preview row. Uses
 * the meta-plan's coach-voice summary for the "FROM YOUR COACH" card
 * and concatenates per-phase change badges (deduped, capped at 4).
 */
export function combineSummaries(
  metaPlan: MetaPlan,
  perPhase: GenerationSummary[],
): GenerationSummary {
  const allChanges = perPhase.flatMap((s) => s.changes);
  const seen = new Set<string>();
  const uniqueChanges: GenerationSummary["changes"] = [];
  for (const c of allChanges) {
    const key = `${c.type}:${c.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueChanges.push(c);
    if (uniqueChanges.length >= 4) break;
  }
  return {
    summary: metaPlan.meta_summary,
    changes: uniqueChanges,
  };
}
