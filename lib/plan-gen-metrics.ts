// Pure-function instrumentation helpers for plan generation. Lives
// outside lib/claude.ts so the math is testable without importing
// `server-only`. The shape of the emitted [plan-gen-metrics] log line
// is fixed here too — Vercel's log search keys on the prefix and the
// JSON keys must stay stable across deploys for `jq` and grep to
// keep working. See PROJECT_BRIEF.md → "Phase 2.1" for context.

/**
 * Distribution stats for a batch of per-workout `why` strings. Used by
 * the Phase 2.1 instrumentation log to inform Phase 2.5 chunk sizing
 * and the differential-`why`-cap decision.
 *
 * - `avg` / `max`: in characters
 * - `count_over_400` / `count_over_480`: how many strings approach the
 *   500-char cap (signal that the cap is biting)
 * - `count_under_50`: how many strings are essentially placeholder
 *   length (signal that Claude is treating some kinds as throwaway)
 */
export interface WhyDistribution {
  avg: number;
  max: number;
  count_over_400: number;
  count_over_480: number;
  count_under_50: number;
}

/**
 * Computes the per-workout `why` length distribution for a batch of
 * strings. Pure — no IO, no side effects. The caller of
 * generateTrainingPlan passes the array of `why` values it just
 * received; this function summarises them for the metrics log.
 *
 * Returns zeros on an empty input rather than NaN so log lines stay
 * parseable.
 */
export function computeWhyDistribution(whys: string[]): WhyDistribution {
  if (whys.length === 0) {
    return {
      avg: 0,
      max: 0,
      count_over_400: 0,
      count_over_480: 0,
      count_under_50: 0,
    };
  }
  let total = 0;
  let max = 0;
  let over400 = 0;
  let over480 = 0;
  let under50 = 0;
  for (const w of whys) {
    const len = w.length;
    total += len;
    if (len > max) max = len;
    if (len > 400) over400++;
    if (len > 480) over480++;
    if (len < 50) under50++;
  }
  return {
    avg: Math.round(total / whys.length),
    max,
    count_over_400: over400,
    count_over_480: over480,
    count_under_50: under50,
  };
}

/**
 * The shape of the [plan-gen-metrics] JSON log line. Stable contract:
 * Ben greps for `[plan-gen-metrics]` in Vercel logs and parses each
 * line into this shape. Changing field names breaks the parsing
 * scripts — add new fields rather than rename existing ones.
 */
export interface PlanGenMetrics {
  tokens_in: number;
  tokens_out: number;
  duration_s: number;
  workouts: number;
  why_avg: number;
  why_max: number;
  why_over_400: number;
  why_over_480: number;
  why_under_50: number;
  // True when generation was triggered by the wizard (first plan),
  // false for regens. Useful for separating wizard vs. regen metrics
  // when eyeballing the distribution.
  is_wizard: boolean;
  // True when the auto-retry-once path fired and the retry produced
  // the final plan. Helps gauge how often the soft retry mechanic is
  // load-bearing.
  retried: boolean;
}

/**
 * Builds the metrics-line payload. Pulled out so the logging call site
 * stays clean and the shape is unit-testable end-to-end.
 */
export function buildPlanGenMetrics(args: {
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  whys: string[];
  isWizard: boolean;
  retried: boolean;
}): PlanGenMetrics {
  const dist = computeWhyDistribution(args.whys);
  return {
    tokens_in: args.tokensIn,
    tokens_out: args.tokensOut,
    duration_s: Math.round(args.durationMs / 1000),
    workouts: args.whys.length,
    why_avg: dist.avg,
    why_max: dist.max,
    why_over_400: dist.count_over_400,
    why_over_480: dist.count_over_480,
    why_under_50: dist.count_under_50,
    is_wizard: args.isWizard,
    retried: args.retried,
  };
}
