// Renderer-side projection of a workout's structured planned payload
// into the shape the WorkoutDetail UI expects. As of Phase 2 (see
// PHASE_2_SPEC.md) the source of truth is the `planned_detail` JSONB
// column, not the old free-text `details` string. The legacy backfill
// shape (`{ notes: <original text> }`) is handled by short-circuiting
// to a minimal WorkoutContent so the layout still renders honestly
// while structured data hasn't been regenerated yet.

import type {
  PlannedDetail,
  PlannedDetailStored,
  WorkoutKind,
} from "./plan";
import { isLegacyPlannedDetail } from "./planned-detail";

export type WorkoutSubtype =
  | "running"
  | "strength"
  | "mobility"
  | "physio"
  | "cross"
  | "hike";

export interface Segment {
  name: string;
  value: string;
  zone?: string;
  note?: string;
  emphasis: "low" | "high";
}

export interface Exercise {
  name: string;
  sets: number;
  reps: number;
  weight?: string;
  unit?: string;
  equip?: string;
  note?: string;
  isTime?: boolean;
}

export interface RoutineItem {
  name: string;
  spec?: string;
}

export interface PhysioExercise {
  name: string;
  spec?: string;
  // Pain rating, 1–10. Null until logged.
  pain: number | null;
  notes?: string;
}

export interface WorkoutContent {
  subtype: WorkoutSubtype;
  // Eyebrow sub-label fragment used after the date / week. E.g.
  // "RUN · TEMPO", "CROSS-TRAINING · HIKE".
  subLabel: string;
  description: string;
  why: string;
  glossarySlug: string | null;
  glossaryLabel: string;
  segments: Segment[];
  exercises: Exercise[];
  routine: RoutineItem[];
  physioExercises: PhysioExercise[];
  // For long hikes (>3h) — appears between metrics and STRUCTURE.
  fueling: string | null;
  // For strength — appears at the top of the exercise list.
  warmup: {
    duration: string;
    note: string;
    items: string[];
  } | null;
  // True when the row is a legacy backfilled `{ notes }` payload. The
  // drill-down uses this to show the prescription text as a plain notes
  // block until the user regenerates and full structured data lands.
  isLegacy: boolean;
  // Pre-Phase-2 free-text prescription preserved on the legacy fallback
  // path so the UI can render the original details. Empty for full
  // structured rows.
  legacyNotes: string;
}

// Cycling vs. swim is the one subcategory still inferred from title —
// the DB collapses both under the "cross" kind, but the eyebrow label
// reads better when we surface which sport. Hike / physio inference
// was removed once the DB grew first-class kinds for them.
const CYCLING_HINT_RE = /\bcycl(ing|e)|bike|spin\b/i;
const SWIMMING_HINT_RE = /\bswim/i;

// 1:1 mapping from the DB kind to the visual subtype that drives the
// variant body. Title text is no longer consulted — Claude / the user
// emit the correct kind directly.
export function pickSubtype(kind: WorkoutKind): WorkoutSubtype {
  if (kind === "run") return "running";
  if (kind === "gym") return "strength";
  if (kind === "hike") return "hike";
  if (kind === "cross") return "cross";
  if (kind === "physio") return "physio";
  return "mobility";
}

// Kind-specific eyebrow tail. The page assembles "WED 18 MAY · WK 6/18 ·
// BUILD · <tail>" — the tail tells the user which variant they're looking at.
export function subLabel(subtype: WorkoutSubtype, title: string): string {
  const t = title.toLowerCase();
  if (subtype === "running") {
    if (t.includes("tempo")) return "RUN · TEMPO";
    if (t.includes("hill")) return "RUN · HILLS";
    if (t.includes("long")) return "RUN · LONG";
    if (t.includes("interval")) return "RUN · INTERVALS";
    if (t.includes("easy") || t.includes("recovery")) return "RUN · EASY";
    if (t.includes("race")) return "RUN · RACE";
    return "RUN";
  }
  if (subtype === "strength") {
    if (t.includes("upper")) return "STRENGTH · UPPER";
    if (t.includes("lower")) return "STRENGTH · LOWER";
    if (t.includes("core")) return "STRENGTH · CORE";
    return "STRENGTH";
  }
  if (subtype === "hike") return "CROSS-TRAINING · HIKE";
  if (subtype === "cross") {
    if (CYCLING_HINT_RE.test(title)) return "CROSS-TRAINING · CYCLING";
    if (SWIMMING_HINT_RE.test(title)) return "CROSS-TRAINING · SWIM";
    return "CROSS-TRAINING";
  }
  if (subtype === "physio") return "MOBILITY · PHYSIO";
  return "MOBILITY";
}

// Stub copy keyed by subtype. These are intentionally generic — the day a
// plan generator emits real per-workout copy, swap the helper for a column
// read. Until then the layout still has *some* description / why text and
// reads honestly rather than empty.
const STUB_DESCRIPTION: Record<WorkoutSubtype, string> = {
  running: "Aerobic effort. Builds the engine that carries you through the back third of a long race.",
  strength: "Targeted strength work. Bulletproofs the joints that take a beating on the trails.",
  mobility: "Joint mobility and activation. Ten focused minutes anywhere.",
  physio: "Targeted prehab to keep cranky tissues honest. Log pain per exercise.",
  cross: "Cross-training. Aerobic stimulus without the impact load of running.",
  hike: "Time on feet at vert. Hill-strength stimulus without the impact of running.",
};

