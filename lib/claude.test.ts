import { describe, expect, it } from "vitest";
import {
  buildUserPrompt,
  computeAdherence,
  formatAdherenceSummary,
  formatHistory,
  formatJournal,
  formatOtherRaces,
  formatPreviousSummary,
  formatProfile,
  formatRace,
  type JournalContextEntry,
  type LoggedWorkout,
} from "@/lib/claude";
import type { AthleteProfile, Race } from "@/lib/plan";
import type { GenerationSummary } from "@/lib/preview";

// Fixed "today" for adherence tests so the rolling-window math is
// deterministic. Aligns with fixtureHistory dates (2026-05-13/14/15)
// such that all three sit inside the last 7 days when today=2026-05-17.
const FIXTURE_TODAY = "2026-05-17";

// All fixtures are hand-authored, ISO-fixed strings — no `new Date()`
// or `Date.now()` references — so the snapshots stay deterministic
// across day boundaries and machines.

const fixtureRace: Race = {
  name: "UTMB 2026",
  distance: "171.5 km",
  date: "2026-08-26",
  elevation_gain: 10040,
  terrain: "trail",
  target_time: "35:00",
  intent: "moderate",
  priority: "A",
};

const fixtureProfile: AthleteProfile = {
  unit_system: "metric",
  weekly_volume: "65 km",
  longest_run_distance: 42,
  // easy_pace lives on the type for legacy compatibility but the wizard
  // doesn't capture it yet — formatProfile no longer reads it.
  easy_pace: "",
  injury_notes: "Right Achilles tightness — mild",
  experience: "Multiple ultras",
  gym_access: "full",
  equipment: "Weights, Pool",
  weekly_hours: 8,
  cross_training: "Cycling, Hiking",
  other_commitments: null,
  sleep_stress: null,
  // Expanded wizard-collected fields
  fitness_rating: 4,
  years_running: 8,
  years_ultras: 3,
  ultras_completed: "4-10",
  longest_race_distance: 100,
  longest_race_name: "Black Canyon",
  longest_race_date: "2024-02-17",
  age: 38,
  sex: "Male",
  body_weight: 72,
  chronic_conditions: null,
  sleep_hours: 7,
  stress_baseline: 3,
  training_days: ["M", "Tu", "W", "Th", "F", "Sa", "Su"],
  long_run_days: ["Sa"],
  quality_days: ["W"],
  strength_freq: "2×",
  outdoor_terrain: ["Trails nearby", "Hills nearby"],
};

const fixtureBRaces: Race[] = [
  {
    name: "Vancouver Marathon",
    distance: "42.2 km",
    date: "2026-05-31",
    elevation_gain: 180,
    terrain: "road",
    target_time: null,
    intent: "moderate",
    priority: "B",
  },
  {
    name: "Knee Knacker 50K",
    distance: "50 km",
    date: "2026-07-11",
    elevation_gain: 2500,
    terrain: "technical",
    target_time: null,
    intent: "relaxed",
    priority: "C",
  },
];

const fixtureHistory: LoggedWorkout[] = [
  {
    date: "2026-05-13",
    kind: "run",
    title: "Easy",
    details: "10 km @ 6:00/km",
    status: "completed",
  },
  {
    date: "2026-05-14",
    kind: "run",
    title: "Long run",
    details: "32 km @ 6:30/km",
    status: "completed",
  },
  {
    date: "2026-05-15",
    kind: "gym",
    title: "Strength A",
    details: "45 min lower body",
    status: "skipped",
  },
];

const fixtureJournal: JournalContextEntry[] = [
  {
    type: "note",
    entry_date: "2026-05-12",
    title: null,
    body: "Felt strong on the long run.",
    details_lines: [],
    consumed: false,
  },
  {
    type: "travel",
    entry_date: "2026-05-20",
    title: "Wedding",
    body: null,
    details_lines: ["dates: 2026-05-23 → 2026-05-25", "impact: no_running"],
    consumed: false,
  },
  {
    type: "injury",
    entry_date: "2026-05-10",
    title: "Achilles",
    body: null,
    details_lines: [
      "body_part: Achilles",
      "side: right",
      "severity: 3/10",
    ],
    consumed: true,
  },
];

