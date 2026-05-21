// Best-effort parser turning a free-text Claude-generated `details` string
// into the structured payload the Workout Detail design expects. Where data
// can't be parsed (most v1 plans), the helper falls back to kind-specific
// stub copy so the design layout still renders honestly — the user sees a
// real eyebrow + description even if the AI hasn't been asked to emit
// structured prose yet.

import type { WorkoutKind } from "./plan";

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

const STUB_WHY: Record<WorkoutSubtype, string> = {
  running: "Running is the spine of the plan — every session has a purpose, even the easy ones. Today's effort matches where you are in the build, and how Claude has weighed your recent adherence and feedback.",
  strength: "Lower-body strength carries you through the back third of an ultra, where quads are the limiter. Today's session targets the posterior chain — the muscles that take over when quads fade.",
  mobility: "Hip and ankle mobility is the single best injury-prevention investment for an ultrarunner. Ten minutes a day pays for itself in week 12 of a build cycle.",
  physio: "Targeted prehab protects the next eight days of training. Log honestly so Claude knows if a tissue is heading the wrong way.",
  cross: "Active recovery: circulation without stimulus. Keep the cadence high and the effort low — if you can't hold a conversation you're going too hard.",
  hike: "Your race profile has thousands of metres of vert — most of it climbed at hiking pace. Today conditions the legs for sustained climbing under fatigue and lets you practice mountain-pace fueling without the impact of running.",
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

// Pull warm-up / main set / cool-down out of the details string. Claude
// tends to emit "Warm-up: 15 min easy. Main set: 4×8 min @ Z3. Cool-down:
// 10 min easy." — we split on these labels and assign zones if present.
export function parseRunningSegments(details: string): Segment[] {
  const segments: Segment[] = [];
  const lower = details.toLowerCase();

  const warmupMatch = details.match(
    /warm[\s-]?up[:\s]+([^.;]+?)(?=(?:[.;]|\bmain\s|\bcool[\s-]?down))/i,
  );
  const mainMatch = details.match(
    /(?:main set|main)[:\s]+([^.;]+?)(?=(?:[.;]|\bcool[\s-]?down))/i,
  );
  const cooldownMatch = details.match(
    /cool[\s-]?down[:\s]+([^.;]+)/i,
  );

  if (warmupMatch) {
    segments.push({
      name: "Warm-up",
      value: extractValue(warmupMatch[1]) ?? warmupMatch[1].trim(),
      zone: extractZone(warmupMatch[1]) ?? "Z1–Z2",
      note: stripValueAndZone(warmupMatch[1]),
      emphasis: "low",
    });
  }
  if (mainMatch) {
    segments.push({
      name: "Main set",
      value: extractValue(mainMatch[1]) ?? mainMatch[1].trim(),
      zone: extractZone(mainMatch[1]) ?? extractZone(details) ?? "Z3",
      note: stripValueAndZone(mainMatch[1]),
      emphasis: "high",
    });
  }
  if (cooldownMatch) {
    segments.push({
      name: "Cool-down",
      value: extractValue(cooldownMatch[1]) ?? cooldownMatch[1].trim(),
      zone: extractZone(cooldownMatch[1]) ?? "Z1",
      note: stripValueAndZone(cooldownMatch[1]),
      emphasis: "low",
    });
  }

  // Fallback — no labelled sections found. If the details has a zone
  // reference and a duration, render as a single "main set" so the
  // STRUCTURE block isn't empty.
  if (segments.length === 0) {
    const zone = extractZone(details);
    const value = extractValue(details);
    if (zone || value) {
      segments.push({
        name: "Main set",
        value: value ?? details.trim(),
        zone: zone ?? undefined,
        note: stripValueAndZone(details),
        emphasis: "high",
      });
    }
  }

  // Defensive: if the lower-cased details have neither "warm" nor "main"
  // nor "cool", and we got nothing above, leave segments empty so the
  // caller hides the STRUCTURE block.
  if (
    segments.length === 0 &&
    !lower.includes("warm") &&
    !lower.includes("main") &&
    !lower.includes("cool")
  ) {
    return [];
  }

  return segments;
}

const VALUE_RE = /(\d+(?:\.\d+)?)\s*(min|hr|h|km|mi|sec|s)\b/i;
const ZONE_RE = /(Z\d(?:[–-]Z\d)?)/i;
const INTERVAL_RE = /(\d+\s*[×x]\s*(?:\(?[^,;)]+\)?))/i;

function extractValue(text: string): string | null {
  const interval = text.match(INTERVAL_RE);
  if (interval) return interval[1].replace(/\s*[×x]\s*/, " × ").trim();
  const m = text.match(VALUE_RE);
  if (!m) return null;
  return `${m[1]} ${m[2].toLowerCase().startsWith("h") ? "hr" : m[2].toLowerCase()}`;
}

function extractZone(text: string): string | null {
  const m = text.match(ZONE_RE);
  return m ? m[1].toUpperCase().replace("-", "–") : null;
}

