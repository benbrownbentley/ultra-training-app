import { describe, expect, it } from "vitest";
import { deriveWorkoutContent, pickSubtype } from "./workout-content";
import type { PlannedDetail } from "@/lib/plan";

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

describe("deriveWorkoutContent — structured payloads", () => {
  it("projects a run payload into segment rows with zones", () => {
    const pd: PlannedDetail = {
      kind: "run",
      segments: [
        { label: "Warm-up", duration_min: 15, zone: "Z1-Z2", note: "easy spin" },
        { label: "Main set", duration_min: 40, zone: "Z3", intervals: "4 × 8 min" },
        { label: "Cool-down", duration_min: 10, zone: "Z1" },
      ],
      total_duration_min: 65,
      target_pace: "5:30/km",
    };
    const c = deriveWorkoutContent("run", "Tempo Run", pd, "Phase B build day.");
    expect(c.subtype).toBe("running");
    expect(c.isLegacy).toBe(false);
    expect(c.segments).toHaveLength(3);
    expect(c.segments[0].name).toBe("Warm-up");
    expect(c.segments[1].emphasis).toBe("high");
    expect(c.segments[2].name).toBe("Cool-down");
    expect(c.why).toBe("Phase B build day.");
  });

  it("projects a gym payload into exercise rows + warmup", () => {
    const pd: PlannedDetail = {
      kind: "gym",
      exercises: [
        { name: "Squat", sets: 4, reps: 6, weight: 60, unit: "kg" },
        { name: "RDL", sets: 3, reps: 8, weight: 50, unit: "kg" },
      ],
      warmup: { duration_min: 8, items: ["Goblet squat 2 × 8"], note: "Build slowly" },
      total_duration_min: 45,
    };
    const c = deriveWorkoutContent("gym", "Lower body", pd, null);
    expect(c.subtype).toBe("strength");
    expect(c.exercises).toHaveLength(2);
    expect(c.exercises[0]).toMatchObject({ name: "Squat", sets: 4, reps: 6, weight: "60", unit: "kg" });
    expect(c.warmup).not.toBeNull();
    expect(c.warmup!.items).toContain("Goblet squat 2 × 8");
  });

  it("projects a physio payload into physioExercises with null pain", () => {
    const pd: PlannedDetail = {
      kind: "physio",
      exercises: [
        {
          name: "Heavy slow calf raises",
          sets: 3,
          reps: 8,
          weight: 20,
          unit: "kg",
          pain_focus: "achilles",
        },
      ],
    };
    const c = deriveWorkoutContent("physio", "Achilles prehab", pd, null);
    expect(c.subtype).toBe("physio");
    expect(c.physioExercises).toHaveLength(1);
    expect(c.physioExercises[0].name).toBe("Heavy slow calf raises");
    expect(c.physioExercises[0].pain).toBeNull();
  });

  it("projects a mobility payload into routine rows with side specs", () => {
    const pd: PlannedDetail = {
      kind: "mobility",
      movements: [
        { name: "World's greatest stretch", duration_s: 60, side: "each" },
        { name: "Couch stretch", duration_s: 60, side: "both" },
      ],
      total_duration_min: 15,
    };
    const c = deriveWorkoutContent("mobility", "Mobility", pd, null);
    expect(c.subtype).toBe("mobility");
    expect(c.routine).toHaveLength(2);
    expect(c.routine[0]).toMatchObject({ name: "World's greatest stretch" });
    expect(c.routine[0].spec).toContain("60s");
    expect(c.routine[1].spec).toBe("60s");
  });

  it("projects a cross payload as a single main-set segment with zone", () => {
    const pd: PlannedDetail = {
      kind: "cross",
      activity: "cycling",
      duration_min: 60,
      target_zone: "Z2",
      notes: "easy spin",
    };
    const c = deriveWorkoutContent("cross", "Bike spin", pd, null);
    expect(c.subtype).toBe("cross");
    expect(c.segments).toHaveLength(1);
    expect(c.segments[0].zone).toBe("Z2");
    expect(c.subLabel).toBe("CROSS-TRAINING · CYCLING");
  });

  it("projects a hike payload + surfaces fueling when present", () => {
    const pd: PlannedDetail = {
      kind: "hike",
      duration_min: 240,
      elevation_gain_m: 1200,
      target_zone: "Z1-Z2",
      fueling: "60g carbs/hr, 500ml water/hr",
    };
    const c = deriveWorkoutContent("hike", "Vert hike", pd, null);
    expect(c.subtype).toBe("hike");
    expect(c.fueling).toContain("60g carbs");
    expect(c.subLabel).toBe("CROSS-TRAINING · HIKE");
  });

  it("uses provided `why` over the subtype stub", () => {
    const pd: PlannedDetail = {
      kind: "run",
      segments: [{ label: "Main set", duration_min: 30 }],
    };
    const c = deriveWorkoutContent("run", "Easy Run", pd, "Specific session rationale.");
    expect(c.why).toBe("Specific session rationale.");
  });

  it("falls back to STUB_WHY when no `why` is provided", () => {
    const pd: PlannedDetail = {
      kind: "run",
      segments: [{ label: "Main set", duration_min: 30 }],
    };
    const c = deriveWorkoutContent("run", "Easy Run", pd, null);
    expect(c.why.length).toBeGreaterThan(0);
  });
});

describe("deriveWorkoutContent — legacy backfilled rows", () => {
  it("renders a legacy { notes } payload as a minimal card without throwing", () => {
    const c = deriveWorkoutContent(
      "run",
      "Tempo Run",
      { notes: "10 km @ 6:00/km easy" },
      null,
    );
    expect(c.isLegacy).toBe(true);
    expect(c.legacyNotes).toBe("10 km @ 6:00/km easy");
    expect(c.segments).toEqual([]);
    expect(c.exercises).toEqual([]);
    expect(c.routine).toEqual([]);
    expect(c.description).toBe("10 km @ 6:00/km easy");
  });

  it("falls back to the subtype description when notes are empty", () => {
    const c = deriveWorkoutContent("mobility", "Mobility", { notes: "" }, null);
    expect(c.isLegacy).toBe(true);
    expect(c.description.length).toBeGreaterThan(0);
  });

  it("handles a null planned_detail without throwing", () => {
    const c = deriveWorkoutContent("gym", "Strength", null, null);
    expect(c.isLegacy).toBe(true);
    expect(c.legacyNotes).toBe("");
  });
});