describe("formatRace", () => {
  it("includes every populated field for metric", () => {
    const out = formatRace(fixtureRace, "metric");
    expect(out).toContain("Name: UTMB 2026");
    expect(out).toContain("Elevation gain: 10040 m");
    expect(out).toContain("Terrain: trail");
  });
  it("switches elevation unit to ft for imperial", () => {
    expect(formatRace(fixtureRace, "imperial")).toContain(
      "Elevation gain: 10040 ft",
    );
  });
  it("omits missing fields", () => {
    const bare: Race = {
      name: "Local 25K",
      distance: "25 km",
      date: "2026-04-05",
      elevation_gain: null,
      terrain: null,
      target_time: null,
      intent: null,
    };
    const out = formatRace(bare, "metric");
    expect(out).toContain("Name: Local 25K");
    expect(out).not.toContain("Elevation gain");
    expect(out).not.toContain("Terrain");
  });
});

describe("formatOtherRaces", () => {
  it("returns empty string when no other races", () => {
    expect(formatOtherRaces(undefined, "metric")).toBe("");
    expect(formatOtherRaces([], "metric")).toBe("");
  });
  it("formats B and C races with their priority labels", () => {
    const out = formatOtherRaces(fixtureBRaces, "metric");
    expect(out).toContain("OTHER RACES");
    expect(out).toContain("B-race · 2026-05-31 · Vancouver Marathon · 42.2 km");
    expect(out).toContain("C-race · 2026-07-11 · Knee Knacker 50K · 50 km");
    expect(out).toContain("180 m gain");
    expect(out).toContain("2500 m gain");
  });
  it("switches elevation unit to ft for imperial", () => {
    const out = formatOtherRaces(fixtureBRaces, "imperial");
    expect(out).toContain("180 ft gain");
  });
});

describe("formatProfile", () => {
  it("includes the expanded wizard fields", () => {
    const out = formatProfile(fixtureProfile);
    expect(out).toContain("Preferred units: metric");
    expect(out).toContain(
      "Self-rated fitness: 4/5 (trained, racing regularly)",
    );
    expect(out).toContain("Years running: 8");
    expect(out).toContain("Years doing ultras: 3");
    expect(out).toContain("Ultras completed: 4-10");
    expect(out).toContain(
      "Longest race ever: 100 km (Black Canyon), 2024-02-17",
    );
    expect(out).toContain("Typical sleep: 7 hrs/night");
    expect(out).toContain("Baseline life stress: 3/5 (moderate)");
    expect(out).toContain("Age: 38");
    expect(out).toContain("Sex: Male");
    expect(out).toContain("Body weight: 72 kg");
    expect(out).toContain(
      "Outdoor terrain access: Trails nearby, Hills nearby",
    );
    expect(out).toContain("Training days available: M, Tu, W, Th, F, Sa, Su");
    expect(out).toContain("Preferred strength frequency: 2×");
  });
  it("no longer references easy_pace", () => {
    const out = formatProfile(fixtureProfile);
    expect(out).not.toContain("Comfortable easy pace");
  });
  it("uses imperial units for an imperial athlete", () => {
    const out = formatProfile({ ...fixtureProfile, unit_system: "imperial" });
    expect(out).toContain("Preferred units: imperial");
    expect(out).toContain("Longest run in past 4 weeks: 42 mi");
    expect(out).toContain("Body weight: 72 lb");
  });
  it("omits expanded fields when null", () => {
    const minimal: AthleteProfile = {
      unit_system: "metric",
      weekly_volume: "30 km",
      longest_run_distance: 15,
      easy_pace: "",
      injury_notes: null,
      experience: null,
      gym_access: null,
      equipment: null,
      weekly_hours: null,
      cross_training: null,
      other_commitments: null,
      sleep_stress: null,
    };
    const out = formatProfile(minimal);
    expect(out).not.toContain("Self-rated fitness");
    expect(out).not.toContain("Years running");
    expect(out).not.toContain("Age:");
    expect(out).toContain("Injuries / things to manage carefully: none reported");
  });
  it("falls back to 'none reported' when injury_notes is null", () => {
    const out = formatProfile({ ...fixtureProfile, injury_notes: null });
    expect(out).toContain(
      "Injuries / things to manage carefully: none reported",
    );
  });
});

