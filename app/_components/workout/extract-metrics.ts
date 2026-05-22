// Renders the workout's planned_detail into the structured metric
// tiles the design expects. Phase 2: structured-only path. Pre-Phase-2
// backfilled rows (`{ notes }`) carry no metric data, so the
// component caller hides the tile row when the result is empty.

import type { PlannedDetailStored, WorkoutKind } from "@/lib/plan";
import { isLegacyPlannedDetail } from "@/lib/planned-detail";

export interface MetricTile {
  label: string;
  value: string;
  unit?: string;
  primary?: boolean;
}

export function extractMetrics(
  planned: PlannedDetailStored,
  kind: WorkoutKind,
): MetricTile[] {
  if (planned == null || isLegacyPlannedDetail(planned)) return [];
  const tiles: MetricTile[] = [];

  if (planned.kind === "run") {
    if (planned.target_pace) {
      tiles.push({ label: "PACE", value: planned.target_pace });
    }
    if (planned.total_duration_min != null) {
      tiles.push({
        label: "TIME",
        value: String(planned.total_duration_min),
        unit: "min",
      });
    }
    if (planned.total_distance_km != null) {
      tiles.push({
        label: "DIST",
        value: String(planned.total_distance_km),
        unit: "km",
        primary: true,
      });
    }
    if (planned.total_elevation_gain_m != null) {
      tiles.push({
        label: "VERT",
        value: `+${planned.total_elevation_gain_m}`,
        unit: "m",
      });
    }
    // Surface the main set's zone as a glance metric when present.
    const mainSet = planned.segments.find((s) =>
      /main|interval|tempo|strides|block/i.test(s.label),
    );
    if (mainSet?.zone) {
      tiles.push({ label: "HR Z", value: mainSet.zone.toUpperCase() });
    }
    return tiles;
  }

  if (planned.kind === "gym" || planned.kind === "physio") {
    if (planned.total_duration_min != null) {
      tiles.push({
        label: "TIME",
        value: String(planned.total_duration_min),
        unit: "min",
        primary: true,
      });
    }
    tiles.push({
      label: "EXERCISES",
      value: String(planned.exercises.length),
    });
    // Surface total sets as a glance metric so the user can see scope.
    const totalSets = planned.exercises.reduce((sum, e) => sum + e.sets, 0);
    if (totalSets > 0) {
      tiles.push({ label: "SETS", value: String(totalSets) });
    }
    return tiles;
  }

  if (planned.kind === "mobility") {
    if (planned.total_duration_min != null) {
      tiles.push({
        label: "TIME",
        value: String(planned.total_duration_min),
        unit: "min",
        primary: true,
      });
    }
    tiles.push({
      label: "MOVEMENTS",
      value: String(planned.movements.length),
    });
    return tiles;
  }

  if (planned.kind === "cross") {
    tiles.push({
      label: "TIME",
      value: String(planned.duration_min),
      unit: "min",
      primary: true,
    });
    if (planned.target_zone) {
      tiles.push({ label: "HR Z", value: planned.target_zone.toUpperCase() });
    }
    return tiles;
  }

  // hike
  tiles.push({
    label: "TIME",
    value: String(planned.duration_min),
    unit: "min",
    primary: true,
  });
  if (planned.elevation_gain_m != null) {
    tiles.push({
      label: "VERT",
      value: `+${planned.elevation_gain_m}`,
      unit: "m",
    });
  }
  if (planned.target_zone) {
    tiles.push({ label: "HR Z", value: planned.target_zone.toUpperCase() });
  }
  // Mute kind reference so it's not flagged as unused.
  void kind;
  return tiles;
}

// Eyebrow describing the kind + parsed sub-type. Falls back to the bare kind
// when no sub-type can be inferred from the title.
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
