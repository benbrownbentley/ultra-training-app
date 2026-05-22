// Derived plan helpers — pure functions over the basic Plan + today date.
// Phase boundaries are inferred from week position in the block (we don't
// store coach-defined phases yet). Volume and vert are read directly off
// the structured `planned_detail` payload (Phase 2). Legacy backfilled
// rows contribute zero — they only land here for users who haven't
// regenerated their plan post-migration.

import type { Day, Plan, Workout } from "@/lib/plan";
import { isLegacyPlannedDetail } from "@/lib/planned-detail";
import { addDays, daysBetween, weekStart } from "@/lib/utils";

export type PlanPhase = "base" | "build" | "peak" | "taper";

// 1-indexed week in a `totalWeeks`-long block → coarse phase classification.
// Base: first third. Build: middle third. Peak: until 2 weeks out. Taper: last 2.
export function computePhase(weekN: number, totalWeeks: number): PlanPhase {
  if (totalWeeks <= 3) return "build";
  const taperStart = Math.max(1, totalWeeks - 1);
  const peakStart = Math.max(1, totalWeeks - 4);
  const buildStart = Math.max(1, Math.ceil(totalWeeks / 3));
  if (weekN >= taperStart) return "taper";
  if (weekN >= peakStart) return "peak";
  if (weekN >= buildStart) return "build";
  return "base";
}

export function phaseLabel(phase: PlanPhase): string {
  return { base: "BASE", build: "BUILD", peak: "PEAK", taper: "TAPER" }[phase];
}

// Pulls planned distance in km out of a structured run payload.
// Returns 0 for legacy backfilled rows or non-run kinds.
function distanceKm(w: Workout): number {
  const pd = w.planned_detail;
  if (pd == null || isLegacyPlannedDetail(pd)) return 0;
  if (pd.kind === "run") return pd.total_distance_km ?? 0;
  return 0;
}

function vertM(w: Workout): number {
  const pd = w.planned_detail;
  if (pd == null || isLegacyPlannedDetail(pd)) return 0;
  if (pd.kind === "run") return pd.total_elevation_gain_m ?? 0;
  if (pd.kind === "hike") return pd.elevation_gain_m ?? 0;
  return 0;
}

function durationMin(w: Workout): number {
  const pd = w.planned_detail;
  if (pd == null || isLegacyPlannedDetail(pd)) return 0;
  if (pd.kind === "run" || pd.kind === "gym" || pd.kind === "mobility" || pd.kind === "physio") {
    return pd.total_duration_min ?? 0;
  }
  if (pd.kind === "cross" || pd.kind === "hike") return pd.duration_min;
  return 0;
}

export interface WeekStats {
  volKm: number;
  vertM: number;
  qualityCount: number;
  totalWorkouts: number;
  completedCount: number;
}

// Aggregates the prescribed (or logged) volume across a week's workouts.
// "Quality" days are anything other than easy/rest — used as a coarse
// load proxy when the user doesn't surface zones.
export function weekStats(days: Day[]): WeekStats {
  let volKm = 0;
  let vertMSum = 0;
  let qualityCount = 0;
  let totalWorkouts = 0;
  let completedCount = 0;
  for (const day of days) {
    for (const w of day.workouts) {
      totalWorkouts++;
      if (w.status === "completed") completedCount++;
      if (w.kind === "run") {
        volKm += distanceKm(w);
        vertMSum += vertM(w);
        // "Quality" runs = anything not flagged easy / recovery / rest
        // in the title. Title alone is enough: easy runs are almost
        // always titled "Easy" / "Recovery", and the structured
        // planned_detail doesn't carry an explicit quality flag.
        if (!/easy|recovery|rest/i.test(w.title)) {
          qualityCount++;
        }
      } else if (w.kind === "gym") {
        qualityCount++;
      } else if (w.kind === "hike") {
        // Hike vert lands here too — hike sessions on hilly courses
        // contribute meaningfully to weekly climbing load.
        vertMSum += vertM(w);
      }
    }
  }
  return {
    volKm: Math.round(volKm),
    vertM: vertMSum,
    qualityCount,
    totalWorkouts,
    completedCount,
  };
}

export interface PlanWeek {
  weekNum: number;
  startIso: string;
  endIso: string;
  phase: PlanPhase;
  days: Day[];
  stats: WeekStats;
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
  isRaceWeek: boolean;
}

// Folds the flat day list into 18-ish week buckets, classifying each one
// relative to today and the race date.
export function buildPlanWeeks(plan: Plan, todayIso: string): PlanWeek[] {
  if (plan.days.length === 0) return [];

  const planStartIso = plan.days[0].date;
  const blockStart = weekStart(planStartIso);
  const raceIso = plan.race.date;
  const blockEndExclusive = addDays(weekStart(raceIso), 7);
  const totalDays = daysBetween(blockStart, blockEndExclusive);
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));

  const dayByDate = new Map(plan.days.map((d) => [d.date, d]));
  const currentWeekStart = weekStart(todayIso);

  const weeks: PlanWeek[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    const startIso = addDays(blockStart, i * 7);
    const endIso = addDays(startIso, 6);
    const days: Day[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = addDays(startIso, d);
      days.push(dayByDate.get(iso) ?? { date: iso, workouts: [] });
    }
    const weekNum = i + 1;
    const phase = computePhase(weekNum, totalWeeks);
    const stats = weekStats(days);
    weeks.push({
      weekNum,
      startIso,
      endIso,
      phase,
      days,
      stats,
      isCurrent: startIso === currentWeekStart,
      isPast: endIso < todayIso,
      isFuture: startIso > todayIso,
      isRaceWeek: startIso <= raceIso && raceIso <= endIso,
    });
  }
  return weeks;
}

// Picks the most "primary" workout of the day for the day-strip icon.
// Same convention as the Today screen's WeekStrip.
export function dayPrimaryKind(workouts: Workout[]) {
  if (workouts.length === 0) return null;
  const order = ["run", "gym", "mobility"] as const;
  for (const kind of order) {
    if (workouts.find((w) => w.kind === kind)) return kind;
  }
  return workouts[0].kind;
}

// Compact label shown beneath the day's icon ("12 km", "rest", "strength").
export function daySummaryLabel(day: Day): string {
  if (day.workouts.length === 0) return "rest";
  const first = day.workouts[0];
  if (first.kind === "gym") return "strength";
  if (first.kind === "mobility") return "mobility";
  const km = distanceKm(first);
  if (km > 0) return `${Math.round(km)} km`;
  const min = durationMin(first);
  if (min > 0) return `${Math.round(min)} min`;
  return first.title.toLowerCase().split(" ")[0];
}
