import { describe, expect, it } from "vitest";
import {
  buildUserPrompt,
  formatHistory,
  formatJournal,
  formatProfile,
  formatRace,
  type JournalContextEntry,
  type LoggedWorkout,
} from "@/lib/claude";
import type { AthleteProfile, Race } from "@/lib/plan";

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
};

const fixtureProfile: AthleteProfile = {
  unit_system: "metric",
  weekly_volume: "65 km",
  longest_run_distance: 42,
  easy_pace: "6:00",
  injury_notes: "Right Achilles tightness — mild",
  experience: "Multiple ultras",
  gym_access: "full",
  equipment: "Weights, Pool",
  weekly_hours: 8,
  cross_training: "Cycling, Hiking",
  other_commitments: null,
  sleep_stress: null,
};

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
    expect(formatRace(fixtureRace, "metric")).toMatchInlineSnapshot(`
      "- Name: UTMB 2026
      - Distance: 171.5 km
      - Date: 2026-08-26
      - Elevation gain: 10040 m
      - Terrain: trail
      - Target finish time: 35:00
      - Race intent: moderate"
    `);
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
    expect(formatRace(bare, "metric")).toMatchInlineSnapshot(`
      "- Name: Local 25K
      - Distance: 25 km
      - Date: 2026-04-05"
    `);
  });
});

describe("formatProfile", () => {
  it("renders the full profile in metric", () => {
    expect(formatProfile(fixtureProfile)).toMatchInlineSnapshot(`
      "- Preferred units: metric
      - Current weekly running volume: 65 km
      - Longest run in past 4 weeks: 42 km
      - Comfortable easy pace: 6:00 (min/km)
      - Injuries / things to manage carefully: Right Achilles tightness — mild
      - Endurance experience: Multiple ultras
      - Gym access: full
      - Equipment available: Weights, Pool
      - Weekly training time available: 8 hours
      - Cross-training preferences: Cycling, Hiking"
    `);
  });
  it("uses imperial units for an imperial athlete", () => {
    const out = formatProfile({ ...fixtureProfile, unit_system: "imperial" });
    expect(out).toContain("Preferred units: imperial");
    expect(out).toContain("Longest run in past 4 weeks: 42 mi");
    expect(out).toContain("Comfortable easy pace: 6:00 (min/mi)");
  });
  it("falls back to 'none reported' when injury_notes is null", () => {
    const out = formatProfile({ ...fixtureProfile, injury_notes: null });
    expect(out).toContain(
      "Injuries / things to manage carefully: none reported",
    );
  });
});

describe("formatHistory", () => {
  it("renders one line per workout + a count header", () => {
    expect(formatHistory(fixtureHistory)).toMatchInlineSnapshot(`
      "Past workouts and adherence (2 completed, 1 skipped, 0 unlogged):
      2026-05-13 [run] Easy — 10 km @ 6:00/km  →  completed
      2026-05-14 [run] Long run — 32 km @ 6:30/km  →  completed
      2026-05-15 [gym] Strength A — 45 min lower body  →  skipped"
    `);
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
    expect(formatHistory(withActuals)).toMatchInlineSnapshot(`
      "Past workouts and adherence (1 completed, 0 skipped, 0 unlogged):
      2026-05-13 [run] Tempo — 60 min @ Z3  →  completed
        actual: 11.2 km · 1h02 · +180m · HR 158 · RPE 6
        "felt easy throughout, could have gone further"
        time in zone: Z3 42min · Z4 18min"
    `);
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
    expect(formatHistory(partial)).toMatchInlineSnapshot(`
      "Past workouts and adherence (1 completed, 0 skipped, 0 unlogged):
      2026-05-14 [run] Easy — 8 km easy  →  completed
        actual: 8.5 km · RPE 3"
    `);
  });
  it("returns the empty-history sentinel", () => {
    expect(formatHistory([])).toBe(
      "No logged history yet — this is the initial plan.",
    );
  });
});

describe("formatJournal", () => {
  it("returns empty string when no entries supplied", () => {
    expect(formatJournal(undefined)).toBe("");
    expect(formatJournal([])).toBe("");
  });
  it("marks unconsumed entries NEW and consumed (seen)", () => {
    expect(formatJournal(fixtureJournal)).toMatchInlineSnapshot(`
      "

      JOURNAL ENTRIES (athlete-logged context — travel, injuries, physio visits, free notes. Items flagged NEW haven't been factored into a plan yet):
      [NOTE · 2026-05-12] (NEW)
        Felt strong on the long run.
      [TRAVEL · 2026-05-20] (NEW)
        Wedding
        · dates: 2026-05-23 → 2026-05-25
        · impact: no_running
      [INJURY · 2026-05-10] (seen)
        Achilles
        · body_part: Achilles
        · side: right
        · severity: 3/10"
    `);
  });
});

describe("buildUserPrompt", () => {
  it("composes a stable prompt with race, profile, history, journal, and notes", () => {
    expect(
      buildUserPrompt({
        race: fixtureRace,
        profile: fixtureProfile,
        startDate: "2026-05-17",
        history: fixtureHistory,
        notes: "Push the volume a bit this week.",
        journalEntries: fixtureJournal,
      }),
    ).toMatchInlineSnapshot(`
      "Generate a training plan for the following runner.

      RACE
      - Name: UTMB 2026
      - Distance: 171.5 km
      - Date: 2026-08-26
      - Elevation gain: 10040 m
      - Terrain: trail
      - Target finish time: 35:00
      - Race intent: moderate

      RUNNER PROFILE
      - Preferred units: metric
      - Current weekly running volume: 65 km
      - Longest run in past 4 weeks: 42 km
      - Comfortable easy pace: 6:00 (min/km)
      - Injuries / things to manage carefully: Right Achilles tightness — mild
      - Endurance experience: Multiple ultras
      - Gym access: full
      - Equipment available: Weights, Pool
      - Weekly training time available: 8 hours
      - Cross-training preferences: Cycling, Hiking

      WORKOUT HISTORY
      Past workouts and adherence (2 completed, 1 skipped, 0 unlogged):
      2026-05-13 [run] Easy — 10 km @ 6:00/km  →  completed
      2026-05-14 [run] Long run — 32 km @ 6:30/km  →  completed
      2026-05-15 [gym] Strength A — 45 min lower body  →  skipped

      JOURNAL ENTRIES (athlete-logged context — travel, injuries, physio visits, free notes. Items flagged NEW haven't been factored into a plan yet):
      [NOTE · 2026-05-12] (NEW)
        Felt strong on the long run.
      [TRAVEL · 2026-05-20] (NEW)
        Wedding
        · dates: 2026-05-23 → 2026-05-25
        · impact: no_running
      [INJURY · 2026-05-10] (seen)
        Achilles
        · body_part: Achilles
        · side: right
        · severity: 3/10

      ATHLETE NOTES (just shared via the regenerate sheet — treat as the most recent context, overriding stale assumptions):
      Push the volume a bit this week.

      PLAN PARAMETERS
      - Start date (today): 2026-05-17
      - End date (race day): 2026-08-26
      - Athlete unit_system: metric. Use km for distance and min/km for pace in every workout's details. Never substitute metric.
      - Include a 2-week taper before race day
      - Include the race itself as the final workout on the race date
      - Generate workouts ONLY for dates from the start date onwards. Do NOT include any dates before the start date.

      Submit the plan using the submit_training_plan tool, including a coach-voice summary and a small array of change badges."
    `);
  });
});
