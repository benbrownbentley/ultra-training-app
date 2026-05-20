// Preview pipeline business logic — pure helpers that operate on
// snapshots of the plan. Lives in lib/ so the future React Native app can
// reuse this layer; the actions in app/actions.ts handle Supabase IO and
// call these.
//
// The diff format is shaped to feed StateResult/StateMinor directly: a
// per-week list with DayDiff rows the design already knows how to render.

import type { Day, RacePriority, Workout, WorkoutKind } from "@/lib/plan";
import { addDays, daysBetween, weekStart } from "@/lib/utils";

export type DiffKind = "unchanged" | "changed" | "added" | "removed";

export interface DayDiff {
  day: string;
  kind: DiffKind;
  title: string;
  primary?: string;
  was?: string;
}

export interface WeekDiff {
  label: string;
  sub: string;
  days: DayDiff[];
  // True when at least one day in the week is non-unchanged. Lets the page
  // hide quiet weeks behind a "+N unchanged" caption.
  hasChange: boolean;
}

export interface PreviewWorkout {
  date: string;
  kind: WorkoutKind;
  title: string;
  details: string;
  position: number;
}

export interface GenerationSummary {
  summary: string;
  changes: Array<{
    type: "shifted" | "reduced" | "added" | "removed";
    text: string;
  }>;
}

export interface PreviewRow {
  id: number;
  user_id: string;
  workouts: PreviewWorkout[];
  notes: string | null;
  generation_summary: GenerationSummary | null;
  status: "pending" | "accepted" | "discarded";
  created_at: string;
}

// Marker for race-week so the diff can label it consistently with the rest
// of the app (see lib/plan-derive's race-week detection).
export interface DiffContext {
  raceDate: string | null;
  racePriority: RacePriority | null;
  todayIso: string;
  totalWeeks: number;
}

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

function weekdayInitial(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return DAY_INITIALS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    })
    .toUpperCase();
}

function workoutSummary(w: PreviewWorkout | Workout): string {
  return w.details;
}

// Compares two workout sets at the same date. Equality requires identical
// counts plus matching title+details per slot (order-sensitive — Claude
// returns positions in a stable order).
function workoutSetsEqual(
  current: Workout[],
  preview: PreviewWorkout[],
): boolean {
  if (current.length !== preview.length) return false;
  return current.every((w, i) => {
    const p = preview[i];
    return p && p.title === w.title && p.details === w.details && p.kind === w.kind;
  });
}

// Renders a single DayDiff for a date with both current + preview slots.
function diffDay(
  dayIso: string,
  current: Workout[],
  preview: PreviewWorkout[],
): DayDiff {
  const initial = weekdayInitial(dayIso);
  if (current.length === 0 && preview.length === 0) {
    return { day: initial, kind: "unchanged", title: "Rest" };
  }
  if (current.length === 0 && preview.length > 0) {
    const p = preview[0];
    return {
      day: initial,
      kind: "added",
      title: p.title,
      primary: workoutSummary(p),
    };
  }
  if (preview.length === 0 && current.length > 0) {
    const c = current[0];
    return {
      day: initial,
      kind: "removed",
      title: c.title,
      primary: workoutSummary(c),
    };
  }
  if (workoutSetsEqual(current, preview)) {
    const p = preview[0];
    return {
      day: initial,
      kind: "unchanged",
      title: p.title,
      primary: workoutSummary(p),
    };
  }
  const p = preview[0];
  const c = current[0];
  return {
    day: initial,
    kind: "changed",
    title: p.title,
    primary: workoutSummary(p),
    was: `${c.title} ${workoutSummary(c)}`.trim(),
  };
}

interface BuildArgs {
  currentDays: Day[];
  previewWorkouts: PreviewWorkout[];
  ctx: DiffContext;
}

// Folds the current and preview plan day lists into per-week buckets and
// diffs each day. Output is the shape StateResult/StateMinor render. Weeks
// with zero changes are still emitted (the page filters them and shows a
// "+N unchanged" caption).
export function computePlanDiff({
  currentDays,
  previewWorkouts,
  ctx,
}: BuildArgs): WeekDiff[] {
  // Index current and preview by date.
  const currentByDate = new Map<string, Workout[]>();
  for (const d of currentDays) {
    currentByDate.set(d.date, d.workouts);
  }
  const previewByDate = new Map<string, PreviewWorkout[]>();
  for (const w of previewWorkouts) {
    const list = previewByDate.get(w.date) ?? [];
    list.push(w);
    previewByDate.set(w.date, list);
  }
  // Sort each preview day by position so the comparison is stable.
  for (const list of previewByDate.values()) {
    list.sort((a, b) => a.position - b.position);
  }

  // Universe of dates spans today → race day, weekly. If no race date,
  // span 4 weeks forward as a safe default.
  const startMonday = weekStart(ctx.todayIso);
  const horizonIso = ctx.raceDate ?? addDays(ctx.todayIso, 28);
  const totalDays = daysBetween(startMonday, horizonIso);
  const weekCount = Math.max(1, Math.ceil(totalDays / 7) + 1);

  const weeks: WeekDiff[] = [];
  for (let i = 0; i < weekCount; i++) {
    const wkStartIso = addDays(startMonday, i * 7);
    if (wkStartIso > horizonIso) break;
    const weekNum = i + 1;
    const days: DayDiff[] = [];
    let hasChange = false;
    for (let d = 0; d < 7; d++) {
      const iso = addDays(wkStartIso, d);
      const current = currentByDate.get(iso) ?? [];
      const preview = previewByDate.get(iso) ?? [];
      const diff = diffDay(iso, current, preview);
      if (diff.kind !== "unchanged") hasChange = true;
      days.push(diff);
    }
    weeks.push({
      label: `WEEK ${weekNum} OF ${ctx.totalWeeks}`,
      sub: `${shortDate(wkStartIso)} — ${shortDate(addDays(wkStartIso, 6))}`,
      days,
      hasChange,
    });
  }
  return weeks;
}

// Heuristic for whether a diff is "minor". Used to pick StateMinor over
// StateResult — the design surfaces a calmer page when the AI barely
// touched anything.
export function isMinorChange(weeks: WeekDiff[]): boolean {
  let changes = 0;
  for (const w of weeks) {
    for (const d of w.days) {
      if (d.kind !== "unchanged") changes++;
    }
  }
  return changes > 0 && changes < 3;
}

// Convenience: weeks that actually changed, plus a count of trailing
// unchanged weeks so the page can render a "WEEKS N–M UNCHANGED" caption.
export function summariseDiff(weeks: WeekDiff[]): {
  changedWeeks: WeekDiff[];
  unchangedTrailing: number;
} {
  // Find the index past the last changed week.
  let lastChangedIdx = -1;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].hasChange) {
      lastChangedIdx = i;
      break;
    }
  }
  if (lastChangedIdx === -1) {
    return { changedWeeks: [], unchangedTrailing: weeks.length };
  }
  const changedWeeks = weeks.slice(0, lastChangedIdx + 1);
  const unchangedTrailing = weeks.length - changedWeeks.length;
  return { changedWeeks, unchangedTrailing };
}
