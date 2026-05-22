export type WorkoutKind =
  | "run"
  | "gym"
  | "mobility"
  | "hike"
  | "cross"
  | "physio";
export type WorkoutStatus = "pending" | "completed" | "skipped";

// Origin of the workout record. `manual` for everything Vert emits in
// v2; `device` is the seam for v3+ external-sync (Strava / Garmin /
// Apple Health). Brand-specific names live one enum-expansion away if
// the UI ever needs to differentiate. See PHASE_2_SPEC.md §3.3.
export type WorkoutSource = "manual" | "device";

// ----- Planned-side structured payload (replaces the old free-text
// `details` column on workouts). Discriminated union on `kind` — every
// variant carries the same `kind` value that the outer workout row
// carries, which is the strict-discriminator pattern the validator
// enforces. See PHASE_2_SPEC.md §3.2 / §4.2.

export interface PlannedRunSegment {
  label: string;
  duration_min?: number | null;
  distance_km?: number | null;
  zone?: string | null;
  intervals?: string | null;
  pace?: string | null;
  note?: string | null;
}

export interface PlannedExercise {
  name: string;
  equipment?: string | null;
  sets: number;
  reps: number;
  weight?: number | null;
  unit?: "kg" | "lb" | "bw" | null;
  notes?: string | null;
}

export interface PlannedPhysioExercise extends PlannedExercise {
  pain_focus?: string | null;
}

export interface PlannedMovement {
  name: string;
  duration_s?: number | null;
  side?: "both" | "each" | "left" | "right" | null;
  notes?: string | null;
}

export interface PlannedWarmupBlock {
  duration_min?: number | null;
  items: string[];
  note?: string | null;
}

export interface PlannedDetailRun {
  kind: "run";
  segments: PlannedRunSegment[];
  total_duration_min?: number | null;
  total_distance_km?: number | null;
  total_elevation_gain_m?: number | null;
  target_pace?: string | null;
}

export interface PlannedDetailGym {
  kind: "gym";
  exercises: PlannedExercise[];
  warmup?: PlannedWarmupBlock | null;
  total_duration_min?: number | null;
}

export interface PlannedDetailPhysio {
  kind: "physio";
  exercises: PlannedPhysioExercise[];
  total_duration_min?: number | null;
}

export interface PlannedDetailMobility {
  kind: "mobility";
  movements: PlannedMovement[];
  total_duration_min?: number | null;
}

export interface PlannedDetailCross {
  kind: "cross";
  activity: string;
  duration_min: number;
  target_zone?: string | null;
  intervals?: string | null;
  notes?: string | null;
}

export interface PlannedDetailHike {
  kind: "hike";
  duration_min: number;
  elevation_gain_m?: number | null;
  target_zone?: string | null;
  intervals?: string | null;
  fueling?: string | null;
  notes?: string | null;
}

export type PlannedDetail =
  | PlannedDetailRun
  | PlannedDetailGym
  | PlannedDetailPhysio
  | PlannedDetailMobility
  | PlannedDetailCross
  | PlannedDetailHike;

// Legacy shape written by the Phase 2 backfill migration for every row
// that existed before `details` was dropped. Renderers detect this by
// the absence of `kind` and fall back to a minimal card. New writes
// (RPC + addCustomActivity) emit either a full PlannedDetail or this
// minimal shape, never a partial mix.
export interface LegacyPlannedDetail {
  notes: string;
}

// What the workouts.planned_detail column may hold at read time.
export type PlannedDetailStored =
  | PlannedDetail
  | LegacyPlannedDetail
  | null;

// Kind-specific actuals shape — sparse by design. Runs carry `zones`;
// strength carries `sets`/`skipped_exercises`/`added_exercises`; physio
// + mobility carry `exercises`. All optional so a partially-filled log
// doesn't force every consumer to branch on shape.
export interface ActualDetail {
  zones?: { label: string; minutes: number }[];
  // Strength: per-set actuals keyed by exerciseName so the renderer
  // groups them under each planned or user-added exercise.
  sets?: {
    exerciseName: string;
    reps: number;
    weight: number;
    unit: string;
  }[];
  // Strength: names of planned exercises the user marked skipped.
  skipped_exercises?: string[];
  // Strength: exercises the user added on top of the plan. Their sets
  // live in `sets[]` above with the same `exerciseName`; this list
  // preserves planned-side metadata so the status-badge logic can
  // compare actuals against the user's own targets.
  added_exercises?: {
    name: string;
    plannedSets: number;
    plannedReps: number;
    plannedWeight: number;
    plannedUnit: string;
  }[];
  // Physio + Mobility — per-exercise checkbox / pain / free-text note.
  exercises?: {
    name: string;
    done: boolean;
    pain?: number | null;
    note?: string | null;
  }[];
}

