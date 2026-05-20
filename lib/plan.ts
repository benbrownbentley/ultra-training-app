export type WorkoutKind = "run" | "gym" | "mobility";
export type WorkoutStatus = "pending" | "completed" | "skipped";

// Kind-specific actuals shape — sparse by design. Runs carry `zones`;
// strength carries `sets`; physio + mobility carry `exercises`. All
// optional so a partially-filled log doesn't force every consumer to
// branch on shape.
export interface ActualDetail {
  zones?: { label: string; minutes: number }[];
  sets?: {
    exerciseName: string;
    reps: number;
    weight: number;
    unit: string;
  }[];
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
  details: string;
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