describe("formatHistory", () => {
  it("renders an adherence summary + recent workouts block", () => {
    const out = formatHistory(fixtureHistory, FIXTURE_TODAY);
    expect(out).toContain("ADHERENCE SUMMARY");
    expect(out).toContain("Last 7 days: 2/3 completed (67%), 1 skipped, 0 unlogged");
    expect(out).toContain("This cycle (since 2026-05-13)");
    expect(out).toContain("RECENT WORKOUTS (last 28 days, detailed)");
    expect(out).toContain("2026-05-13 [run] Easy — 10 km @ 6:00/km  →  completed");
    expect(out).toContain("2026-05-15 [gym] Strength A — 45 min lower body  →  skipped");
  });
  it("includes by-kind breakdown and most-recent-skipped line", () => {
    const out = formatHistory(fixtureHistory, FIXTURE_TODAY);
    expect(out).toContain("By kind (last 28 days): runs 2/2, strength 0/1");
    expect(out).toContain("Most recent skipped: 2026-05-15 [gym] Strength A");
  });
  it("appends actuals + notes + time-in-zone under a logged workout", () => {
    const withActuals: LoggedWorkout[] = [
      {
        date: "2026-05-13",
        kind: "run",
        title: "Tempo",
        details: "60 min @ Z3",
        status: "completed",
        actual_duration_min: 62,
        actual_distance_km: 11.2,
        actual_elevation_gain_m: 180,
        actual_hr_avg: 158,
        actual_rpe: 6,
        actual_notes: "felt easy throughout, could have gone further",
        actual_detail: {
          zones: [
            { label: "Z3", minutes: 42 },
            { label: "Z4", minutes: 18 },
          ],
        },
      },
    ];
    const out = formatHistory(withActuals, FIXTURE_TODAY);
    expect(out).toContain("actual: 11.2 km · 1h02 · +180m · HR 158 · RPE 6");
    expect(out).toContain("\"felt easy throughout, could have gone further\"");
    expect(out).toContain("time in zone: Z3 42min · Z4 18min");
  });
  it("renders only the populated actuals fields, no placeholder gaps", () => {
    const partial: LoggedWorkout[] = [
      {
        date: "2026-05-14",
        kind: "run",
        title: "Easy",
        details: "8 km easy",
        status: "completed",
        actual_distance_km: 8.5,
        actual_rpe: 3,
      },
    ];
    const out = formatHistory(partial, FIXTURE_TODAY);
    expect(out).toContain("actual: 8.5 km · RPE 3");
  });
  it("classifies strength exercises vs. planned (overrides + short)", () => {
    const strength: LoggedWorkout[] = [
      {
        date: "2026-05-15",
        kind: "gym",
        title: "Strength A",
        details: "Squat 4×6 @ 60kg, RDL 3×8 @ 50kg, Walking Lunge 3×8 @ 20kg, Calf Raise 3×12 @ 30kg",
        status: "completed",
        actual_notes: "RDL felt heavy on last set",
        // Threaded by attachPlannedExercises at history-build time.
        planned_exercises: [
          { name: "Squat", sets: 4, reps: 6, weight: 60, unit: "kg" },
          { name: "Romanian Deadlift", sets: 3, reps: 8, weight: 50, unit: "kg" },
          { name: "Walking Lunge", sets: 3, reps: 8, weight: 20, unit: "kg" },
          { name: "Calf Raise", sets: 3, reps: 12, weight: 30, unit: "kg" },
        ],
        actual_detail: {
          sets: [
            // Squat: all at planned
            { exerciseName: "Squat", reps: 6, weight: 60, unit: "kg" },
            { exerciseName: "Squat", reps: 6, weight: 60, unit: "kg" },
            { exerciseName: "Squat", reps: 6, weight: 60, unit: "kg" },
            { exerciseName: "Squat", reps: 6, weight: 60, unit: "kg" },
            // RDL: last set short (planned reps=8, got 7)
            { exerciseName: "Romanian Deadlift", reps: 8, weight: 50, unit: "kg" },
            { exerciseName: "Romanian Deadlift", reps: 8, weight: 50, unit: "kg" },
            { exerciseName: "Romanian Deadlift", reps: 7, weight: 50, unit: "kg" },
            // Walking Lunge: override (lighter weight, planned 20, got 18)
            { exerciseName: "Walking Lunge", reps: 8, weight: 18, unit: "kg" },
          ],
          skipped_exercises: ["Calf Raise"],
          added_exercises: [
            {
              name: "Hip Thrust",
              plannedSets: 3,
              plannedReps: 10,
              plannedWeight: 70,
              plannedUnit: "kg",
            },
          ],
        },
      },
    ];
    const out = formatHistory(strength, FIXTURE_TODAY);
    expect(out).toContain(
      "strength: 3 exercises (1 with overrides, 1 short)",
    );
    expect(out).toContain("skipped: Calf Raise");
    expect(out).toContain("user-added: Hip Thrust");
    expect(out).toContain("\"RDL felt heavy on last set\"");
  });
  it("falls back to raw totals when planned_exercises is missing", () => {
    const strength: LoggedWorkout[] = [
      {
        date: "2026-05-15",
        kind: "gym",
        title: "Strength A",
        details: "Full body",
        status: "completed",
        actual_detail: {
          sets: [
            { exerciseName: "Squat", reps: 6, weight: 60, unit: "kg" },
            { exerciseName: "RDL", reps: 8, weight: 50, unit: "kg" },
            { exerciseName: "RDL", reps: 7, weight: 50, unit: "kg" },
          ],
        },
      },
    ];
    const out = formatHistory(strength, FIXTURE_TODAY);
    expect(out).toContain("strength: 3 sets across 2 exercises");
  });
  it("skips the strength line when no detail is present", () => {
    const bare: LoggedWorkout[] = [
      {
        date: "2026-05-15",
        kind: "gym",
        title: "Strength A",
        details: "Full body",
        status: "completed",
      },
    ];
    expect(formatHistory(bare, FIXTURE_TODAY)).not.toContain("strength:");
  });
  it("returns the empty-history sentinel", () => {
    expect(formatHistory([], FIXTURE_TODAY)).toBe(
      "No logged history yet — this is the initial plan.",
    );
  });
  it("splits older workouts into a compressed EARLIER block past the 28-day cutoff", () => {
    // Construct history straddling the cutoff: one workout 35 days back
    // (well outside the 28-day detailed window) + one inside the window.
    const olderHistory: LoggedWorkout[] = [
      {
        // 2026-04-10 = 37 days before 2026-05-17 → goes into EARLIER bucket
        date: "2026-04-10",
        kind: "run",
        title: "Easy",
        details: "8 km easy",
        status: "completed",
      },
      {
        date: "2026-05-13",
        kind: "run",
        title: "Easy",
        details: "10 km @ 6:00/km",
        status: "completed",
      },
    ];
    const out = formatHistory(olderHistory, FIXTURE_TODAY);
    expect(out).toContain("EARLIER IN THIS CYCLE (rolled up — not shown per-workout)");
    expect(out).toContain("Range: 2026-04-10 → 2026-04-10");
    // Older workout should NOT appear as a detailed line.
    expect(out).not.toContain("2026-04-10 [run] Easy — 8 km easy");
    // Recent workout should appear.
    expect(out).toContain("2026-05-13 [run] Easy — 10 km @ 6:00/km");
  });
});

