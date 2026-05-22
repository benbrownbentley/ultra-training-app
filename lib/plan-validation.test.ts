import { describe, expect, it } from "vitest";
import {
  addDays,
  buildRetryMessage,
  enrichPhaseWeeks,
  enumerateDates,
  errorsOnly,
  PlannedDetailSchema,
  WHY_MAX_CHARS,
  validateGeneratedPlan,
  validateMetaPlan,
  validatePhaseChunk,
} from "@/lib/plan-validation";
import type { GeneratedWorkout } from "@/lib/claude";
import type { PlannedDetail } from "@/lib/plan";
import type { MetaPlan } from "@/lib/plan-generation-types";

// Minimal-but-valid PlannedDetail builder per kind. Keeps fixtures
// terse while still satisfying the discriminator + required fields.
function mobilityDetail(): PlannedDetail {
  return {
    kind: "mobility",
    movements: [{ name: "Hip flexor stretch", duration_s: 60 }],
    total_duration_min: 15,
  };
}

function runDetail(): PlannedDetail {
  return {
    kind: "run",
    segments: [{ label: "Main set", duration_min: 30, zone: "Z2" }],
    total_duration_min: 30,
    total_distance_km: 5,
  };
}

// Build a fully-covered happy-path plan: one workout per day from start
// through race day, with the race itself as a run on race day.
function buildHappyPlan(startDate: string, raceDate: string): GeneratedWorkout[] {
  const dates = enumerateDates(startDate, raceDate);
  return dates.map((d) => ({
    date: d,
    kind: d === raceDate ? "run" : "mobility",
    title: d === raceDate ? "Race day" : "Mobility",
    position: 0,
    why: d === raceDate ? "Race day — execute the plan." : "Daily mobility to keep the joints honest.",
    planned_detail: d === raceDate ? runDetail() : mobilityDetail(),
  }));
}

describe("enumerateDates", () => {
  it("includes both endpoints", () => {
    expect(enumerateDates("2026-05-20", "2026-05-23")).toEqual([
      "2026-05-20",
      "2026-05-21",
      "2026-05-22",
      "2026-05-23",
    ]);
  });
  it("returns a single date when start == end", () => {
    expect(enumerateDates("2026-05-20", "2026-05-20")).toEqual(["2026-05-20"]);
  });
});

