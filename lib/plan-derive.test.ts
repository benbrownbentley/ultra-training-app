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
  details = "10 km @ 6:00/km easy",
): Workout {
  return {
    id,
    kind: "run",
    title,
    details,
    status: "pending",
    position: 0,
    logged_at: null,
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
    const workouts: Workout[] = [
      {
        id: 1,
        kind: "gym",
        title: "Strength",
        details: "45 min",
        status: "pending",
        position: 0,
        logged_at: null,
      },
      makeRun(2, "2026-05-20"),
    ];
    expect(dayPrimaryKind(workouts)).toBe("run");
  });
  it("extracts distance from details for the day label", () => {
    const day = {
      date: "2026-05-20",
      workouts: [makeRun(1, "2026-05-20", "Easy", "12 km @ 6:00/km")],
    };
    expect(daySummaryLabel(day)).toBe("12 km");
  });
});

describe("weekStats", () => {
  it("sums distance + vert across a week", () => {
    const days = [
      {
        date: "2026-05-18",
        workouts: [makeRun(1, "2026-05-18", "Easy", "10 km")],
      },
      {
        date: "2026-05-20",
        workouts: [makeRun(2, "2026-05-20", "Tempo", "12 km +220m")],
      },
    ];
    const stats = weekStats(days);
    expect(stats.volKm).toBe(22);
    expect(stats.vertM).toBe(220);
    expect(stats.totalWorkouts).toBe(2);
  });
  it("treats mileage as miles when units appear in details", () => {
    // distanceKm in lib/plan-derive specifically converts mi → km.
    const days = [
      {
        date: "2026-05-18",
        workouts: [makeRun(1, "2026-05-18", "Easy", "6 mi @ 9:30/mi easy")],
      },
    ];
    const stats = weekStats(days);
    // 6 mi ≈ 9.66 km, rounded → 10
    expect(stats.volKm).toBe(10);
  });
  it("flags strength + tempo as quality, easy + rest as not", () => {
    const days = [
      {
        date: "2026-05-18",
        workouts: [makeRun(1, "2026-05-18", "Easy", "8 km")],
      },
      {
        date: "2026-05-19",
        workouts: [makeRun(2, "2026-05-19", "Tempo Run", "12 km")],
      },
      {
        date: "2026-05-20",
        workouts: [
          {
            id: 3,
            kind: "gym" as const,
            title: "Strength A",
            details: "45 min",
            status: "pending" as const,
            position: 0,
            logged_at: null,
          },
        ],
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