describe("computeAdherence", () => {
  it("returns empty stats for empty history", () => {
    const a = computeAdherence([], FIXTURE_TODAY);
    expect(a.cycle.totalWorkouts).toBe(0);
    expect(a.cycleStartDate).toBeNull();
    expect(a.mostRecentSkipped).toBeNull();
    expect(a.skipClusters).toEqual([]);
  });
  it("computes rolling-window stats with completion rate as a fraction", () => {
    const a = computeAdherence(fixtureHistory, FIXTURE_TODAY);
    expect(a.last7.totalWorkouts).toBe(3);
    expect(a.last7.completed).toBe(2);
    expect(a.last7.skipped).toBe(1);
    expect(a.last7.completionRate).toBeCloseTo(2 / 3, 5);
    expect(a.cycle.totalWorkouts).toBe(3);
    expect(a.cycleStartDate).toBe("2026-05-13");
  });
  it("breaks down last 28 days by kind", () => {
    const a = computeAdherence(fixtureHistory, FIXTURE_TODAY);
    expect(a.byKindLast28.run.totalWorkouts).toBe(2);
    expect(a.byKindLast28.run.completed).toBe(2);
    expect(a.byKindLast28.gym.totalWorkouts).toBe(1);
    expect(a.byKindLast28.gym.completed).toBe(0);
    expect(a.byKindLast28.mobility.totalWorkouts).toBe(0);
  });
  it("flags the most recently skipped workout", () => {
    const a = computeAdherence(fixtureHistory, FIXTURE_TODAY);
    expect(a.mostRecentSkipped?.date).toBe("2026-05-15");
    expect(a.mostRecentSkipped?.kind).toBe("gym");
  });
  it("detects skip clusters of ≥2 consecutive days", () => {
    const withCluster: LoggedWorkout[] = [
      { date: "2026-05-11", kind: "run", title: "Easy", details: "", status: "skipped" },
      { date: "2026-05-12", kind: "run", title: "Easy", details: "", status: "skipped" },
      { date: "2026-05-13", kind: "run", title: "Easy", details: "", status: "skipped" },
      { date: "2026-05-14", kind: "run", title: "Easy", details: "", status: "completed" },
      { date: "2026-05-15", kind: "gym", title: "S", details: "", status: "skipped" },
    ];
    const a = computeAdherence(withCluster, FIXTURE_TODAY);
    expect(a.skipClusters).toHaveLength(1);
    expect(a.skipClusters[0]).toEqual({
      startDate: "2026-05-11",
      endDate: "2026-05-13",
      days: 3,
    });
  });
  it("does NOT count a day as a skip day if any workout that day was completed", () => {
    const mixed: LoggedWorkout[] = [
      { date: "2026-05-13", kind: "run", title: "Easy", details: "", status: "skipped" },
      { date: "2026-05-13", kind: "gym", title: "S", details: "", status: "completed" },
      { date: "2026-05-14", kind: "run", title: "Easy", details: "", status: "skipped" },
      { date: "2026-05-15", kind: "run", title: "Easy", details: "", status: "skipped" },
    ];
    const a = computeAdherence(mixed, FIXTURE_TODAY);
    // Only 2026-05-14 and 2026-05-15 are skip days; 2026-05-13 has a
    // completed workout so it doesn't count.
    expect(a.skipClusters).toHaveLength(1);
    expect(a.skipClusters[0].startDate).toBe("2026-05-14");
    expect(a.skipClusters[0].days).toBe(2);
  });
});

