// Public types for the Phase 2.5 chunked-generation pipeline. Lives in
// its own file (no `server-only` import) so client components — the
// progress UI in particular — can consume the shapes without pulling
// in the Anthropic SDK. The orchestrator itself lives in
// lib/plan-generation-orchestrator.ts. See CHUNKING_SPEC.md §3.2.

import type { GeneratedWorkout, GenerationSummary } from "@/lib/claude";

/**
 * Periodization phase names. Tied to the methodology in lib/claude.ts
 * SYSTEM_PROMPT — BASE / BUILD / PEAK / TAPER are the four standard
 * blocks. Compressed-window plans may omit BASE or PEAK; TAPER is
 * always last when present.
 */
export type GenerationPhase = "base" | "build" | "peak" | "taper";

/**
 * One phase's window inside the meta-plan. The orchestrator iterates
 * these in order, calling generatePhase for each not in the job's
 * completed_phases list. `workoutCount` is populated after that
 * phase's chunk lands so polling clients can surface "n workouts so
 * far" if useful.
 */
export interface PhaseMetadata {
  phase: GenerationPhase;
  // First day of the phase window (inclusive), YYYY-MM-DD.
  weekStartIso: string;
  // Last day of the phase window (inclusive), YYYY-MM-DD. Adjacent
  // phases satisfy `next.weekStartIso = addDays(prev.weekEndIso, 1)`.
  weekEndIso: string;
  // Convenience — derived from the dates. Computed by the validator
  // so all downstream readers see the same number.
  weeks: number;
  // Set after this phase's generatePhase call lands and validates.
  workoutCount?: number;
  // 1-2 sentence rationale Claude provided for the phase boundary
  // choice. Logged for debugging; not shown to users.
  rationale?: string;
}

/**
 * Step 0 output — the periodization breakdown without per-workout
 * detail. Drives chunk spawning + progress UI labels.
 */
export interface MetaPlan {
  phases: PhaseMetadata[];
  // 1-2 sentence coach-voice overview of the periodization approach.
  // Surfaces as the opening copy on the regen result page.
  meta_summary: string;
}

/**
 * One phase's generation output. The orchestrator concatenates these
 * into the final assembled plan.
 */
export interface PhaseGenerationResult {
  phase: GenerationPhase;
  workouts: GeneratedWorkout[];
  // Coach-voice 1-2 sentence summary of this phase specifically.
  // Used as input context for downstream phase prompts ("BASE
  // emphasised aerobic base; now BUILD adds quality…") and as part
  // of the assembled regen summary.
  summary: GenerationSummary;
}

/**
 * Shape returned by getGenerationJobStatus — what the polling client
 * sees between phase completions. Mirrors the job row's user-visible
 * subset; status drives the UI state machine.
 */
export interface JobStatusSnapshot {
  jobId: number;
  status: "kicking-off" | "pending" | "complete" | "failed" | "cancelled";
  trigger: "wizard" | "regen";
  metaPlan: MetaPlan;
  completedPhases: GenerationPhase[];
  // Total workouts accumulated so far. Useful for progress copy
  // ("12 workouts so far") without leaking the full payload.
  workoutCount: number;
  // Populated when status=complete. Wizard runs leave this null (the
  // plan committed directly to the workouts table); regen runs set it
  // so the client can route to /regen?preview=<id>.
  previewId: number | null;
  // Populated when status=failed. Surfaces in the friendly error UX
  // so the user sees code-appropriate copy + a Resume button when
  // the failure was mid-pipeline (vs. at meta-plan).
  failureCode: import("@/lib/plan-gen-result").PlanGenErrorCode | null;
  failurePhase: GenerationPhase | "meta" | null;
}

/**
 * Compact summary of an already-completed phase, threaded into the
 * subsequent phase's prompt so Claude sees "what came before" without
 * re-receiving the full workout array. Reduces context window cost
 * dramatically on long plans.
 */
export interface PhaseSummaryForPrompt {
  phase: GenerationPhase;
  weekStartIso: string;
  weekEndIso: string;
  weeks: number;
  workoutCount: number;
  summary: string;
}
