// Phase 2.5.2 copy tables. Lives in lib/ (no React, no actions
// import) so unit tests can import without pulling in the Supabase
// admin client. Consumed by app/_components/generating/
// GeneratingPhaseState.tsx.

import type { GenerationPhase } from "@/lib/plan-generation-types";

/**
 * Per-phase header eyebrow + static tagline. Shown on the PhaseLine
 * itself; the rotating taglines below this layer animate underneath.
 */
export const PHASE_COPY: Record<
  GenerationPhase,
  { eyebrow: string; tagline: string }
> = {
  base: {
    eyebrow: "BASE PHASE",
    tagline: "Building the aerobic foundation.",
  },
  build: {
    eyebrow: "BUILD PHASE",
    tagline: "Adding race-specific intensity.",
  },
  peak: {
    eyebrow: "PEAK PHASE",
    tagline: "Sharpening the engine.",
  },
  taper: {
    eyebrow: "TAPER PHASE",
    tagline: "Locking in fitness, shedding fatigue.",
  },
};

/**
 * Five rotating tagline lines per phase, cycled while that phase is
 * active. The component swaps to the next phase's five lines when
 * the active phase advances; reasoning continuity stays tied to the
 * phase's role in the periodization arc. Each phase array MUST stay
 * at 5 entries — the CSS rotation cycle assumes a uniform count.
 */
export const PHASE_FLAVOUR: Record<GenerationPhase, readonly string[]> = {
  base: [
    "Mapping your aerobic foundation.",
    "Setting cutback weeks.",
    "Sizing the long run progression.",
    "Honouring your recovery days.",
    "Reading recent volume.",
  ],
  build: [
    "Adding race-specific intensity.",
    "Placing the first quality sessions.",
    "Balancing hard days with easy days.",
    "Spacing tempo and threshold work.",
    "Watching for recent injury signals.",
  ],
  peak: [
    "Sharpening race fitness.",
    "Sequencing peak-week sessions.",
    "Holding volume, raising intensity.",
    "Protecting the long run.",
    "Tuning brick sessions.",
  ],
  taper: [
    "Locking in fitness, shedding fatigue.",
    "Cutting volume thoughtfully.",
    "Keeping intensity, dropping duration.",
    "Planning your shakeout days.",
    "Easing into race readiness.",
  ],
} as const;