export interface Workout {
  id: number;
  kind: WorkoutKind;
  title: string;
  // Structured planned payload. Pre-Phase-2 rows were backfilled with
  // the legacy `{ notes: <original text> }` shape; new RPC writes carry
  // a full PlannedDetail. The renderer detects which shape it has.
  planned_detail: PlannedDetailStored;
  // Per-workout coach-voice rationale. ≤500 chars. Null for legacy
  // backfilled rows — the renderer falls back to STUB_WHY[subtype].
  why: string | null;
  // Origin of the row. Always `manual` in v2; `device` is the seam for
  // v3+ device sync.
  source: WorkoutSource;
  status: WorkoutStatus;
  // Order within the day (0 = primary, 1 = secondary, …). Sourced from
  // the `workouts.position` column so diff comparisons can stabilise
  // multi-workout days deterministically.
  position: number;
  // ISO timestamp written when the user logs the workout. Null while
  // pending; rendered as the "DONE · HH:MM" caption on cards.
  logged_at: string | null;
  // Captured-on-the-day actuals. All optional — the UI surfaces "+ ADD
  // ACTUALS" until any field is populated. Internal units stay metric;
  // display layer converts via lib/units.ts.
  actual_duration_min: number | null;
  actual_distance_km: number | null;
  actual_elevation_gain_m: number | null;
  actual_hr_avg: number | null;
  actual_rpe: number | null;
  actual_notes: string | null;
  actual_detail: ActualDetail | null;
  // True when the user inserted this workout via the "Add activity" flow.
  // Regen preserves these — see migration 0014 / commit_plan_preview RPC.
  is_custom: boolean;
}

export interface Day {
  date: string;
  workouts: Workout[];
}

export type Terrain = "road" | "mixed" | "trail" | "technical";
export type Intent = "competitive" | "moderate" | "relaxed";
export type GymAccess = "full" | "limited" | "none";
export type UnitSystem = "metric" | "imperial";

export type RacePriority = "A" | "B" | "C" | "completed";

export interface Race {
  id?: number;
  name: string;
  distance: string;
  date: string;
  elevation_gain: number | null;
  terrain: Terrain | null;
  target_time: string | null;
  intent: Intent | null;
  priority?: RacePriority;
  elevation_loss?: number | null;
  cutoff_time?: string | null;
  climate?: string | null;
  course_profile?: string | null;
  support?: string | null;
}

export interface AthleteProfile {
  unit_system: UnitSystem;
  weekly_volume: string;
  longest_run_distance: number;
  easy_pace: string;
  injury_notes: string | null;
  experience: string | null;
  gym_access: GymAccess | null;
  equipment: string | null;
  // Semantically: hours per week the athlete is *available* to train.
  // The "currently training" counterpart is `weekly_hours_current`.
  weekly_hours: number | null;
  weekly_hours_current?: number | null;
  cross_training: string | null;
  other_commitments: string | null;
  sleep_stress: string | null;
  // Expanded columns surfaced by the /profile/athlete form. All nullable
  // so legacy rows keep working unchanged.
  fitness_rating?: number | null;
  weekly_volume_km?: number | null;
  longest_run_date?: string | null;
  years_running?: number | null;
  years_ultras?: number | null;
  ultras_completed?: string | null;
  longest_race_distance?: number | null;
  longest_race_name?: string | null;
  longest_race_date?: string | null;
  previous_endurance?: string[] | null;
  age?: number | null;
  body_weight?: number | null;
  sex?: string | null;
  chronic_conditions?: string | null;
  sleep_hours?: number | null;
  stress_baseline?: number | null;
  training_days?: string[] | null;
  // Legacy single-value columns; new code reads/writes the *_days
  // arrays. Kept so older rows still surface in the prompt.
  long_run_day?: string | null;
  quality_day?: string | null;
  long_run_days?: string[] | null;
  quality_days?: string[] | null;
  strength_freq?: string | null;
  time_of_day?: string | null;
  job_type?: string | null;
  outdoor_terrain?: string[] | null;
  cross_training_enjoys?: string[] | null;
  max_hr?: number | null;
  resting_hr?: number | null;
  lactate_threshold_hr?: number | null;
  vo2_max?: number | null;
  training_preferences?: string | null;
  // App-level preferences. Co-located on athlete_profile because the
  // row's already fetched on every Profile render.
  theme?: "light" | "dark" | "system" | null;
  daily_reminder?: boolean | null;
  regen_complete_notify?: boolean | null;
  weekly_summary?: boolean | null;
}

export interface Plan {
  race: Race;
  days: Day[];
}
