import { describe, expect, it } from "vitest";
import {
  deriveWorkoutContent,
  parseRunningSegments,
  parseStrengthExercises,
  parseRoutine,
  pickSubtype,
} from "./workout-content";

describe("pickSubtype", () => {
  it("maps gym kind to strength", () => {
    expect(pickSubtype("gym", "Strength A")).toBe("strength");
  });

  it("routes run-kind hike titles to the hike subtype", () => {
    expect(pickSubtype("run", "Vert Hike")).toBe("hike");
    expect(pickSubtype("run", "Trail Hike")).toBe("hike");
  });

  it("routes mobility-kind physio titles to the physio subtype", () => {
    expect(pickSubtype("mobility", "Physio · Hip & Glute")).toBe("physio");
  });

  it("routes cycling / swim mobility-kind workouts to cross", () => {
    expect(pickSubtype("mobility", "Easy Spin")).toBe("cross");
    expect(pickSubtype("mobility", "Open-water Swim")).toBe("cross");
  });
});

describe("parseRunningSegments", () => {
  it("extracts warm-up, main set, cool-down with zones", () => {
    const segments = parseRunningSegments(
      "Warm-up: 15 min easy at Z1–Z2. Main set: 4×8 min at Z3 tempo. Cool-down: 10 min easy at Z1.",
    );
    expect(segments.length).toBe(3);
    expect(segments[0].name).toBe("Warm-up");
    expect(segments[1].name).toBe("Main set");
    expect(segments[1].emphasis).toBe("high");
    expect(segments[2].name).toBe("Cool-down");
  });

  it("returns empty when neither structure nor a value is present", () => {
    const segments = parseRunningSegments("Easy session, no specifics.");
    expect(segments).toEqual([]);
  });

  it("falls back to a single Main set when only a zone is mentioned", () => {
    const segments = parseRunningSegments("Tempo block at Z3, 45 minutes.");
    expect(segments.length).toBe(1);
    expect(segments[0].name).toBe("Main set");
    expect(segments[0].zone).toBe("Z3");
  });
});

describe("parseStrengthExercises", () => {
  it("parses sets, reps, weight, and unit", () => {
    const ex = parseStrengthExercises(
      "Squat 4×6 @ 60kg. Romanian Deadlift 3×8 @ 50kg. Walking Lunge 3×8 @ 20kg.",
    );
    expect(ex.length).toBe(3);
    expect(ex[0]).toMatchObject({ name: "Squat", sets: 4, reps: 6, weight: "60", unit: "kg" });
  });

  it("returns empty when nothing matches", () => {
    expect(parseStrengthExercises("Easy mobility session.")).toEqual([]);
  });
});

describe("parseRoutine", () => {
  it("splits on bullets / dots into rows", () => {
    const r = parseRoutine(
      "World's greatest stretch · 90/90 hip switches · Ankle rocks · Cossack squats",
    );
    expect(r.length).toBe(4);
    expect(r[0].name).toContain("greatest");
  });

  it("returns empty when only one line is present", () => {
    expect(parseRoutine("Just one block").length).toBe(0);
  });
});

describe("deriveWorkoutContent", () => {
  it("surfaces a description and why stub for the chosen subtype", () => {
    const c = deriveWorkoutContent("run", "Tempo Run", "Easy 6km");
    expect(c.subtype).toBe("running");
    expect(c.subLabel).toBe("RUN · TEMPO");
    expect(c.description.length).toBeGreaterThan(0);
    expect(c.why.length).toBeGreaterThan(0);
  });

  it("attaches a fueling reminder only to long hikes", () => {
    expect(
      deriveWorkoutContent("run", "Trail Hike", "~4 hr hike at Z1").fueling,
    ).not.toBeNull();
    expect(
      deriveWorkoutContent("run", "Recovery Hike", "2 hr easy hike").fueling,
    ).toBeNull();
  });

  it("attaches a warm-up reminder when squat / deadlift / press is in the exercise list", () => {
    const c = deriveWorkoutContent(
      "gym",
      "Strength A",
      "Squat 4×6 @ 60kg. Bench Press 4×6 @ 50kg.",
    );
    expect(c.warmup).not.toBeNull();
  });
});
