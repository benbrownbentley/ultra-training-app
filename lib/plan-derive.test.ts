import { describe, expect, it } from "vitest";
import {
  buildPlanWeeks,
  computePhase,
  dayPrimaryKind,
  daySummaryLabel,
  phaseLabel,
  weekStats,
} from "@/lib/plan-derive";
import type { Plan, Race, Workout } from "@/lib/plan";

const baseRace: Race = {
  name: "UTMB 2026",
  distance: "171.5 km",
  date: "2026-08-26",
  elevation_gain: 10040,
  terrain: "trail",
  target_time: null,
  intent: "moderate",
};

function makeRun(
  id: number,
  date: string,
  title = "Easy",
  opts: { distanceKm?: number; elevationM?: number } = {},
): Workout {
  void date;
  return {
    id,
    kind: "run",
    title,
    planned_detail: {
      kind: "run",
      segments: [{ label: "Main set" }],
      total_distance_km: opts.distanceKm ?? 10,
      total_elevation_gain_m: opts.elevationM ?? null,
    },
    why: null,
    source: "manual",
    status: "pending",
    position: 0,
    logged_at: null,
    actual_duration_min: null,
    actual_distance_km: null,
    actual_elevation_gain_m: null,
    actual_hr_avg: null,
    actual_rpe: null,
    actual_notes: null,
    actual_detail: null,
    is_custom: false,
  };
}

function makeGym(id: number, title = "Strength"): Workout {
  return {
    id,
    kind: "gym",
    title,
    planned_detail: {
      kind: "gym",
      exercises: [{ name: "Squat", sets: 4, reps: 6, weight: 60, unit: "kg" }],
      total_duration_min: 45,
    },
    why: null,
    source: "manual",
    status: "pending",
    position: 0,
    logged_at: null,
    actual_duration_min: null,
    actual_distance_km: null,
    actual_elevation_gain_m: null,
    actual_hr_avg: null,
    actual_rpe: null,
    actual_notes: null,
    actual_detail: null,
    is_custom: false,
  };
}

describe("computePhase", () => {
  it("classifies the standard 18-week block", () => {
    expect(computePhase(1, 18)).toBe("base");
    expect(computePhase(5, 18)).toBe("base");
    expect(computePhase(6, 18)).toBe("build");
    expect(computePhase(14, 18)).toBe("peak");
    expect(computePhase(17, 18)).toBe("taper");
    expect(computePhase(18, 18)).toBe("taper");
  });
  it("collapses to build for very short blocks", () => {
    expect(computePhase(1, 2)).toBe("build");
    expect(computePhase(2, 2)).toBe("build");
  });
});

describe("phaseLabel", () => {
  it("returns uppercase phase name", () => {
    expect(phaseLabel("base")).toBe("BASE");
    expect(phaseLabel("taper")).toBe("TAPER");
  });
});

describe("dayPrimaryKind + daySummaryLabel", () => {
  it("returns null for empty day", () => {
    expect(dayPrimaryKind([])).toBeNull();
    expect(daySummaryLabel({ date: "2026-05-20", workouts: [] })).toBe("rest");
  });
  it("prefers run over gym over mobility", () => {
    const workouts: Workout[] = [makeGym(1), makeRun(2, "2026-05-20")];
    expect(dayPrimaryKind(workouts)).toBe("run");
  });
  it("extracts distance from planned_detail for the day label", () => {
    const day = {
      date: "2026-05-20",
      workouts: [makeRun(1, "2026-05-20", "Easy", { distanceKm: 12 })],
    };
    expect(daySummaryLabel(day)).toBe("12 km");
  });
});

describe("weekStats", () => {
  it("sums distance + vert across a week", () => {
    const days = [
      {
        date: "2026-05-18",
        workouts: [makeRun(1, "2026-05-18", "Easy", { distanceKm: 10 })],
      },
      {
        date: "2026-05-20",
        workouts: [
          makeRun(2, "2026-05-20", "Tempo", { distanceKm: 12, elevationM: 220 }),
        ],
      },
    ];
    const stats = weekStats(days);
    expect(stats.volKm).toBe(22);
    expect(stats.vertM).toBe(220);
    expect(stats.totalWorkouts).toBe(2);
  });
  it("flags strength + tempo as quality, easy + rest as not", () => {
    const days = [
      {
        date: "2026-05-18",
        workouts: [makeRun(1, "2026-05-18", "Easy", { distanceKm: 8 })],
      },
      {
        date: "2026-05-19",
        workouts: [makeRun(2, "2026-05-19", "Tempo Run", { distanceKm: 12 })],
      },
      {
        date: "2026-05-20",
        workouts: [makeGym(3, "Strength A")],
      },
    ];
    const stats = weekStats(days);
    // tempo + strength count, easy doesn't
    expect(stats.qualityCount).toBe(2);
  });
});

describe("buildPlanWeeks", () => {
  function makePlan(days: Plan["days"]): Plan {
    return { race: baseRace, days };
  }
  it("returns an empty array for an empty plan", () => {
    expect(buildPlanWeeks(makePlan([]), "2026-05-20")).toEqual([]);
  });
  it("buckets a single day under its week", () => {
    const plan = makePlan([
      {
        date: "2026-05-20",
        workouts: [makeRun(1, "2026-05-20")],
      },
    ]);
    const weeks = buildPlanWeeks(plan, "2026-05-20");
    expect(weeks.length).toBeGreaterThan(0);
    // Week 1 starts at Monday 2026-05-18.
    expect(weeks[0].startIso).toBe("2026-05-18");
    expect(weeks[0].isCurrent).toBe(true);
  });
  it("flags the race week", () => {
    // Race is 2026-08-26 (Wed). A week whose Monday is 2026-08-24 contains it.
    const plan = makePlan([
      { date: "2026-08-26", workouts: [makeRun(1, "2026-08-26", "Race")] },
    ]);
    const weeks = buildPlanWeeks(plan, "2026-08-24");
    const raceWeek = weeks.find((w) => w.isRaceWeek);
    expect(raceWeek).toBeTruthy();
    expect(raceWeek!.startIso).toBe("2026-08-24");
  });
  it("marks past weeks as isPast", () => {
    const plan = makePlan([
      { date: "2026-04-01", workouts: [makeRun(1, "2026-04-01")] },
    ]);
    const weeks = buildPlanWeeks(plan, "2026-08-01");
    expect(weeks[0].isPast).toBe(true);
    expect(weeks[0].isFuture).toBe(false);
  });
});
