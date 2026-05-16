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

export const plan: Plan = {
  race: {
    name: "Squamish 50K",
    distance: "50 km",
    date: "2026-08-15",
  },
  days: [
    {
      date: "2026-05-11",
      workouts: [
        {
          kind: "gym",
          title: "Upper body strength",
          details: "45 min — push/pull, core finisher",
        },
      ],
    },
    {
      date: "2026-05-12",
      workouts: [
        { kind: "run", title: "Tempo run", details: "6 mi @ 7:30 pace" },
        { kind: "gym", title: "Core", details: "15 min — planks, hollow holds" },
      ],
    },
    {
      date: "2026-05-13",
      workouts: [
        { kind: "run", title: "Easy run", details: "5 mi conversational" },
      ],
    },
    {
      date: "2026-05-14",
      workouts: [
        { kind: "run", title: "Hill repeats", details: "6 mi w/ 6 × 90s climbs" },
        {
          kind: "gym",
          title: "Lower body strength",
          details: "45 min — squats, hinges, single-leg",
        },
      ],
    },
    {
      date: "2026-05-15",
      workouts: [
        { kind: "run", title: "Shake-out run", details: "3 mi very easy" },
        { kind: "mobility", title: "Mobility", details: "20 min foam roll + hips" },
      ],
    },
    {
      date: "2026-05-16",
      workouts: [
        { kind: "run", title: "Long run", details: "14 mi steady on trails" },
      ],
    },
    {
      date: "2026-05-17",
      workouts: [
        { kind: "run", title: "Recovery run", details: "6 mi easy" },
        { kind: "mobility", title: "Stretching", details: "20 min full body" },
      ],
    },
  ],
};
