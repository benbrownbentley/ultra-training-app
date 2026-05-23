// Phase 2.5.2: smoke coverage on the PHASE_FLAVOUR rotating-text
// dictionary. Mainly a guard against accidental drift in the line
// counts / phase keys — the component's rotation CSS keys on
// `lines.length`, so a phase with a different number of lines than
// the others would either over- or under-cycle.

import { describe, expect, it } from "vitest";
import { PHASE_COPY, PHASE_FLAVOUR } from "@/lib/phase-flavour";
import type { GenerationPhase } from "@/lib/plan-generation-types";

describe("PHASE_FLAVOUR", () => {
  it("has an entry for every GenerationPhase", () => {
    const phases: GenerationPhase[] = ["base", "build", "peak", "taper"];
    for (const p of phases) {
      expect(PHASE_FLAVOUR[p]).toBeDefined();
    }
  });

  it("emits exactly 5 lines per phase", () => {
    for (const phase of ["base", "build", "peak", "taper"] as const) {
      expect(PHASE_FLAVOUR[phase].length).toBe(5);
    }
  });

  it("first BASE line keeps the original tagline meaning", () => {
    // Regression guard — PHASE_COPY's BASE tagline is "Building the
    // aerobic foundation." PHASE_FLAVOUR's first BASE line should
    // line up thematically. The component initially shows the
    // PHASE_COPY tagline; PHASE_FLAVOUR rotates underneath.
    expect(PHASE_FLAVOUR.base[0]).toBe("Mapping your aerobic foundation.");
  });

  it("PHASE_COPY and PHASE_FLAVOUR cover the same phase keys", () => {
    expect(Object.keys(PHASE_COPY).sort()).toEqual(
      Object.keys(PHASE_FLAVOUR).sort(),
    );
  });
});
