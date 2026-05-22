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
