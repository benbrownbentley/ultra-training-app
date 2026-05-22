// Lightweight structural validator for Claude-generated plans. The SYSTEM
// prompt expresses the rules; this module enforces the small set that we
// genuinely cannot tolerate breaking (missing days, race not included,
// out-of-window dates, malformed structured payloads, oversize `why`).
//
// Design philosophy: keep this conservative. Hard checks throw upstream
// (in generateTrainingPlan after one retry). Soft checks log warnings
// but never fail the request. As we observe real failure modes in
// production we can graduate softer rules from prompt-only to validated.

import { z } from "zod";
import type { GeneratedWorkout } from "@/lib/claude";
import type {
  GenerationPhase,
  MetaPlan,
  PhaseMetadata,
} from "@/lib/plan-generation-types";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  // Short code suitable for logging + telling Claude what to fix on retry.
  code:
    | "missing_dates"
    | "no_race_day_run"
    | "dates_before_start"
    | "long_run_in_taper"
    | "planned_detail_invalid"
    | "kind_mismatch"
    | "why_missing"
    | "why_too_long"
    // Phase 2.5 — meta-plan structural issues.
    | "meta_plan_empty"
    | "meta_plan_phase_gap"
    | "meta_plan_overlap"
    | "meta_plan_start_mismatch"
    | "meta_plan_end_mismatch"
    | "meta_plan_invalid_phase_order"
    // Phase 2.5 — per-phase chunk issues. Distinct from missing_dates
    // so the retry prompt asks Claude to fix the phase, not the
    // whole plan.
    | "missing_dates_in_phase";
  // Human-readable message. Shown in logs and (truncated) in retry prompts.
  message: string;
}

// ----- PlannedDetail zod schemas. Mirrors the JSON-schema branches in
// PLAN_TOOL (lib/claude.ts) — the JSON-schema describes the API contract
// to Claude, this zod runs the same contract at the action boundary so
// auto-retry-once gets a typed error to feed back. See PHASE_2_SPEC.md
// §4.2 and §9 (strict-discriminator decision).

const RunSegmentSchema = z.object({
  label: z.string().min(1),
  duration_min: z.number().nullish(),
  distance_km: z.number().nullish(),
  zone: z.string().nullish(),
  intervals: z.string().nullish(),
  pace: z.string().nullish(),
  note: z.string().nullish(),
});

const ExerciseSchema = z.object({
  name: z.string().min(1),
  equipment: z.string().nullish(),
  sets: z.number().int().min(1),
  reps: z.number().int().min(1),
  weight: z.number().nullish(),
  unit: z.enum(["kg", "lb", "bw"]).nullish(),
  notes: z.string().nullish(),
});

const PhysioExerciseSchema = ExerciseSchema.extend({
  pain_focus: z.string().nullish(),
});

const MovementSchema = z.object({
  name: z.string().min(1),
  duration_s: z.number().nullish(),
  side: z.enum(["both", "each", "left", "right"]).nullish(),
  notes: z.string().nullish(),
});

const WarmupBlockSchema = z.object({
  duration_min: z.number().nullish(),
  items: z.array(z.string()),
  note: z.string().nullish(),
});

export const PlannedDetailSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("run"),
    segments: z.array(RunSegmentSchema).min(1),
    total_duration_min: z.number().nullish(),
    total_distance_km: z.number().nullish(),
    total_elevation_gain_m: z.number().nullish(),
    target_pace: z.string().nullish(),
  }),
  z.object({
    kind: z.literal("gym"),
    exercises: z.array(ExerciseSchema).min(1),
    warmup: WarmupBlockSchema.nullish(),
    total_duration_min: z.number().nullish(),
  }),
  z.object({
    kind: z.literal("physio"),
    exercises: z.array(PhysioExerciseSchema).min(1),
    total_duration_min: z.number().nullish(),
  }),
  z.object({
    kind: z.literal("mobility"),
    movements: z.array(MovementSchema).min(1),
    total_duration_min: z.number().nullish(),
  }),
  z.object({
    kind: z.literal("cross"),
    activity: z.string().min(1),
    duration_min: z.number(),
    target_zone: z.string().nullish(),
    intervals: z.string().nullish(),
    notes: z.string().nullish(),
  }),
  z.object({
    kind: z.literal("hike"),
    duration_min: z.number(),
    elevation_gain_m: z.number().nullish(),
    target_zone: z.string().nullish(),
    intervals: z.string().nullish(),
    fueling: z.string().nullish(),
    notes: z.string().nullish(),
  }),
]);

