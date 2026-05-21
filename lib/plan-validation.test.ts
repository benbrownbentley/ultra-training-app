import { describe, expect, it } from "vitest";
import {
  addDays,
  buildRetryMessage,
  enumerateDates,
  errorsOnly,
  validateGeneratedPlan,
} from "@/lib/plan-validation";
import type { GeneratedWorkout } from "@/lib/claude";

// Build a fully-covered happy-path plan: one workout per day from start
// through race day, with the race itself as a run on race day.
function buildHappyPlan(startDate: string, raceDate: string): GeneratedWorkout[] {
  const dates = enumerateDates(startDate, raceDate);
  return dates.map((d, i) => ({
    date: d,
    kind: d === raceDate ? "run" : "mobility",
    title: d === raceDate ? "Race day" : "Mobility",
    details: d === raceDate ? "Race the thing" : "15 min mobility",
    position: 0,
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
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("missing_dates");
    expect(errors[0].message).toContain("2026-05-22");
  });

  it("flags no_race_day_run when race day has no run", () => {
    const plan = buildHappyPlan("2026-05-20", "2026-05-25").map((w) =>
      w.date === "2026-05-25"
        ? { ...w, kind: "mobility" as const, title: "Mobility" }
        : w,
    );
    const issues = validateGeneratedPlan({
      workouts: plan,
      startDate: "2026-05-20",
      raceDate: "2026-05-25",
    });
    const errors = errorsOnly(issues);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("no_race_day_run");
  });

  it("flags dates_before_start when workouts are dated before the window", () => {
    const plan = buildHappyPlan("2026-05-20", "2026-05-25");
    plan.push({
      date: "2026-05-15", // before start
      kind: "run",
      title: "Stray past workout",
      details: "Should not be here",
      position: 0,
    });
    const issues = validateGeneratedPlan({
      workouts: plan,
      startDate: "2026-05-20",
      raceDate: "2026-05-25",
    });
    const errors = errorsOnly(issues);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("dates_before_start");
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

describe("validateGeneratedPlan — soft warnings", () => {
  it("warns when a long run is scheduled in the final 7 days", () => {
    // 14-day plan with a "Long run" on day -3 from race.
    const plan = buildHappyPlan("2026-05-12", "2026-05-25").map((w) =>
      w.date === "2026-05-22"
        ? {
            ...w,
            kind: "run" as const,
            title: "Long run",
            details: "30 km long",
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
});