describe("formatAdherenceSummary", () => {
  it("returns empty string when history is empty", () => {
    const a = computeAdherence([], FIXTURE_TODAY);
    expect(formatAdherenceSummary(a)).toBe("");
  });
  it("renders all populated sections", () => {
    const a = computeAdherence(fixtureHistory, FIXTURE_TODAY);
    const out = formatAdherenceSummary(a);
    expect(out).toContain("ADHERENCE SUMMARY");
    expect(out).toContain("Last 7 days: 2/3 completed (67%)");
    expect(out).toContain("This cycle (since 2026-05-13)");
    expect(out).toContain("By kind (last 28 days): runs 2/2, strength 0/1");
    expect(out).toContain("Most recent skipped: 2026-05-15 [gym] Strength A");
  });
});

describe("formatPreviousSummary", () => {
  it("returns empty string when no prior summary", () => {
    expect(formatPreviousSummary(null)).toBe("");
    expect(formatPreviousSummary(undefined)).toBe("");
    expect(
      formatPreviousSummary({ summary: "   ", changes: [] }),
    ).toBe("");
  });
  it("renders the prior coach message + change badges", () => {
    const prev: GenerationSummary = {
      summary:
        "You missed two long runs — pulled back this week's volume and swapped Wednesday quality.",
      changes: [
        { type: "shifted", text: "Sat long → Sun" },
        { type: "reduced", text: "weekly volume −8%" },
      ],
    };
    const out = formatPreviousSummary(prev);
    expect(out).toContain("PREVIOUS COACH MESSAGE");
    expect(out).toContain(
      "\"You missed two long runs — pulled back this week's volume and swapped Wednesday quality.\"",
    );
    expect(out).toContain("- SHIFTED Sat long → Sun");
    expect(out).toContain("- REDUCED weekly volume −8%");
  });
});