/** Per-spec §9: `why` cap is 500 chars (~3 sentences). */
export const WHY_MAX_CHARS = 500;

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

  // 0. Per-workout structured checks. We do these first so a malformed
  //    planned_detail surfaces before the structural checks below that
  //    might otherwise mask the underlying issue. Cap to the first few
  //    failures per code to keep retry prompts readable.
  let kindMismatchCount = 0;
  let plannedDetailFailCount = 0;
  const PER_CODE_PREVIEW = 3;
  for (const w of workouts) {
    // why presence + length.
    if (typeof w.why !== "string" || w.why.trim().length === 0) {
      issues.push({
        severity: "error",
        code: "why_missing",
        message: `Workout on ${w.date} (${w.kind}, "${w.title}") is missing a non-empty \`why\`. Every workout requires a 1-3 sentence rationale, ≤${WHY_MAX_CHARS} chars.`,
      });
    } else if (w.why.length > WHY_MAX_CHARS) {
      issues.push({
        severity: "error",
        code: "why_too_long",
        message: `Workout on ${w.date} (${w.kind}, "${w.title}") has a \`why\` field of ${w.why.length} characters. Maximum is ${WHY_MAX_CHARS}. Trim to 1-3 sentences.`,
      });
    }
    // planned_detail shape + discriminator agreement.
    const parsed = PlannedDetailSchema.safeParse(w.planned_detail);
    if (!parsed.success) {
      if (plannedDetailFailCount < PER_CODE_PREVIEW) {
        const issue = parsed.error.issues[0];
        const path = issue.path.length > 0 ? ` (path: ${issue.path.join(".")})` : "";
        issues.push({
          severity: "error",
          code: "planned_detail_invalid",
          message: `Workout on ${w.date} (${w.kind}, "${w.title}") has an invalid planned_detail${path}: ${issue.message}.`,
        });
      }
      plannedDetailFailCount++;
    } else if (parsed.data.kind !== w.kind) {
      if (kindMismatchCount < PER_CODE_PREVIEW) {
        issues.push({
          severity: "error",
          code: "kind_mismatch",
          message: `Workout on ${w.date} declares outer kind="${w.kind}" but planned_detail.kind="${parsed.data.kind}". The two must match (strict discriminator).`,
        });
      }
      kindMismatchCount++;
    }
  }
  if (plannedDetailFailCount > PER_CODE_PREVIEW) {
    issues.push({
      severity: "error",
      code: "planned_detail_invalid",
      message: `${plannedDetailFailCount - PER_CODE_PREVIEW} additional workout(s) have invalid planned_detail. Re-check the STRUCTURED OUTPUT REQUIREMENTS section in the system prompt.`,
    });
  }
  if (kindMismatchCount > PER_CODE_PREVIEW) {
    issues.push({
      severity: "error",
      code: "kind_mismatch",
      message: `${kindMismatchCount - PER_CODE_PREVIEW} additional workout(s) have outer kind / planned_detail.kind mismatches.`,
    });
  }

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
 * Lists each error and reminds it to re-submit via the tool. The
 * caller passes the tool name so meta-plan vs. per-workout retries
 * both point Claude at the right re-submit endpoint.
 */
export function buildRetryMessage(
  issues: ValidationIssue[],
  toolName: string = "submit_training_plan",
): string {
  const errorLines = issues
    .filter((i) => i.severity === "error")
    .map((i) => `- [${i.code}] ${i.message}`)
    .join("\n");
  return `The output you just submitted failed validation. Please fix the following issues and re-submit via the ${toolName} tool:

${errorLines}

Re-submit the corrected output via ${toolName}. Do not respond with plain text.`;
}

// ----- Phase 2.5: meta-plan + per-phase validators.
//
// These run inside generateMetaPlan / generatePhase and into the
// existing auto-retry-once mechanic. The codes feed buildRetryMessage
// so Claude's retry context names the specific structural fault.

/** Allowed phase order. TAPER, if present, must be last. */
const PHASE_ORDER_RANK: Record<GenerationPhase, number> = {
  base: 0,
  build: 1,
  peak: 2,
  taper: 3,
};

