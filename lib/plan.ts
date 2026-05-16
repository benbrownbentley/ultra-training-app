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

export interface Race {
  name: string;
  distance: string;
  date: string;
}

export interface AthleteProfile {
  weekly_volume: string;
  longest_run_km: number;
  easy_pace: string;
  injury_notes: string | null;
}

export interface Plan {
  race: Race;
  days: Day[];
}