// Fallback `why` copy keyed by subtype. Used when the row has no
// generated `why` (legacy backfilled rows; rows created before Phase 2;
// custom user-added activities that didn't carry one). New regen-emitted
// rows carry per-workout `why` strings sourced from the `workouts.why`
// column, which is what the drill-down actually wants to display.
const STUB_WHY: Record<WorkoutSubtype, string> = {
  running: "Running is the spine of the plan — every session has a purpose, even the easy ones.",
  strength: "Lower-body strength carries you through the back third of an ultra, where quads are the limiter.",
  mobility: "Hip and ankle mobility is the single best injury-prevention investment for an ultrarunner.",
  physio: "Targeted prehab protects the next eight days of training. Log honestly so Claude knows if a tissue is heading the wrong way.",
  cross: "Active recovery: circulation without stimulus. Keep the cadence high and the effort low.",
  hike: "Conditions the legs for sustained climbing under fatigue and lets you practice mountain-pace fueling without the impact of running.",
};

const GLOSSARY_SLUG: Record<WorkoutSubtype, string | null> = {
  running: "tempo",
  strength: "strength-for-runners",
  mobility: "movement-prep",
  physio: "hip-glute-prehab",
  cross: "active-recovery",
  hike: "training-hikes",
};

const GLOSSARY_LABEL: Record<WorkoutSubtype, string> = {
  running: "Read more about endurance running",
  strength: "Read more about strength for trail running",
  mobility: "Read more about movement prep",
  physio: "Read more about hip & glute prehab",
  cross: "Read more about active recovery",
  hike: "Read more about training hikes",
};

// Format weight + unit for the renderer's Exercise.weight string. BW
// units render without a numeric prefix; numeric + unit cases produce
// "60kg" / "135lb"; everything else collapses to undefined.
function formatExerciseWeight(
  weight: number | null | undefined,
  unit: "kg" | "lb" | "bw" | null | undefined,
): { weight?: string; unit?: string } {
  if (unit === "bw") return { unit: "BW" };
  if (typeof weight === "number" && unit) {
    return { weight: String(weight), unit };
  }
  if (typeof weight === "number") return { weight: String(weight) };
  return {};
}

// Build a Segment row from a planned-detail run segment. Emphasis flips
// to high for anything that smells like main / interval / quality work
// so the renderer can elevate it visually.
function segmentFromRun(s: {
  label: string;
  duration_min?: number | null;
  distance_km?: number | null;
  zone?: string | null;
  intervals?: string | null;
  pace?: string | null;
  note?: string | null;
}): Segment {
  const valueParts: string[] = [];
  if (s.intervals) valueParts.push(s.intervals);
  else if (s.duration_min != null) valueParts.push(`${s.duration_min} min`);
  else if (s.distance_km != null) valueParts.push(`${s.distance_km} km`);
  if (s.pace) valueParts.push(`@ ${s.pace}`);
  const value = valueParts.join(" ") || s.label;
  const labelLower = s.label.toLowerCase();
  const isHigh =
    labelLower.includes("main") ||
    labelLower.includes("interval") ||
    labelLower.includes("tempo") ||
    labelLower.includes("strides") ||
    labelLower.includes("block");
  return {
    name: s.label,
    value,
    zone: s.zone ?? undefined,
    note: s.note ?? undefined,
    emphasis: isHigh ? "high" : "low",
  };
}

// Builds the structured projection of a full PlannedDetail. Mobility +
// physio + cross + hike all degenerate into either a routine, a
// physioExercises list, or a single descriptive segment that the
// renderer already knows how to display.
function projectStructured(
  pd: PlannedDetail,
): Pick<
  WorkoutContent,
  "segments" | "exercises" | "routine" | "physioExercises" | "fueling" | "warmup" | "description"
