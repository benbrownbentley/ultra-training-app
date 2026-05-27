import { describe, expect, it } from "vitest";
import {
  buildPlanGenMetrics,
  computeWhyDistribution,
} from "@/lib/plan-gen-metrics";

describe("computeWhyDistribution", () => {
  it("returns zero stats on an empty array", () => {
    expect(computeWhyDistribution([])).toEqual({
      avg: 0,
      max: 0,
      count_over_400: 0,
      count_over_480: 0,
      count_under_50: 0,
    });
  });

  it("computes avg / max / threshold counts over a mixed batch", () => {
    // Mix of short / mid / long / near-cap strings so each counter bites.
    const whys = [
      "x".repeat(30), // under 50
      "x".repeat(40), // under 50
      "x".repeat(120), // mid
      "x".repeat(300), // mid
      "x".repeat(420), // over 400, NOT over 480
      "x".repeat(490), // over 400 AND over 480
      "x".repeat(498), // over 400 AND over 480
    ];
    // total = 30+40+120+300+420+490+498 = 1898
    // avg = round(1898 / 7) = 271
    const dist = computeWhyDistribution(whys);
    expect(dist.avg).toBe(271);
    expect(dist.max).toBe(498);
    expect(dist.count_over_400).toBe(3);
    expect(dist.count_over_480).toBe(2);
    expect(dist.count_under_50).toBe(2);
  });

  it("treats threshold values strictly (> not >=)", () => {
    expect(computeWhyDistribution(["x".repeat(400)]).count_over_400).toBe(0);
    expect(computeWhyDistribution(["x".repeat(401)]).count_over_400).toBe(1);
    expect(computeWhyDistribution(["x".repeat(480)]).count_over_480).toBe(0);
    expect(computeWhyDistribution(["x".repeat(481)]).count_over_480).toBe(1);
    // count_under_50 uses strict less-than: 50 chars is NOT under 50.
    expect(computeWhyDistribution(["x".repeat(50)]).count_under_50).toBe(0);
    expect(computeWhyDistribution(["x".repeat(49)]).count_under_50).toBe(1);
  });
});

describe("buildPlanGenMetrics", () => {
  it("rounds duration to whole seconds and folds distribution in", () => {
    const m = buildPlanGenMetrics({
      tokensIn: 8200,
      tokensOut: 24500,
      durationMs: 248_700,
      whys: ["x".repeat(120), "x".repeat(420)],
      isWizard: false,
      retried: false,
    });
    expect(m.tokens_in).toBe(8200);
    expect(m.tokens_out).toBe(24500);
    expect(m.duration_s).toBe(249); // 248_700 ms → 249s rounded
    expect(m.workouts).toBe(2);
    expect(m.why_avg).toBe(270);
    expect(m.why_max).toBe(420);
    expect(m.why_over_400).toBe(1);
    expect(m.why_over_480).toBe(0);
    expect(m.why_under_50).toBe(0);
    expect(m.is_wizard).toBe(false);
    expect(m.retried).toBe(false);
  });

  it("preserves the retried + is_wizard flags", () => {
    const m = buildPlanGenMetrics({
      tokensIn: 1000,
      tokensOut: 2000,
      durationMs: 30_000,
      whys: [],
      isWizard: true,
      retried: true,
    });
    expect(m.is_wizard).toBe(true);
    expect(m.retried).toBe(true);
    expect(m.workouts).toBe(0);
  });

  it("Phase 2.5.2: forwards cache_read / cache_creation fields", () => {
    const m = buildPlanGenMetrics({
      tokensIn: 8200,
      tokensOut: 1200,
      cacheReadInputTokens: 7400, // big read = cache hit
      cacheCreationInputTokens: 0,
      durationMs: 11_000,
      whys: [],
      isWizard: false,
      retried: false,
    });
    expect(m.cache_read_input_tokens).toBe(7400);
    expect(m.cache_creation_input_tokens).toBe(0);
  });

  it("Phase 2.5.2: defaults missing cache fields to zero", () => {
    // Legacy call sites that pre-date the cache instrumentation may
    // not pass the fields. We default to zero so the [plan-gen-
    // metrics] line stays parseable across deploy boundaries.
    const m = buildPlanGenMetrics({
      tokensIn: 1000,
      tokensOut: 2000,
      durationMs: 30_000,
      whys: [],
      isWizard: false,
      retried: false,
    });
    expect(m.cache_read_input_tokens).toBe(0);
    expect(m.cache_creation_input_tokens).toBe(0);
  });

  it("instrumentation: splits claude vs db sub-timing into whole seconds", () => {
    const m = buildPlanGenMetrics({
      tokensIn: 5000,
      tokensOut: 12000,
      durationMs: 42_400,
      claudeDurationMs: 41_200,
      dbDurationMs: 1_200,
      validatorRetries: 0,
      whys: [],
      isWizard: false,
    });
    expect(m.duration_s).toBe(42);
    expect(m.claude_duration_s).toBe(41);
    expect(m.db_duration_s).toBe(1);
  });

  it("instrumentation: derives retried from validatorRetries when not passed", () => {
    const firstPass = buildPlanGenMetrics({
      tokensIn: 1,
      tokensOut: 1,
      durationMs: 1000,
      validatorRetries: 0,
      whys: [],
      isWizard: false,
    });
    expect(firstPass.validator_retries).toBe(0);
    expect(firstPass.retried).toBe(false);

    const retried = buildPlanGenMetrics({
      tokensIn: 1,
      tokensOut: 1,
      durationMs: 1000,
      validatorRetries: 1,
      whys: [],
      isWizard: false,
    });
    expect(retried.validator_retries).toBe(1);
    expect(retried.retried).toBe(true);
  });

  it("instrumentation: an explicit retried flag still wins over the derived value", () => {
    const m = buildPlanGenMetrics({
      tokensIn: 1,
      tokensOut: 1,
      durationMs: 1000,
      validatorRetries: 0,
      retried: true,
      whys: [],
      isWizard: false,
    });
    expect(m.retried).toBe(true);
  });

  it("instrumentation: claude/db sub-timing default to zero when omitted", () => {
    const m = buildPlanGenMetrics({
      tokensIn: 1,
      tokensOut: 1,
      durationMs: 30_000,
      whys: [],
      isWizard: false,
      retried: false,
    });
    expect(m.claude_duration_s).toBe(0);
    expect(m.db_duration_s).toBe(0);
    expect(m.validator_retries).toBe(0);
  });
});
