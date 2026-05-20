export type WorkoutKind = "run" | "gym" | "mobility";
export type WorkoutStatus = "pending" | "completed" | "skipped";

export interface Workout {
  id: number;
  kind: WorkoutKind;
  title: string;
  details: string;
  status: WorkoutStatus;
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
  weekly_hours: number | null;
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
  long_run_day?: string | null;
  quality_day?: string | null;
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
}

export interface Plan {
  race: Race;
  days: Day[];
}
