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

/**
 * Renders the type-specific `details` JSON into bullet lines for the
 * Claude prompt. Pure formatting — no business logic. Lives here (not
 * in the orchestrator) so both the session-scoped action and the
 * admin-scoped server-to-server advance engine can format consistently.
 */
export function formatJournalDetails(entry: JournalEntry): string[] {
  if (entry.type === "travel" && entry.details) {
    const d = entry.details;
    return [
      `dates: ${d.start_date} → ${d.end_date}`,
      `impact: ${d.impact.length ? d.impact.join(", ") : "unspecified"}`,
    ];
  }
  if (entry.type === "injury" && entry.details) {
    const d = entry.details;
    const lines = [
      `body_part: ${d.body_part}`,
      `side: ${d.side}`,
      `severity: ${d.severity}/10`,
    ];
    if (d.pain_quality.length)
      lines.push(`pain_quality: ${d.pain_quality.join(", ")}`);
    if (d.restrictions.length)
      lines.push(`restrictions: ${d.restrictions.join(", ")}`);
    if (d.started_date) lines.push(`started: ${d.started_date}`);
    if (d.check_back_in_days)
      lines.push(`check_back_in: ${d.check_back_in_days} days`);
    return lines;
  }
  if (entry.type === "physio" && entry.details) {
    const d = entry.details;
    const lines = [`diagnosis: ${d.diagnosis}`];
    if (d.physio_name) lines.push(`physio: ${d.physio_name}`);
    if (d.visit_date) lines.push(`visit: ${d.visit_date}`);
    if (d.restrictions.length)
      lines.push(`restrictions: ${d.restrictions.join(", ")}`);
    if (d.exercises.length) {
      const ex = d.exercises
        .map(
          (e) =>
            `${e.name} — ${e.sets_reps}${e.load ? ` @ ${e.load}` : ""}${
              e.frequency ? ` (${e.frequency})` : ""
            }`,
        )
        .join("; ");
      lines.push(`exercises: ${ex}`);
    }
    if (d.duration_value && d.duration_unit === "weeks")
      lines.push(`duration: ${d.duration_value} weeks`);
    if (d.duration_unit === "until_resolved")
      lines.push("duration: until symptoms resolve");
    return lines;
  }
  return [];
}

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
