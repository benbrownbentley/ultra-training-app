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

export interface Race {
  name: string;
  distance: string;
  date: string;
  elevation_gain: number | null;
  terrain: Terrain | null;
  target_time: string | null;
  intent: Intent | null;
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
}

export interface Plan {
  race: Race;
  days: Day[];
}
