import { describe, expect, it } from "vitest";
import {
  deriveWorkoutContent,
  parseRunningSegments,
  parseStrengthExercises,
  parseRoutine,
  pickSubtype,
} from "./workout-content";

describe("pickSubtype", () => {
  it("maps each DB kind 1:1 onto the visual subtype", () => {
    expect(pickSubtype("run")).toBe("running");
    expect(pickSubtype("gym")).toBe("strength");
    expect(pickSubtype("hike")).toBe("hike");
    expect(pickSubtype("cross")).toBe("cross");
    expect(pickSubtype("physio")).toBe("physio");
    expect(pickSubtype("mobility")).toBe("mobility");
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
  it("splits on the em-dot separator into rows", () => {
    const r = parseRoutine(
      "World's greatest stretch · 90/90 hip switches · Ankle rocks · Cossack squats",
    );
    expect(r.length).toBe(4);
    expect(r[0].name).toContain("greatest");
    expect(r.every((x) => x.spec === undefined)).toBe(true);
  });

  it("skips a leading 'N min' duration header", () => {
    const r = parseRoutine(
      "15 min · World's greatest stretch · 90/90 hip switches · Ankle rocks",
    );
    expect(r.length).toBe(3);
    expect(r[0].name).toContain("greatest");
    expect(r.map((x) => x.name)).not.toContain("15 min");
  });

  it("extracts a trailing 3×10 spec from a fragment", () => {
    const r = parseRoutine("15 min · Banded clamshell 3×10 · Glute bridge");
    expect(r.length).toBe(2);
    expect(r[0]).toEqual({ name: "Banded clamshell", spec: "3×10" });
    expect(r[1]).toEqual({ name: "Glute bridge" });
  });

  it("extracts a trailing 30s/side spec", () => {
    const r = parseRoutine("Couch stretch 30s/side · 90/90 hip switches");
    expect(r.length).toBe(2);
    expect(r[0]).toEqual({ name: "Couch stretch", spec: "30s/side" });
  });

  it("tolerates extra whitespace around separators", () => {
    const r = parseRoutine(
      "  15 min   ·   Hip flexor stretch   ·   Ankle rocks   ",
    );
    expect(r.length).toBe(2);
    expect(r[0].name).toBe("Hip flexor stretch");
    expect(r[1].name).toBe("Ankle rocks");
  });

  it("returns empty for malformed / single-fragment input", () => {
    expect(parseRoutine("").length).toBe(0);
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
      deriveWorkoutContent("hike", "Trail Hike", "~4 hr hike at Z1").fueling,
    ).not.toBeNull();
    expect(
      deriveWorkoutContent("hike", "Recovery Hike", "2 hr easy hike").fueling,
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
