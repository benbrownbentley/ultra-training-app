import { describe, expect, it } from "vitest";
import {
  classifyGenerationError,
  makeRequestId,
  PLAN_GEN_ERROR_COPY,
  type PlanGenErrorCode,
} from "@/lib/plan-gen-result";

describe("classifyGenerationError", () => {
  it("recognises validator-after-retry throws as validation_failed", () => {
    const err = new Error(
      "Plan failed validation after retry (issues: missing_dates). See server logs.",
    );
    expect(classifyGenerationError(err)).toBe("validation_failed");
  });

  it("recognises AbortError as generation_timeout", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(classifyGenerationError(err)).toBe("generation_timeout");
  });

  it("recognises timeout-shaped messages as generation_timeout", () => {
    expect(classifyGenerationError(new Error("Request timed out"))).toBe(
      "generation_timeout",
    );
    expect(classifyGenerationError(new Error("ETIMEDOUT"))).toBe(
      "generation_timeout",
    );
  });

  it("recognises Anthropic-style errors (numeric status) as anthropic_error", () => {
    const err = Object.assign(new Error("Internal server error"), {
      status: 500,
    });
    expect(classifyGenerationError(err)).toBe("anthropic_error");
  });

  it("falls back to unknown for shapes it doesn't recognise", () => {
    expect(classifyGenerationError(new Error("Boom"))).toBe("unknown");
    expect(classifyGenerationError(null)).toBe("unknown");
    expect(classifyGenerationError("just a string")).toBe("unknown");
    expect(classifyGenerationError({})).toBe("unknown");
  });
});

describe("makeRequestId", () => {
  it("returns an 8-character lowercase hex-ish string", () => {
    const id = makeRequestId();
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });
  it("changes across calls so two failures don't collide", () => {
    const a = makeRequestId();
    const b = makeRequestId();
    // Probabilistic — random 16-bit suffix collides 1/65536. Asserting
    // a !== b is fine; the suffix is 4 hex chars of entropy.
    expect(a).not.toEqual(b);
  });
});

describe("PLAN_GEN_ERROR_COPY", () => {
  it("has an entry for every PlanGenErrorCode", () => {
    const codes: PlanGenErrorCode[] = [
      "generation_timeout",
      "validation_failed",
      "anthropic_error",
      "unknown",
    ];
    for (const code of codes) {
      const copy = PLAN_GEN_ERROR_COPY[code];
      expect(copy).toBeDefined();
      expect(copy.eyebrow.length).toBeGreaterThan(0);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
    }
  });

  it("uses athletic-vocabulary eyebrows (no 'Error' / 'Failed' literals)", () => {
    // Reinforces the design language locked in PROJECT_BRIEF.md →
    // "Regeneration result page" — error states use REST DAY / SIGNAL
    // LOST / OFF COURSE framing, never the generic Error / Failed
    // labels.
    for (const code of Object.keys(PLAN_GEN_ERROR_COPY) as PlanGenErrorCode[]) {
      const { eyebrow } = PLAN_GEN_ERROR_COPY[code];
      expect(eyebrow.toLowerCase()).not.toContain("error");
      expect(eyebrow.toLowerCase()).not.toContain("failed");
    }
  });
});
