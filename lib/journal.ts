// Journal entry shapes. The DB row stores `type` + a jsonb `details`
// payload whose schema varies by type; the discriminated union below
// keeps the rest of the app honest about which fields it can read.

export type JournalEntryType = "note" | "travel" | "injury" | "physio";

export type ImpactChoice =
  | "no_running"
  | "no_gym"
  | "light_only"
  | "normal"
  | "depends";

export type InjurySide = "left" | "right" | "both" | "na";

export type PhysioDurationUnit = "weeks" | "until_resolved";

export interface PhysioExercise {
  name: string;
  sets_reps: string;
  load: string;
  frequency: string;
}

export interface TravelDetails {
  start_date: string;
  end_date: string;
  impact: ImpactChoice[];
}

export interface InjuryDetails {
  body_part: string;
  side: InjurySide;
  severity: number;
  pain_quality: string[];
  started_date: string | null;
  restrictions: string[];
  check_back_in_days: number | null;
}

export interface PhysioDetails {
  physio_name: string | null;
  visit_date: string;
  diagnosis: string;
  restrictions: string[];
  exercises: PhysioExercise[];
  duration_value: number | null;
  duration_unit: PhysioDurationUnit;
}

interface BaseEntry {
  id: number;
  entry_date: string;
  title: string | null;
  body: string | null;
  consumed: boolean;
  created_at: string;
}

export interface NoteEntry extends BaseEntry {
  type: "note";
  details: null;
}

export interface TravelEntry extends BaseEntry {
  type: "travel";
  details: TravelDetails;
}

export interface InjuryEntry extends BaseEntry {
  type: "injury";
  details: InjuryDetails;
}

export interface PhysioEntry extends BaseEntry {
  type: "physio";
  details: PhysioDetails;
}

export type JournalEntry =
  | NoteEntry
  | TravelEntry
  | InjuryEntry
  | PhysioEntry;

export const IMPACT_LABELS: Record<ImpactChoice, string> = {
  no_running: "No running",
  no_gym: "No gym",
  light_only: "Light only",
  normal: "Normal training",
  depends: "Depends · see notes",
};

export const PAIN_QUALITIES = [
  "Sharp",
  "Dull",
  "Ache",
  "Sting",
  "Throbbing",
  "Stiff",
  "Weak",
] as const;

export const BODY_PARTS = [
  "Knee",
  "Ankle",
  "Achilles",
  "Hip",
  "Foot",
  "Calf",
  "Hamstring",
  "Quad",
  "Lower back",
  "IT band",
  "Plantar fascia",
  "Other",
] as const;

export const INJURY_RESTRICTIONS = [
  "No running",
  "No impact",
  "No downhill",
  "Reduce volume",
  "Stretch only",
  "Rest completely",
  "Modify strength",
  "Other",
] as const;

export const PHYSIO_RESTRICTIONS = [
  "No downhill",
  "Limit volume",
  "Daily stretching",
  "Eccentric calf work",
  "Modify strength",
  "Other",
] as const;