> {
  let segments: Segment[] = [];
  let exercises: Exercise[] = [];
  let routine: RoutineItem[] = [];
  let physioExercises: PhysioExercise[] = [];
  let fueling: string | null = null;
  let warmup: WorkoutContent["warmup"] = null;
  let description = "";

  if (pd.kind === "run") {
    segments = pd.segments.map(segmentFromRun);
    const summaryBits: string[] = [];
    if (pd.total_distance_km != null) summaryBits.push(`${pd.total_distance_km} km`);
    if (pd.total_duration_min != null) summaryBits.push(`${pd.total_duration_min} min`);
    if (pd.target_pace) summaryBits.push(`@ ${pd.target_pace}`);
    description = summaryBits.join(" · ");
  } else if (pd.kind === "gym" || pd.kind === "physio") {
    const exes = pd.exercises.map((e) => {
      const { weight, unit } = formatExerciseWeight(e.weight ?? null, e.unit ?? null);
      return {
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        weight,
        unit,
        equip: e.equipment ?? undefined,
        note: e.notes ?? undefined,
      };
    });
    if (pd.kind === "gym") {
      exercises = exes;
      if (pd.warmup) {
        warmup = {
          duration:
            pd.warmup.duration_min != null
              ? `~${pd.warmup.duration_min} min`
              : "warm-up",
          note: pd.warmup.note ?? "Build to working weight.",
          items: pd.warmup.items,
        };
      }
    } else {
      // physio — surface as physioExercises rows (per-exercise pain
      // capture lives on the actuals side, so pain starts null).
      physioExercises = pd.exercises.map((e, i) => ({
        name: e.name,
        spec: `${exes[i].sets}×${exes[i].reps}${exes[i].weight ? ` @ ${exes[i].weight}${exes[i].unit ?? ""}` : ""}`,
        pain: null,
        notes: e.notes ?? undefined,
      }));
    }
    if (pd.total_duration_min != null) {
      description = `${pd.total_duration_min} min`;
    }
  } else if (pd.kind === "mobility") {
    routine = pd.movements.map((m) => {
      const specBits: string[] = [];
      if (m.duration_s != null) specBits.push(`${m.duration_s}s`);
      if (m.side && m.side !== "both") {
        specBits.push(m.side === "each" ? "/side" : `(${m.side})`);
      }
      return {
        name: m.name,
        spec: specBits.join("").trim() || undefined,
      };
    });
    if (pd.total_duration_min != null) {
      description = `${pd.total_duration_min} min`;
    }
  } else if (pd.kind === "cross") {
    description = `${pd.duration_min} min ${pd.activity}${pd.target_zone ? ` · ${pd.target_zone}` : ""}`;
    segments = [
      {
        name: "Main set",
        value:
          pd.intervals ?? `${pd.duration_min} min ${pd.activity}`,
        zone: pd.target_zone ?? undefined,
        note: pd.notes ?? undefined,
        emphasis: "high",
      },
    ];
  } else {
    // hike
    const bits: string[] = [`${pd.duration_min} min`];
    if (pd.elevation_gain_m != null) bits.push(`+${pd.elevation_gain_m} m`);
    if (pd.target_zone) bits.push(pd.target_zone);
    description = bits.join(" · ");
    segments = [
      {
        name: "Main set",
        value: pd.intervals ?? `${pd.duration_min} min hike`,
        zone: pd.target_zone ?? undefined,
        note: pd.notes ?? undefined,
        emphasis: "high",
      },
    ];
    if (pd.fueling) fueling = pd.fueling;
  }

  return {
    segments,
    exercises,
    routine,
    physioExercises,
    fueling,
    warmup,
    description,
  };
}

// Single entry point used by the page. Phase 2: reads directly from the
// structured `planned_detail` payload. Legacy rows (`{ notes }`) fall
// through to a minimal-card path.
export function deriveWorkoutContent(
  kind: WorkoutKind,
  title: string,
  planned_detail: PlannedDetailStored,
  why?: string | null,
): WorkoutContent {
  const subtype = pickSubtype(kind);
  const base = {
    subtype,
    subLabel: subLabel(subtype, title),
    glossarySlug: GLOSSARY_SLUG[subtype],
    glossaryLabel: GLOSSARY_LABEL[subtype],
    why: why && why.trim().length > 0 ? why.trim() : STUB_WHY[subtype],
  };

  // Legacy backfilled row (or missing planned_detail entirely): nothing
  // structured to project. Surface the raw notes as the description and
  // let the renderer hide structural sections.
  if (planned_detail == null || isLegacyPlannedDetail(planned_detail)) {
    const notes = planned_detail == null ? "" : planned_detail.notes;
    return {
      ...base,
      description:
        notes.trim().length > 0 ? notes.trim() : STUB_DESCRIPTION[subtype],
      segments: [],
      exercises: [],
      routine: [],
      physioExercises: [],
      fueling: null,
      warmup: null,
      isLegacy: true,
      legacyNotes: notes,
    };
  }

  const projected = projectStructured(planned_detail);
  return {
    ...base,
    description:
      projected.description.length > 0
        ? projected.description
        : STUB_DESCRIPTION[subtype],
    segments: projected.segments,
    exercises: projected.exercises,
    routine: projected.routine,
    physioExercises: projected.physioExercises,
    fueling: projected.fueling,
    warmup: projected.warmup,
    isLegacy: false,
    legacyNotes: "",
  };
}

// Keep the existing extractMetrics call surface stable by re-exporting an
// alias here — callers can migrate at their own pace.
export type { MetricTile } from "@/app/_components/workout/extract-metrics";
export { extractMetrics } from "@/app/_components/workout/extract-metrics";

// Mobile-friendly: when raceDistanceKm is known, hint at vert importance for
// the running variant by elevating the VERT tile. Returned alongside content
// derivation so the caller can plumb it into MetricsRow without recomputing.
export function shouldElevateVert(
  raceDistanceKm: number | null | undefined,
): boolean {
  if (raceDistanceKm == null) return false;
  return raceDistanceKm >= 50;
}