/**
 * Returns validation issues for a meta-plan. Each phase must cover
 * contiguous dates with no gaps/overlaps; the first phase must start
 * on startDate and the last must end on raceDate. TAPER (when
 * present) must be last; BASE (when present) must be first. See
 * CHUNKING_SPEC.md §3.3 + §4.1.
 */
export function validateMetaPlan(args: {
  metaPlan: MetaPlan;
  startDate: string;
  raceDate: string;
}): ValidationIssue[] {
  const { metaPlan, startDate, raceDate } = args;
  const issues: ValidationIssue[] = [];
  const phases = metaPlan.phases ?? [];

  // 0. Must have at least one phase. Without this every other check
  //    bottoms out with index 0 issues.
  if (phases.length === 0) {
    issues.push({
      severity: "error",
      code: "meta_plan_empty",
      message: `Meta-plan must contain at least one phase covering ${startDate} through ${raceDate}.`,
    });
    return issues;
  }

  // 1. First phase starts on startDate.
  if (phases[0].weekStartIso !== startDate) {
    issues.push({
      severity: "error",
      code: "meta_plan_start_mismatch",
      message: `First phase (${phases[0].phase}) starts on ${phases[0].weekStartIso}; must start on ${startDate}.`,
    });
  }

  // 2. Last phase ends on raceDate.
  const last = phases[phases.length - 1];
  if (last.weekEndIso !== raceDate) {
    issues.push({
      severity: "error",
      code: "meta_plan_end_mismatch",
      message: `Last phase (${last.phase}) ends on ${last.weekEndIso}; must end on ${raceDate}.`,
    });
  }

  // 3. Adjacent phases: no gaps, no overlaps. The expected start of
  //    phase N+1 is the day after phase N ends.
  for (let i = 0; i < phases.length - 1; i++) {
    const prev = phases[i];
    const next = phases[i + 1];
    const expectedNextStart = addDays(prev.weekEndIso, 1);
    if (next.weekStartIso > expectedNextStart) {
      issues.push({
        severity: "error",
        code: "meta_plan_phase_gap",
        message: `Gap between phases: ${prev.phase} ends ${prev.weekEndIso}, but ${next.phase} starts ${next.weekStartIso} (expected ${expectedNextStart}).`,
      });
    } else if (next.weekStartIso < expectedNextStart) {
      issues.push({
        severity: "error",
        code: "meta_plan_overlap",
        message: `Phases overlap: ${prev.phase} ends ${prev.weekEndIso}, but ${next.phase} starts ${next.weekStartIso} (expected ${expectedNextStart}).`,
      });
    }
  }

  // 4. Order: rank monotonically non-decreasing. TAPER must be last
  //    when present; BASE must be first when present. The rank check
  //    catches both implicitly — a BASE after BUILD has lower rank
  //    than its predecessor, which trips the inequality.
  for (let i = 0; i < phases.length - 1; i++) {
    const prevRank = PHASE_ORDER_RANK[phases[i].phase];
    const nextRank = PHASE_ORDER_RANK[phases[i + 1].phase];
    if (nextRank <= prevRank) {
      issues.push({
        severity: "error",
        code: "meta_plan_invalid_phase_order",
        message: `Phase order invalid: ${phases[i].phase} → ${phases[i + 1].phase}. Allowed order is base → build → peak → taper.`,
      });
      break; // One message is enough; no need to flag every pair.
    }
  }

  return issues;
}

/**
 * Returns validation issues for a single phase's workout chunk.
 * Reuses the per-workout structural checks from validateGeneratedPlan
 * (planned_detail shape, kind discriminator, why presence + length)
 * and adds a phase-scoped date-coverage check. The code
 * `missing_dates_in_phase` distinguishes the per-phase failure from
 * the full-plan `missing_dates` so the retry prompt asks Claude to
 * regenerate just this phase, not the entire plan.
 */
