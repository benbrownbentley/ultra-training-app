import type { WizardPayload, WizardRaceInput } from "@/app/actions";

export type { WizardPayload, WizardRaceInput };

export const TERRAIN_OPTS = [
  { value: "trail", label: "Trail" },
  { value: "road", label: "Road" },
  { value: "mixed", label: "Mixed" },
  { value: "technical", label: "Technical" },
] as const;

export const ULTRA_COUNT_OPTS = ["0", "1-3", "4-10", "10+"] as const;
export const SEX_OPTS = [
  "Male",
  "Female",
  "Other",
  "Prefer not to say",
] as const;
export const SLEEP_OPTS = ["5", "6", "7", "8", "9"] as const;
export const TRAIN_DAYS = ["M", "Tu", "W", "Th", "F", "Sa", "Su"] as const;
export const LONG_DAY_OPTS = ["Sat", "Sun", "Other"] as const;
export const QUALITY_DAY_OPTS = ["Tue", "Wed", "Thu", "Mixed"] as const;
export const STRENGTH_FREQ_OPTS = ["None", "1×", "2×", "3×"] as const;
export const GYM_OPTS = ["full", "limited", "none"] as const;
export const GYM_LABELS: Record<(typeof GYM_OPTS)[number], string> = {
  full: "Full",
  limited: "Limited",
  none: "None",
};
export const EQUIP_OPTS = [
  "Treadmill",
  "Indoor trainer",
  "Weights",
  "Pool",
  "None",
] as const;
export const TERRAIN_ACCESS_OPTS = [
  "Trails nearby",
  "Hills nearby",
  "Mountains nearby",
  "Flat only",
] as const;
export const CROSS_OPTS = [
  "Cycling",
  "Swimming",
  "Hiking",
  "Rowing",
  "None",
] as const;

export const FITNESS_LABELS = [
  "Just starting out",
  "Building base fitness",
  "Consistent training",
  "Trained · racing regularly",
  "Highly trained · competitive",
];

export const INTENT_LABELS: Array<{
  value: "competitive" | "moderate" | "relaxed";
  label: string;
  help: string;
}> = [
  {
    value: "competitive",
    label: "Competitive",
    help: "Race to win or place. High intensity.",
  },
  {
    value: "moderate",
    label: "Finish strong",
    help: "Race for a strong personal effort.",
  },
  {
    value: "relaxed",
    label: "Just finish",
    help: "Get to the finish line, enjoy the day.",
  },
];

// Starting payload — sane defaults so the user only edits what matters.
export const EMPTY_PAYLOAD: WizardPayload = {
  unitSystem: "metric",
  aRace: {
    priority: "A",
    name: "",
    date: "",
    distance: "",
    elevationGain: null,
    terrain: null,
    targetTime: "",
    intent: "moderate",
  },
  otherRaces: [],
  fitnessRating: 3,
  weeklyVolumeKm: null,
  weeklyHours: null,
  longestRunDistance: null,
  longestRunDate: null,
  yearsRunning: null,
  yearsUltras: null,
  ultrasCompleted: "",
  longestRaceDistance: null,
  longestRaceName: "",
  longestRaceDate: "",
  age: null,
  sex: "",
  bodyWeight: null,
  injuryNotes: "",
  chronicConditions: "",
  sleepHours: null,
  stressBaseline: 3,
  trainingDays: [],
  longRunDay: "",
  qualityDay: "",
  strengthFreq: "",
  gymAccess: null,
  equipment: [],
  outdoorTerrain: [],
  crossTrainingEnjoys: [],
};