function stripValueAndZone(text: string): string | undefined {
  const cleaned = text
    .replace(VALUE_RE, "")
    .replace(ZONE_RE, "")
    .replace(/^[\s,·.:-]+|[\s,·.:-]+$/g, "")
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

// "Squat 4×6 @ 60kg", "Romanian Deadlift 3×8 @ 50kg", one per line / comma.
const EXERCISE_LINE_RE =
  /([A-Z][A-Za-z' /-]+?)\s+(\d+)\s*[×x]\s*(\d+)\s*(?:@\s*([\d.]+)\s*(kg|lb|lbs|bw)?)?/g;

export function parseStrengthExercises(details: string): Exercise[] {
  const exercises: Exercise[] = [];
  for (const match of details.matchAll(EXERCISE_LINE_RE)) {
    const [, name, sets, reps, weight, unit] = match;
    exercises.push({
      name: name.trim(),
      sets: Number(sets),
      reps: Number(reps),
      weight: weight ?? undefined,
      unit: unit?.toLowerCase() === "bw" ? "BW" : unit,
    });
  }
  return exercises;
}

// Mobility / physio routine parser. Claude emits free-text mobility
// details in several shapes:
//   "15 min · World's greatest stretch · 90/90 hip switches"
//   "15 min — hip flexor, glute, calf stretching"
//   "10 min — Couch stretch 30s/side, World's greatest stretch 3×5"
//
// We strip a leading "N min" duration header, then split on any of the
// common separators Claude uses: middot, bullet, em-dash, comma. Each
// fragment may carry a trailing spec ("3×10", "30s/side") which we
// peel off so the row renders with the name on the left and spec on
// the right.
//
// TODO v2: replace this parser with structured routine emission from
// Claude. Extend submit_training_plan's tool schema to accept
// `routine: {name: string; spec?: string}[]` per mobility workout,
// then this parser becomes a legacy fallback for old rows only.

// Matches at the END of a fragment:
//   • "3x10" / "3×10"
//   • "2x5/side" / "2×5 per side"
//   • "60s" / "30s/side"
const SPEC_RE =
  /\s+(\d+\s*[x×]\s*\d+(?:\s*(?:s|\/side|\s+per\s+side))?|\d+\s*s(?:\/side)?)\s*$/i;

// "15 min — ", "20 min · ", "5min, " etc. when it sits at the very
// start of the details. The trailing separator is consumed so we don't
// emit an empty fragment after stripping.
const DURATION_HEADER_RE = /^\s*\d+\s*min\s*[—·•,-]?\s*/i;

export function parseRoutine(details: string): RoutineItem[] {
  if (!details || !details.trim()) return [];

  // Strip a leading duration header so we don't emit "15 min" as a
  // routine item — the prescription section already conveys total
  // duration.
  const stripped = details.replace(DURATION_HEADER_RE, "");

  // Split on every separator Claude actually uses. Comma + em-dash are
  // the most common; middot + bullet are kept for older rows. Hyphen
  // is intentionally NOT in the class — "90/90 hip-switches" would
  // get torn apart.
  const fragments = stripped
    .split(/[·•—,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (fragments.length === 0) return [];

  // Cap at 8 entries so a misparse on a wordy prescription doesn't
  // dump twenty fragments into the UI.
  return fragments
    .slice(0, 8)
    .map((frag) => {
      const m = frag.match(SPEC_RE);
      if (m) {
        const name = frag.slice(0, m.index).trim();
        const spec = m[1].replace(/\s+/g, "");
        return name ? { name, spec } : { name: frag };
      }
      return { name: frag };
    })
    .filter((r) => r.name.length > 0 && !/^[,.\s-]+$/.test(r.name));
}

// Single entry point used by the page.
export function deriveWorkoutContent(
  kind: WorkoutKind,
  title: string,
  details: string,
): WorkoutContent {
  const subtype = pickSubtype(kind);

  const segments =
    subtype === "running" || subtype === "hike" || subtype === "cross"
      ? parseRunningSegments(details)
      : [];

  const exercises =
    subtype === "strength" ? parseStrengthExercises(details) : [];

  const routine =
    subtype === "mobility" ? parseRoutine(details) : [];

  const physioExercises =
    subtype === "physio"
      ? parseRoutine(details).map<PhysioExercise>((r) => ({
          name: r.name,
          spec: r.spec,
          pain: null,
        }))
      : [];

  // Long-hike fueling reminder — surfaced when the title or details look
  // like a multi-hour effort.
  const fueling = (() => {
    if (subtype !== "hike") return null;
    const hours = details.match(/(\d+(?:\.\d+)?)\s*(?:hr|h)\b/i);
    if (!hours) return null;
    if (Number(hours[1]) < 3) return null;
    return "Fuel ~80g carbs/hr · 1.5L water";
  })();

  // Generic warm-up reminder for heavy lifts. We can't know "heaviness"
  // from text, so emit when the parsed exercises include a Squat / DL.
  const warmup =
    subtype === "strength" &&
    exercises.some((e) => /squat|deadlift|press/i.test(e.name))
      ? {
          duration: "~8 min",
          note: "Build to working weight. Heavy compound lifts need a thorough ramp-up.",
          items: [
            "Goblet squat · 2 × 8 light",
            "Glute bridge · 2 × 10 BW",
            "Working set ramps · 50% → 70% → 90%",
          ],
        }
      : null;

  return {
    subtype,
    subLabel: subLabel(subtype, title),
    description: STUB_DESCRIPTION[subtype],
    why: STUB_WHY[subtype],
    glossarySlug: GLOSSARY_SLUG[subtype],
    glossaryLabel: GLOSSARY_LABEL[subtype],
    segments,
    exercises,
    routine,
    physioExercises,
    fueling,
    warmup,
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
