// Unit tests for the pure helpers inside the orchestrator. The
// full pipeline (Supabase IO + Claude calls + state transitions) is
// covered by manual smoke tests on local — see CHUNKING_SPEC.md §7
// "Integration smoke". The helpers tested here are deterministic
// summary builders the prompts depend on, which we want regression
// coverage for.

import { describe, expect, it } from "vitest";
import {
  autoPhaseSummary,
  buildPriorPhaseSummaries,
  combineSummaries,
} from "@/lib/plan-generation-helpers";
import type { GeneratedWorkout, GenerationSummary } from "@/lib/claude";
import type { MetaPlan } from "@/lib/plan-generation-types";

function runWorkout(date: string, km: number): GeneratedWorkout {
  return {
    date,
    kind: "run",
    title: "Easy",
    position: 0,
    why: "Aerobic base.",
    planned_detail: {
      kind: "run",
      segments: [{ label: "Main set", duration_min: 50 }],
      total_distance_km: km,
    },
  };
}
function gymWorkout(date: string): GeneratedWorkout {
  return {
    date,
    kind: "gym",
    title: "Lower body",
    position: 0,
    why: "Posterior chain strength.",
    planned_detail: {
      kind: "gym",
      exercises: [
        { name: "Squat", sets: 4, reps: 6, weight: 60, unit: "kg" },
      ],
      total_duration_min: 45,
    },
  };
}

describe("autoPhaseSummary", () => {
  it("counts workouts by kind and sums run distance", () => {
    const out = autoPhaseSummary("base", [
      runWorkout("2026-05-20", 10),
      runWorkout("2026-05-21", 12),
      gymWorkout("2026-05-22"),
    ]);
    expect(out).toContain("BASE");
    expect(out).toContain("3 workouts");
    expect(out).toContain("2 run");
    expect(out).toContain("1 gym");
    expect(out).toContain("~22 km running");
  });
  it("omits the distance fragment when no run distances are present", () => {
    const out = autoPhaseSummary("taper", [gymWorkout("2026-08-20")]);
    expect(out).toContain("TAPER");
    expect(out).toContain("1 gym");
    expect(out).not.toContain("km running");
  });
});

describe("buildPriorPhaseSummaries", () => {
  const metaPlan: MetaPlan = {
    meta_summary: "Stage the build.",
    phases: [
      { phase: "base", weekStartIso: "2026-05-20", weekEndIso: "2026-06-09", weeks: 3 },
      { phase: "build", weekStartIso: "2026-06-10", weekEndIso: "2026-06-30", weeks: 3 },
      { phase: "taper", weekStartIso: "2026-07-01", weekEndIso: "2026-07-14", weeks: 2 },
    ],
  };

  it("filters workouts to each phase's window and emits a summary entry per completed phase", () => {
    const workouts = [
      runWorkout("2026-05-20", 10), // base
      runWorkout("2026-05-25", 12), // base
      runWorkout("2026-06-15", 16), // build (should not appear under base)
    ];
    const summaries = buildPriorPhaseSummaries(metaPlan, ["base"], workouts);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].phase).toBe("base");
    expect(summaries[0].workoutCount).toBe(2);
    expect(summaries[0].weekStartIso).toBe("2026-05-20");
    expect(summaries[0].weekEndIso).toBe("2026-06-09");
  });

  it("ignores completed phases that aren't present in the meta-plan", () => {
    const summaries = buildPriorPhaseSummaries(
      metaPlan,
      ["peak" as const],
      [],
    );
    // peak isn't in the meta-plan above → no summary entry.
    expect(summaries).toHaveLength(0);
  });

  it("emits summaries in completion order (which equals phase order)", () => {
    const summaries = buildPriorPhaseSummaries(
      metaPlan,
      ["base", "build"],
      [runWorkout("2026-05-20", 10), runWorkout("2026-06-12", 16)],
    );
    expect(summaries.map((s) => s.phase)).toEqual(["base", "build"]);
  });
});

describe("combineSummaries", () => {
  const metaPlan: MetaPlan = {
    meta_summary: "Coach-voice meta summary string.",
    phases: [],
  };

  it("uses the meta_summary for the coach card", () => {
    const out = combineSummaries(metaPlan, []);
    expect(out.summary).toBe("Coach-voice meta summary string.");
    expect(out.changes).toEqual([]);
  });

  it("merges per-phase change badges (de-duped, capped at 4)", () => {
    const perPhase: GenerationSummary[] = [
      {
        summary: "base",
        changes: [
          { type: "added", text: "weekly long run" },
          { type: "added", text: "2× strength" },
        ],
      },
      {
        summary: "build",
        changes: [
          { type: "added", text: "2× strength" }, // dup
          { type: "added", text: "tempo intervals" },
        ],
      },
      {
        summary: "peak",
        changes: [
          { type: "reduced", text: "weekly volume −8%" },
          { type: "shifted", text: "Sun → Sat long" },
          { type: "added", text: "downhill prep" }, // 5th — dropped
        ],
      },
    ];
    const out = combineSummaries(metaPlan, perPhase);
    expect(out.changes).toHaveLength(4);
    const keys = out.changes.map((c) => `${c.type}:${c.text}`);
    // First-seen order, dedupe applied.
    expect(keys).toEqual([
      "added:weekly long run",
      "added:2× strength",
      "added:tempo intervals",
      "reduced:weekly volume −8%",
    ]);
  });
});