export function validatePhaseChunk(args: {
  workouts: GeneratedWorkout[];
  phaseStart: string;
  phaseEnd: string;
  phase: GenerationPhase;
}): ValidationIssue[] {
  const { workouts, phaseStart, phaseEnd, phase } = args;
  const issues: ValidationIssue[] = [];

  // Per-workout checks. Same shape as validateGeneratedPlan's loop.
  let kindMismatchCount = 0;
  let plannedDetailFailCount = 0;
  const PER_CODE_PREVIEW = 3;
  for (const w of workouts) {
    if (typeof w.why !== "string" || w.why.trim().length === 0) {
      issues.push({
        severity: "error",
        code: "why_missing",
        message: `Workout on ${w.date} (${w.kind}, "${w.title}") is missing a non-empty \`why\`. Every workout requires a 1-3 sentence rationale, ≤${WHY_MAX_CHARS} chars.`,
      });
    } else if (w.why.length > WHY_MAX_CHARS) {
      issues.push({
        severity: "error",
        code: "why_too_long",
        message: `Workout on ${w.date} (${w.kind}, "${w.title}") has a \`why\` field of ${w.why.length} characters. Maximum is ${WHY_MAX_CHARS}.`,
      });
    }
    const parsed = PlannedDetailSchema.safeParse(w.planned_detail);
    if (!parsed.success) {
      if (plannedDetailFailCount < PER_CODE_PREVIEW) {
        const issue = parsed.error.issues[0];
        const path = issue.path.length > 0 ? ` (path: ${issue.path.join(".")})` : "";
        issues.push({
          severity: "error",
          code: "planned_detail_invalid",
          message: `Workout on ${w.date} (${w.kind}, "${w.title}") has an invalid planned_detail${path}: ${issue.message}.`,
        });
      }
      plannedDetailFailCount++;
    } else if (parsed.data.kind !== w.kind) {
      if (kindMismatchCount < PER_CODE_PREVIEW) {
        issues.push({
          severity: "error",
          code: "kind_mismatch",
          message: `Workout on ${w.date} declares outer kind="${w.kind}" but planned_detail.kind="${parsed.data.kind}". The two must match (strict discriminator).`,
        });
      }
      kindMismatchCount++;
    }
  }
  if (plannedDetailFailCount > PER_CODE_PREVIEW) {
    issues.push({
      severity: "error",
      code: "planned_detail_invalid",
      message: `${plannedDetailFailCount - PER_CODE_PREVIEW} additional workout(s) in this phase have invalid planned_detail.`,
    });
  }
  if (kindMismatchCount > PER_CODE_PREVIEW) {
    issues.push({
      severity: "error",
      code: "kind_mismatch",
      message: `${kindMismatchCount - PER_CODE_PREVIEW} additional workout(s) in this phase have outer/inner kind mismatches.`,
    });
  }

  // Phase-scoped date coverage. Every day in [phaseStart, phaseEnd]
  // must have at least one workout. Workouts outside the window are
  // also flagged so Claude doesn't bleed into the next phase.
  const datesPresent = new Set(workouts.map((w) => w.date));
  const expectedDates = enumerateDates(phaseStart, phaseEnd);
  const missing = expectedDates.filter((d) => !datesPresent.has(d));
  if (missing.length > 0) {
    const preview = missing.slice(0, 5).join(", ");
    const more = missing.length > 5 ? `, +${missing.length - 5} more` : "";
    issues.push({
      severity: "error",
      code: "missing_dates_in_phase",
      message: `Phase ${phase} (${phaseStart} → ${phaseEnd}) is missing workouts on ${missing.length} day(s): ${preview}${more}. Every date in this phase must have at least one workout.`,
    });
  }
  const outOfWindow = workouts.filter(
    (w) => w.date < phaseStart || w.date > phaseEnd,
  );
  if (outOfWindow.length > 0) {
    issues.push({
      severity: "error",
      code: "missing_dates_in_phase",
      message: `${outOfWindow.length} workout(s) fall outside the ${phase} phase window (${phaseStart} → ${phaseEnd}). Only generate dates inside this phase.`,
    });
  }

  return issues;
}

/**
 * Convenience: enrich a PhaseMetadata with the `weeks` count derived
 * from its date range. The orchestrator runs each meta-plan phase
 * through this so downstream readers (prompt builders, UI labels)
 * see a consistent number. Returns a new array; does not mutate.
 */
export function enrichPhaseWeeks(phases: PhaseMetadata[]): PhaseMetadata[] {
  return phases.map((p) => ({
    ...p,
    weeks: Math.max(
      1,
      Math.round(
        (enumerateDates(p.weekStartIso, p.weekEndIso).length) / 7,
      ),
    ),
  }));
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
