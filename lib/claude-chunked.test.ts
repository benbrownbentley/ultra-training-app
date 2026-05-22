// Phase 2.5: schema + prompt-builder tests for the chunked-generation
// Claude calls. Tests of the actual generateMetaPlan / generatePhase
// network paths live in the orchestrator spec (which mocks them
// wholesale); here we just verify the structural contract Claude
// receives — tool schema shape and prompt-builder outputs.

import { describe, expect, it } from "vitest";
import {
  META_PLAN_TOOL,
  buildMetaPlanUserPrompt,
  buildPhaseUserPrompt,
} from "@/lib/claude";
import type { AthleteProfile, Race } from "@/lib/plan";
import type {
  MetaPlan,
  PhaseMetadata,
  PhaseSummaryForPrompt,
} from "@/lib/plan-generation-types";

const fixtureRace: Race = {
  name: "UTMB 2026",
  distance: "171.5 km",
  date: "2026-08-26",
  elevation_gain: 10040,
  terrain: "trail",
  target_time: null,
  intent: "moderate",
};

const fixtureProfile: AthleteProfile = {
  unit_system: "metric",
  weekly_volume: "65 km",
  longest_run_distance: 42,
  easy_pace: "",
  injury_notes: null,
  experience: null,
  gym_access: "full",
  equipment: null,
  weekly_hours: 8,
  cross_training: null,
  other_commitments: null,
  sleep_stress: null,
  fitness_rating: 4,
};

describe("META_PLAN_TOOL", () => {
  it("declares the correct shape for Anthropic", () => {
    expect(META_PLAN_TOOL.name).toBe("submit_meta_plan");
    const schema = META_PLAN_TOOL.input_schema as Record<string, unknown>;
    expect(schema.type).toBe("object");
    const props = schema.properties as Record<string, unknown>;
    expect(props.phases).toBeDefined();
    expect(props.meta_summary).toBeDefined();
    const phases = props.phases as Record<string, unknown>;
    expect(phases.type).toBe("array");
    expect(phases.minItems).toBe(1);
    expect(phases.maxItems).toBe(4);
    // The required at the outer object level enforces both top-level
    // fields land — otherwise validate steps trip on undefined.
    expect(schema.required).toEqual(["phases", "meta_summary"]);
  });

  it("constrains phase enum to base/build/peak/taper", () => {
    const phaseItems = (
      (META_PLAN_TOOL.input_schema as Record<string, unknown>).properties as Record<
        string,
        unknown
      >
    ).phases as Record<string, unknown>;
    const items = phaseItems.items as Record<string, unknown>;
    const itemProps = items.properties as Record<string, unknown>;
    const phaseField = itemProps.phase as Record<string, unknown>;
    expect(phaseField.enum).toEqual(["base", "build", "peak", "taper"]);
  });
});

describe("buildMetaPlanUserPrompt", () => {
  it("includes race, profile, and the date window", () => {
    const out = buildMetaPlanUserPrompt({
      race: fixtureRace,
      profile: fixtureProfile,
      startDate: "2026-05-20",
    });
    expect(out).toContain("RACE");
    expect(out).toContain("UTMB 2026");
    expect(out).toContain("RUNNER PROFILE");
    expect(out).toContain("Start date (today): 2026-05-20");
    expect(out).toContain("End date (race day): 2026-08-26");
    expect(out).toContain("submit_meta_plan");
  });

  it("does NOT bleed full-plan-prompt sections (history, journal, notes)", () => {
    // The meta-plan call deliberately skips history / journal to keep
    // the call tight. Regression guard against accidental inclusion.
    const out = buildMetaPlanUserPrompt({
      race: fixtureRace,
      profile: fixtureProfile,
      startDate: "2026-05-20",
    });
    expect(out).not.toContain("WORKOUT HISTORY");
    expect(out).not.toContain("JOURNAL ENTRIES");
    expect(out).not.toContain("PREVIOUS COACH MESSAGE");
  });
});

describe("buildPhaseUserPrompt", () => {
  const metaPlan: MetaPlan = {
    meta_summary: "Six weeks of base then a tight build → peak → taper.",
    phases: [
      {
        phase: "base",
        weekStartIso: "2026-05-20",
        weekEndIso: "2026-06-30",
        weeks: 6,
      },
      {
        phase: "build",
        weekStartIso: "2026-07-01",
        weekEndIso: "2026-07-28",
        weeks: 4,
      },
      {
        phase: "peak",
        weekStartIso: "2026-07-29",
        weekEndIso: "2026-08-11",
        weeks: 2,
      },
      {
        phase: "taper",
        weekStartIso: "2026-08-12",
        weekEndIso: "2026-08-26",
        weeks: 2,
      },
    ],
  };

  const buildPhase: PhaseMetadata = metaPlan.phases[1];

  it("scopes the date window to the named phase only", () => {
    const out = buildPhaseUserPrompt({
      race: fixtureRace,
      profile: fixtureProfile,
      startDate: "2026-05-20",
      history: [],
      phase: buildPhase,
      metaPlan,
      priorPhaseSummaries: [
        {
          phase: "base",
          weekStartIso: "2026-05-20",
          weekEndIso: "2026-06-30",
          weeks: 6,
          workoutCount: 54,
          summary:
            "Aerobic foundation. 1 quality day per week, average 45 km/week.",
        },
      ],
    });
    expect(out).toContain("PHASE TO GENERATE");
    expect(out).toContain("BUILD");
    expect(out).toContain("2026-07-01 → 2026-07-28");
    expect(out).toContain("4 weeks");
    expect(out).toContain("PRIOR PHASES");
    expect(out).toContain("BASE (2026-05-20 → 2026-06-30");
    expect(out).toContain("54 workouts");
    expect(out).toContain("submit_training_plan");
  });

  it("notes 'first phase' framing when no prior summaries are provided", () => {
    const out = buildPhaseUserPrompt({
      race: fixtureRace,
      profile: fixtureProfile,
      startDate: "2026-05-20",
      history: [],
      phase: metaPlan.phases[0],
      metaPlan,
      priorPhaseSummaries: [],
    });
    expect(out).toContain("first phase");
  });

  it("includes the overall arc as breadcrumbs so Claude has context", () => {
    const out = buildPhaseUserPrompt({
      race: fixtureRace,
      profile: fixtureProfile,
      startDate: "2026-05-20",
      history: [],
      phase: buildPhase,
      metaPlan,
      priorPhaseSummaries: [],
    });
    // The arc breadcrumb is the meta-plan's phases joined into a chain.
    expect(out).toContain("BASE (2026-05-20 → 2026-06-30) → BUILD");
    expect(out).toContain("→ TAPER");
  });
});

// Smoke test: the orchestrator+UI rely on the existing PhaseSummaryForPrompt
// shape — assert the type is structurally what we expect (compile-time check
// via the variable assignment).
const _summaryShape: PhaseSummaryForPrompt = {
  phase: "base",
  weekStartIso: "2026-05-20",
  weekEndIso: "2026-06-30",
  weeks: 6,
  workoutCount: 54,
  summary: "x",
};
void _summaryShape;
