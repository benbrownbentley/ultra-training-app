// Best-effort parser turning a free-text `details` string (Claude generates
// these — e.g. "10 km @ 6:00/km easy", "45 min — squats, RDLs") into the
// structured metric tiles the design expects.
//
// Returns whatever tiles it can extract; the caller hides the row entirely
// if the result is empty, so misses are silent rather than rendering
// half-empty placeholders.

import type { WorkoutKind } from "@/lib/plan";

export interface MetricTile {
  label: string;
  value: string;
  unit?: string;
  primary?: boolean;
}

const DISTANCE_RE = /(\d+(?:\.\d+)?)\s*(km|mi)\b/i;
const DURATION_RE = /(\d+(?:\.\d+)?)\s*(min|hr|h)\b/i;
const VERT_RE = /\+\s*(\d+(?:\,\d+)?)\s*m\b/i;
const SETS_REPS_RE = /(\d+)\s*[×x]\s*(\d+)/;
const ZONE_RE = /(Z\d(?:[–-]Z\d)?)/i;
const PACE_RE = /(\d+:\d{2})\s*\/\s*(km|mi)/i;

export function extractMetrics(
  details: string,
  kind: WorkoutKind,
): MetricTile[] {
  const tiles: MetricTile[] = [];

  const zoneMatch = details.match(ZONE_RE);
  if (zoneMatch) {
    tiles.push({ label: "HR Z", value: zoneMatch[1].toUpperCase(), primary: true });
  }

  const durationMatch = details.match(DURATION_RE);
  if (durationMatch) {
    const unit = durationMatch[2].toLowerCase().startsWith("h") ? "hr" : "min";
    tiles.push({
      label: "TIME",
      value: durationMatch[1],
      unit,
      primary: !zoneMatch && kind !== "run",
    });
  }

  const distanceMatch = details.match(DISTANCE_RE);
  if (distanceMatch && kind === "run") {
    tiles.push({
      label: "DIST",
      value: distanceMatch[1],
      unit: distanceMatch[2].toLowerCase(),
    });
  }

  const vertMatch = details.match(VERT_RE);
  if (vertMatch) {
    tiles.push({ label: "VERT", value: `+${vertMatch[1]}`, unit: "m" });
  }

  const paceMatch = details.match(PACE_RE);
  if (paceMatch && kind === "run") {
    tiles.push({
      label: "PACE",
      value: paceMatch[1],
      unit: `/${paceMatch[2].toLowerCase()}`,
    });
  }

  if (tiles.length === 0) {
    const setsRepsMatch = details.match(SETS_REPS_RE);
    if (setsRepsMatch) {
      tiles.push({
        label: "SETS",
        value: `${setsRepsMatch[1]}×${setsRepsMatch[2]}`,
        primary: true,
      });
    }
  }

  return tiles;
}

// Eyebrow describing the kind + parsed sub-type. Falls back to the bare kind
// when no sub-type can be inferred from title/details.
export function kindEyebrow(kind: WorkoutKind, title: string): string {
  const t = title.toLowerCase();
  if (kind === "run") {
    if (t.includes("tempo")) return "RUN · TEMPO";
    if (t.includes("hill")) return "RUN · HILLS";
    if (t.includes("long")) return "RUN · LONG";
    if (t.includes("interval")) return "RUN · INTERVALS";
    if (t.includes("easy") || t.includes("recovery")) return "RUN · EASY";
    if (t.includes("race")) return "RUN · RACE";
    return "RUN";
  }
  if (kind === "gym") {
    if (t.includes("upper")) return "STRENGTH · UPPER";
    if (t.includes("lower")) return "STRENGTH · LOWER";
    if (t.includes("core")) return "STRENGTH · CORE";
    return "STRENGTH";
  }
  if (kind === "hike") return "CROSS-TRAINING · HIKE";
  if (kind === "cross") {
    if (/\bcycl(ing|e)|bike|spin\b/i.test(title)) return "CROSS-TRAINING · CYCLING";
    if (/\bswim/i.test(title)) return "CROSS-TRAINING · SWIM";
    return "CROSS-TRAINING";
  }
  if (kind === "physio") return "MOBILITY · PHYSIO";
  return "MOBILITY";
}