describe("formatJournal", () => {
  it("returns empty string when no entries supplied", () => {
    expect(formatJournal(undefined)).toBe("");
    expect(formatJournal([])).toBe("");
  });
  it("marks unconsumed entries NEW and consumed (seen)", () => {
    const out = formatJournal(fixtureJournal);
    expect(out).toContain("[NOTE · 2026-05-12] (NEW)");
    expect(out).toContain("[TRAVEL · 2026-05-20] (NEW)");
    expect(out).toContain("[INJURY · 2026-05-10] (seen)");
    expect(out).toContain("dates: 2026-05-23 → 2026-05-25");
  });
});

describe("buildUserPrompt", () => {
  it("composes a prompt with all major sections in the expected order", () => {
    const previousSummary: GenerationSummary = {
      summary: "Last week we pulled back volume after your skipped long run.",
      changes: [{ type: "reduced", text: "weekly volume −8%" }],
    };
    const out = buildUserPrompt({
      race: fixtureRace,
      otherRaces: fixtureBRaces,
      profile: fixtureProfile,
      startDate: "2026-05-17",
      history: fixtureHistory,
      notes: "Push the volume a bit this week.",
      journalEntries: fixtureJournal,
      previousSummary,
    });
    const raceIdx = out.indexOf("RACE\n");
    const otherIdx = out.indexOf("OTHER RACES");
    const profIdx = out.indexOf("RUNNER PROFILE");
    const histIdx = out.indexOf("WORKOUT HISTORY");
    const journalIdx = out.indexOf("JOURNAL ENTRIES");
    const notesIdx = out.indexOf("ATHLETE NOTES");
    const prevIdx = out.indexOf("PREVIOUS COACH MESSAGE");
    const paramsIdx = out.indexOf("PLAN PARAMETERS");
    expect(raceIdx).toBeGreaterThan(-1);
    expect(otherIdx).toBeGreaterThan(raceIdx);
    expect(profIdx).toBeGreaterThan(otherIdx);
    expect(histIdx).toBeGreaterThan(profIdx);
    expect(journalIdx).toBeGreaterThan(histIdx);
    expect(notesIdx).toBeGreaterThan(journalIdx);
    expect(prevIdx).toBeGreaterThan(notesIdx);
    expect(paramsIdx).toBeGreaterThan(prevIdx);
    expect(out).toContain("Start date (today): 2026-05-17");
    expect(out).toContain("End date (race day): 2026-08-26");
  });
  it("omits the OTHER RACES section when otherRaces is undefined", () => {
    const out = buildUserPrompt({
      race: fixtureRace,
      profile: fixtureProfile,
      startDate: "2026-05-17",
      history: [],
    });
    expect(out).not.toContain("OTHER RACES");
  });
  it("omits the PREVIOUS COACH MESSAGE section when previousSummary is null", () => {
    const out = buildUserPrompt({
      race: fixtureRace,
      profile: fixtureProfile,
      startDate: "2026-05-17",
      history: [],
      previousSummary: null,
    });
    expect(out).not.toContain("PREVIOUS COACH MESSAGE");
  });
});