describe("addDays", () => {
  it("adds positive days across a month boundary", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
  });
  it("subtracts days", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("handles leap-year correctly", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
});

describe("validateGeneratedPlan — happy path", () => {
  it("returns no issues when the plan is well-formed", () => {
    const plan = buildHappyPlan("2026-05-20", "2026-05-25");
    const issues = validateGeneratedPlan({
      workouts: plan,
      startDate: "2026-05-20",
      raceDate: "2026-05-25",
    });
    expect(issues).toEqual([]);
  });
});

describe("validateGeneratedPlan — error checks", () => {
  it("flags missing_dates when any day lacks a workout", () => {
    const plan = buildHappyPlan("2026-05-20", "2026-05-25").filter(
      (w) => w.date !== "2026-05-22",
    );
    const issues = validateGeneratedPlan({
      workouts: plan,
      startDate: "2026-05-20",
      raceDate: "2026-05-25",
    });
    const errors = errorsOnly(issues);
    expect(errors.some((e) => e.code === "missing_dates")).toBe(true);
    const missing = errors.find((e) => e.code === "missing_dates")!;
    expect(missing.message).toContain("2026-05-22");
  });

  it("flags no_race_day_run when race day has no run", () => {
    const plan = buildHappyPlan("2026-05-20", "2026-05-25").map((w) =>
      w.date === "2026-05-25"
        ? {
            ...w,
            kind: "mobility" as const,
            title: "Mobility",
            planned_detail: mobilityDetail(),
          }
        : w,
    );
    const issues = validateGeneratedPlan({
      workouts: plan,
      startDate: "2026-05-20",
      raceDate: "2026-05-25",
    });
    expect(errorsOnly(issues).some((e) => e.code === "no_race_day_run")).toBe(true);
  });

  it("flags dates_before_start when workouts are dated before the window", () => {
    const plan = buildHappyPlan("2026-05-20", "2026-05-25");
    plan.push({
      date: "2026-05-15", // before start
      kind: "run",
      title: "Stray past workout",
      position: 0,
      why: "Should not be here.",
      planned_detail: runDetail(),
    });
    const issues = validateGeneratedPlan({
      workouts: plan,
      startDate: "2026-05-20",
      raceDate: "2026-05-25",
    });
    expect(errorsOnly(issues).some((e) => e.code === "dates_before_start")).toBe(true);
  });

  it("accumulates multiple errors when multiple checks fail", () => {
    // No workouts at all → missing_dates AND no_race_day_run both fire.
    const issues = validateGeneratedPlan({
      workouts: [],
      startDate: "2026-05-20",
      raceDate: "2026-05-25",
    });
    const codes = errorsOnly(issues).map((e) => e.code);
    expect(codes).toContain("missing_dates");
    expect(codes).toContain("no_race_day_run");
  });
});

describe("validateGeneratedPlan — Phase 2 structured checks", () => {
  it("flags why_missing when a workout has no `why`", () => {
    const plan = buildHappyPlan("2026-05-20", "2026-05-25");
    plan[0] = { ...plan[0], why: "" };
    const issues = validateGeneratedPlan({
      workouts: plan,
      startDate: "2026-05-20",
      raceDate: "2026-05-25",
    });
    expect(errorsOnly(issues).some((e) => e.code === "why_missing")).toBe(true);
  });

  it(`flags why_too_long when \`why\` exceeds ${WHY_MAX_CHARS} chars`, () => {
    const plan = buildHappyPlan("2026-05-20", "2026-05-25");
    plan[0] = { ...plan[0], why: "x".repeat(WHY_MAX_CHARS + 1) };
    const issues = validateGeneratedPlan({
      workouts: plan,
      startDate: "2026-05-20",
      raceDate: "2026-05-25",
    });
    expect(errorsOnly(issues).some((e) => e.code === "why_too_long")).toBe(true);
  });

  it("flags kind_mismatch when outer kind disagrees with planned_detail.kind", () => {
    const plan = buildHappyPlan("2026-05-20", "2026-05-25");
    // Outer kind = mobility, inner planned_detail.kind = run → mismatch.
    plan[0] = { ...plan[0], planned_detail: runDetail() };
    const issues = validateGeneratedPlan({
      workouts: plan,
      startDate: "2026-05-20",
      raceDate: "2026-05-25",
    });
    expect(errorsOnly(issues).some((e) => e.code === "kind_mismatch")).toBe(true);
  });

  it("flags planned_detail_invalid when a discriminator is unknown", () => {
    const plan = buildHappyPlan("2026-05-20", "2026-05-25");
    plan[0] = {
      ...plan[0],
      planned_detail: { kind: "bogus" } as unknown as PlannedDetail,
    };
    const issues = validateGeneratedPlan({
      workouts: plan,
      startDate: "2026-05-20",
      raceDate: "2026-05-25",
    });
    expect(errorsOnly(issues).some((e) => e.code === "planned_detail_invalid")).toBe(true);
  });
});

describe("PlannedDetailSchema — per-kind happy + failure", () => {
  it("accepts valid run, gym, physio, mobility, cross, hike payloads", () => {
    const valid: PlannedDetail[] = [
      {
        kind: "run",
        segments: [{ label: "Main set", duration_min: 30, zone: "Z2" }],
      },
      {
        kind: "gym",
        exercises: [{ name: "Squat", sets: 4, reps: 6, weight: 60, unit: "kg" }],
      },
      {
        kind: "physio",
        exercises: [
          {
            name: "Calf raises",
            sets: 3,
            reps: 8,
            weight: 20,
            unit: "kg",
            pain_focus: "achilles",
          },
        ],
      },
      {
        kind: "mobility",
        movements: [{ name: "World's greatest stretch", duration_s: 60 }],
      },
      { kind: "cross", activity: "cycling", duration_min: 45, target_zone: "Z2" },
      { kind: "hike", duration_min: 180, elevation_gain_m: 800 },
    ];
    for (const v of valid) {
      const parsed = PlannedDetailSchema.safeParse(v);
      expect(parsed.success).toBe(true);
    }
  });

  it("rejects a run missing segments", () => {
    const parsed = PlannedDetailSchema.safeParse({ kind: "run" });
    expect(parsed.success).toBe(false);
  });

  it("rejects a gym row with empty exercises array", () => {
    const parsed = PlannedDetailSchema.safeParse({ kind: "gym", exercises: [] });
    expect(parsed.success).toBe(false);
  });

  it("rejects a mobility row with no movements", () => {
    const parsed = PlannedDetailSchema.safeParse({ kind: "mobility", movements: [] });
    expect(parsed.success).toBe(false);
  });

  it("rejects a cross row missing required activity/duration", () => {
    const parsed = PlannedDetailSchema.safeParse({ kind: "cross" });
    expect(parsed.success).toBe(false);
  });

  it("rejects a hike row missing duration_min", () => {
    const parsed = PlannedDetailSchema.safeParse({ kind: "hike", elevation_gain_m: 500 });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown discriminator", () => {
    const parsed = PlannedDetailSchema.safeParse({ kind: "bogus" });
    expect(parsed.success).toBe(false);
  });
});

describe("validateGeneratedPlan — soft warnings", () => {
  it("warns when a long run is scheduled in the final 7 days", () => {
    // 14-day plan with a "Long run" on day -3 from race.
    const plan = buildHappyPlan("2026-05-12", "2026-05-25").map((w) =>
      w.date === "2026-05-22"
        ? {
            ...w,
            kind: "run" as const,
            title: "Long run",
            planned_detail: runDetail(),
          }
        : w,
    );
    const issues = validateGeneratedPlan({
      workouts: plan,
      startDate: "2026-05-12",
      raceDate: "2026-05-25",
    });
    // No errors but one warning.
    expect(errorsOnly(issues)).toEqual([]);
    const warnings = issues.filter((i) => i.severity === "warning");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("long_run_in_taper");
  });

  it("does not warn when the race-day run is titled 'Race day'", () => {
    // Sanity: the regex matches "long run", not "race day".
    const plan = buildHappyPlan("2026-05-20", "2026-05-25");
    const issues = validateGeneratedPlan({
      workouts: plan,
      startDate: "2026-05-20",
      raceDate: "2026-05-25",
    });
    expect(issues).toEqual([]);
  });
});

describe("buildRetryMessage", () => {
  it("includes each error with its code prefix", () => {
    const issues = validateGeneratedPlan({
      workouts: [],
      startDate: "2026-05-20",
      raceDate: "2026-05-25",
    });
    const msg = buildRetryMessage(issues);
    expect(msg).toContain("[missing_dates]");
    expect(msg).toContain("[no_race_day_run]");
    expect(msg).toContain("submit_training_plan");
  });
  it("excludes warnings", () => {
    const issues = [
      ...validateGeneratedPlan({
        workouts: [],
        startDate: "2026-05-20",
        raceDate: "2026-05-25",
      }),
      {
        severity: "warning" as const,
        code: "long_run_in_taper" as const,
        message: "this is a warning",
      },
    ];
    const msg = buildRetryMessage(issues);
    expect(msg).not.toContain("this is a warning");
  });
  it("targets the provided tool name on retry", () => {
    const msg = buildRetryMessage(
      [
        {
          severity: "error",
          code: "meta_plan_empty",
          message: "no phases",
        },
      ],
      "submit_meta_plan",
    );
    expect(msg).toContain("submit_meta_plan");
    expect(msg).not.toContain("submit_training_plan");
  });
});

// ---------- Phase 2.5 ---------------------------------------------

function metaPlan(phases: { phase: "base" | "build" | "peak" | "taper"; start: string; end: string }[]): MetaPlan {
  return {
    meta_summary: "Test plan.",
    phases: phases.map((p) => ({
      phase: p.phase,
      weekStartIso: p.start,
      weekEndIso: p.end,
      weeks: Math.max(
        1,
        Math.round(enumerateDates(p.start, p.end).length / 7),
      ),
    })),
  };
}

describe("validateMetaPlan", () => {
  it("accepts a clean 4-phase plan covering the full window", () => {
    const mp = metaPlan([
      { phase: "base", start: "2026-05-20", end: "2026-06-09" }, // 3 wks
      { phase: "build", start: "2026-06-10", end: "2026-06-30" }, // 3 wks
      { phase: "peak", start: "2026-07-01", end: "2026-07-14" }, // 2 wks
      { phase: "taper", start: "2026-07-15", end: "2026-07-28" }, // 2 wks
    ]);
    expect(
      errorsOnly(
        validateMetaPlan({
          metaPlan: mp,
          startDate: "2026-05-20",
          raceDate: "2026-07-28",
        }),
      ),
    ).toEqual([]);
  });

  it("flags meta_plan_empty when no phases are returned", () => {
    const issues = validateMetaPlan({
      metaPlan: { meta_summary: "x", phases: [] },
      startDate: "2026-05-20",
      raceDate: "2026-07-28",
    });
    expect(errorsOnly(issues).map((i) => i.code)).toContain("meta_plan_empty");
  });

  it("flags meta_plan_phase_gap when a date is missing between phases", () => {
    const mp = metaPlan([
      { phase: "base", start: "2026-05-20", end: "2026-06-09" },
      { phase: "build", start: "2026-06-11", end: "2026-06-30" }, // gap on 06-10
      { phase: "taper", start: "2026-07-01", end: "2026-07-28" },
    ]);
    const issues = validateMetaPlan({
      metaPlan: mp,
      startDate: "2026-05-20",
      raceDate: "2026-07-28",
    });
    expect(errorsOnly(issues).map((i) => i.code)).toContain(
      "meta_plan_phase_gap",
    );
  });

  it("flags meta_plan_overlap when phases share dates", () => {
    const mp = metaPlan([
      { phase: "base", start: "2026-05-20", end: "2026-06-15" },
      { phase: "build", start: "2026-06-10", end: "2026-06-30" }, // overlaps 06-10..06-15
      { phase: "taper", start: "2026-07-01", end: "2026-07-28" },
    ]);
    const issues = validateMetaPlan({
      metaPlan: mp,
      startDate: "2026-05-20",
      raceDate: "2026-07-28",
    });
    expect(errorsOnly(issues).map((i) => i.code)).toContain(
      "meta_plan_overlap",
    );
  });

  it("flags meta_plan_start_mismatch when first phase starts late", () => {
    const mp = metaPlan([
      { phase: "base", start: "2026-05-22", end: "2026-06-09" }, // expected 05-20
      { phase: "build", start: "2026-06-10", end: "2026-07-28" },
    ]);
    const issues = validateMetaPlan({
      metaPlan: mp,
      startDate: "2026-05-20",
      raceDate: "2026-07-28",
    });
    expect(errorsOnly(issues).map((i) => i.code)).toContain(
      "meta_plan_start_mismatch",
    );
  });

  it("flags meta_plan_end_mismatch when last phase ends early", () => {
    const mp = metaPlan([
      { phase: "base", start: "2026-05-20", end: "2026-06-09" },
      { phase: "taper", start: "2026-06-10", end: "2026-07-20" }, // expected end 07-28
    ]);
    const issues = validateMetaPlan({
      metaPlan: mp,
      startDate: "2026-05-20",
      raceDate: "2026-07-28",
    });
    expect(errorsOnly(issues).map((i) => i.code)).toContain(
      "meta_plan_end_mismatch",
    );
  });

  it("flags meta_plan_invalid_phase_order when TAPER comes before PEAK", () => {
    const mp = metaPlan([
      { phase: "base", start: "2026-05-20", end: "2026-06-09" },
      { phase: "taper", start: "2026-06-10", end: "2026-06-30" }, // taper before peak
      { phase: "peak", start: "2026-07-01", end: "2026-07-28" },
    ]);
    const issues = validateMetaPlan({
      metaPlan: mp,
      startDate: "2026-05-20",
      raceDate: "2026-07-28",
    });
    expect(errorsOnly(issues).map((i) => i.code)).toContain(
      "meta_plan_invalid_phase_order",
    );
  });

  it("flags meta_plan_invalid_phase_order when BASE comes after BUILD", () => {
    const mp = metaPlan([
      { phase: "build", start: "2026-05-20", end: "2026-06-09" },
      { phase: "base", start: "2026-06-10", end: "2026-07-28" }, // base after build
    ]);
    const issues = validateMetaPlan({
      metaPlan: mp,
      startDate: "2026-05-20",
      raceDate: "2026-07-28",
    });
    expect(errorsOnly(issues).map((i) => i.code)).toContain(
      "meta_plan_invalid_phase_order",
    );
  });
});

// Build a happy-path workout fixture for the per-phase validator.
function chunkWorkout(date: string, raceDay: boolean = false): GeneratedWorkout {
  return raceDay
    ? {
        date,
        kind: "run",
        title: "Race day",
        position: 0,
        why: "Race the thing.",
        planned_detail: {
          kind: "run",
          segments: [{ label: "Main set", duration_min: 30 }],
        },
      }
    : {
        date,
        kind: "mobility",
        title: "Mobility",
        position: 0,
        why: "Daily mobility keeps the joints honest.",
        planned_detail: {
          kind: "mobility",
          movements: [{ name: "Hip flexor stretch", duration_s: 60 }],
          total_duration_min: 15,
        },
      };
}

describe("validatePhaseChunk", () => {
  it("accepts a clean chunk covering every date in the phase window", () => {
    const workouts = enumerateDates("2026-05-20", "2026-05-23").map((d) =>
      chunkWorkout(d),
    );
    expect(
      errorsOnly(
        validatePhaseChunk({
          workouts,
          phaseStart: "2026-05-20",
          phaseEnd: "2026-05-23",
          phase: "base",
        }),
      ),
    ).toEqual([]);
  });

  it("flags missing_dates_in_phase when a date is uncovered", () => {
    const workouts = enumerateDates("2026-05-20", "2026-05-23")
      .filter((d) => d !== "2026-05-22")
      .map((d) => chunkWorkout(d));
    const issues = validatePhaseChunk({
      workouts,
      phaseStart: "2026-05-20",
      phaseEnd: "2026-05-23",
      phase: "base",
    });
    const codes = errorsOnly(issues).map((i) => i.code);
    expect(codes).toContain("missing_dates_in_phase");
    const msg = errorsOnly(issues).find(
      (i) => i.code === "missing_dates_in_phase",
    )!.message;
    expect(msg).toContain("2026-05-22");
  });

  it("flags out-of-window workouts as missing_dates_in_phase too", () => {
    const workouts = [
      chunkWorkout("2026-05-20"),
      chunkWorkout("2026-05-21"),
      chunkWorkout("2026-05-22"),
      chunkWorkout("2026-05-23"),
      chunkWorkout("2026-05-24"), // outside [05-20, 05-23]
    ];
    const issues = validatePhaseChunk({
      workouts,
      phaseStart: "2026-05-20",
      phaseEnd: "2026-05-23",
      phase: "base",
    });
    const msgs = errorsOnly(issues)
      .filter((i) => i.code === "missing_dates_in_phase")
      .map((i) => i.message);
    expect(msgs.some((m) => m.includes("outside"))).toBe(true);
  });

  it("propagates per-workout structural errors (why_missing, planned_detail_invalid)", () => {
    const workouts = [
      chunkWorkout("2026-05-20"),
      { ...chunkWorkout("2026-05-21"), why: "" }, // missing
      {
        ...chunkWorkout("2026-05-22"),
        planned_detail: { kind: "bogus" } as unknown as GeneratedWorkout["planned_detail"],
      },
      chunkWorkout("2026-05-23"),
    ];
    const codes = errorsOnly(
      validatePhaseChunk({
        workouts,
        phaseStart: "2026-05-20",
        phaseEnd: "2026-05-23",
        phase: "base",
      }),
    ).map((i) => i.code);
    expect(codes).toContain("why_missing");
    expect(codes).toContain("planned_detail_invalid");
  });
});

describe("enrichPhaseWeeks", () => {
  it("computes a sensible weeks count from the date range", () => {
    const enriched = enrichPhaseWeeks([
      {
        phase: "base",
        weekStartIso: "2026-05-20",
        weekEndIso: "2026-06-09",
        weeks: 0, // pre-enrichment
      },
    ]);
    expect(enriched[0].weeks).toBe(3); // 21 days → 3 weeks
  });
  it("floors a sub-week range to 1 week (never zero)", () => {
    const enriched = enrichPhaseWeeks([
      {
        phase: "taper",
        weekStartIso: "2026-07-25",
        weekEndIso: "2026-07-28",
        weeks: 0,
      },
    ]);
    expect(enriched[0].weeks).toBe(1);
  });
});
