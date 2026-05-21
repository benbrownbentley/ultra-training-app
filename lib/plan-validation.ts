// Lightweight structural validator for Claude-generated plans. The SYSTEM
// prompt expresses the rules; this module enforces the small set that we
// genuinely cannot tolerate breaking (missing days, race not included,
// out-of-window dates).
//
// Design philosophy: keep this conservative. Hard checks throw upstream
// (in generateTrainingPlan after one retry). Soft checks log warnings
// but never fail the request. As we observe real failure modes in
// production we can graduate softer rules from prompt-only to validated.

import type { GeneratedWorkout } from "@/lib/claude";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  // Short code suitable for logging + telling Claude what to fix on retry.
  code:
    | "missing_dates"
    | "no_race_day_run"
    | "dates_before_start"
    | "long_run_in_taper";
  // Human-readable message. Shown in logs and (truncated) in retry prompts.
  message: string;
}

export interface ValidateArgs {
  workouts: GeneratedWorkout[];
  startDate: string;
  raceDate: string;
}

/**
 * Returns an array of validation issues. Empty array = clean plan.
 *
 * Hard checks (severity: "error"):
 * - Every date from startDate through raceDate (inclusive) has ≥1 workout
 * - Race day includes at least one workout of kind "run"
 * - No workouts dated before startDate
 *
 * Soft check (severity: "warning"):
 * - No workout titled like a "long run" in the final 7 days (taper sanity)
 */
export function validateGeneratedPlan(args: ValidateArgs): ValidationIssue[] {
  const { workouts, startDate, raceDate } = args;
  const issues: ValidationIssue[] = [];

  // 1. Every date covered.
  const datesPresent = new Set(workouts.map((w) => w.date));
  const expectedDates = enumerateDates(startDate, raceDate);
  const missing = expectedDates.filter((d) => !datesPresent.has(d));
  if (missing.length > 0) {
    // Cap the message at the first few missing dates so retry prompts
    // stay readable when a lot is wrong.
    const preview = missing.slice(0, 5).join(", ");
    const more = missing.length > 5 ? `, +${missing.length - 5} more` : "";
    issues.push({
      severity: "error",
      code: "missing_dates",
      message: `Missing workouts on ${missing.length} day(s): ${preview}${more}. Every date from ${startDate} through ${raceDate} must have at least one workout.`,
    });
  }

  // 2. Race day includes a run.
  const raceDayWorkouts = workouts.filter((w) => w.date === raceDate);
  const hasRaceDayRun = raceDayWorkouts.some((w) => w.kind === "run");
  if (!hasRaceDayRun) {
    issues.push({
      severity: "error",
      code: "no_race_day_run",
      message: `Race day (${raceDate}) must include a workout with kind "run". Found ${raceDayWorkouts.length} workout(s) but none were runs.`,
    });
  }

  // 3. No past-dated workouts.
  const past = workouts.filter((w) => w.date < startDate);
  if (past.length > 0) {
    issues.push({
      severity: "error",
      code: "dates_before_start",
      message: `${past.length} workout(s) dated before the start date (${startDate}). Only generate workouts from the start date onward.`,
    });
  }

  // 4. Soft taper sanity: no long run in the final 7 days.
  const last7Dates = enumerateDates(addDays(raceDate, -6), raceDate);
  const longRunInTaper = workouts.find(
    (w) =>
      last7Dates.includes(w.date) &&
      w.kind === "run" &&
      /long\s*run/i.test(w.title),
  );
  if (longRunInTaper) {
    issues.push({
      severity: "warning",
      code: "long_run_in_taper",
      message: `A long run is scheduled on ${longRunInTaper.date}, within 7 days of race day. Taper may be too short.`,
    });
  }

  return issues;
}

/**
 * Convenience: pick out just the errors (severity === "error").
 * Callers use this to decide whether to throw or retry.
 */
export function errorsOnly(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((i) => i.severity === "error");
}

/**
 * Builds a follow-up message body suitable for asking Claude to retry.
 * Lists each error and reminds it to re-submit via the tool.
 */
export function buildRetryMessage(issues: ValidationIssue[]): string {
  const errorLines = issues
    .filter((i) => i.severity === "error")
    .map((i) => `- [${i.code}] ${i.message}`)
    .join("\n");
  return `The plan you just submitted failed validation. Please fix the following issues and re-submit via the submit_training_plan tool:

${errorLines}

Re-submit the full plan with all workouts, the coach-voice summary, and the changes array. Do not respond with plain text.`;
}

// ---------- date helpers ----------
// These intentionally operate on ISO strings (YYYY-MM-DD) without
// constructing JS Date objects in user-local time zones. That keeps the
// validator deterministic across machines and test environments —
// matching the rest of the codebase, which is fanatical about avoiding
// `new Date()` in business logic.

/** Returns an inclusive array of YYYY-MM-DD strings from start to end. */
export function enumerateDates(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  let cursor = startISO;
  while (cursor <= endISO) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/** Adds N days (can be negative) to a YYYY-MM-DD string, returns YYYY-MM-DD. */
export function addDays(iso: string, days: number): string {
  // Treat the date as UTC midnight to avoid DST/timezone drift. Date
  // arithmetic on UTC milliseconds is safe; toISOString() gives us the
  // canonical YYYY-MM-DD back.
  const ms = Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  );
  const shifted = new Date(ms + days * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}
