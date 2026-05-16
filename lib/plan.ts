export const TODAY = "2026-05-15";

export type WorkoutKind = "run" | "gym" | "mobility";

export interface Workout {
  kind: WorkoutKind;
  title: string;
  details: string;
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

export interface Plan {
  race: Race;
  days: Day[];
}
