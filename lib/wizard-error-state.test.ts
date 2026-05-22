// Smoke test for the wizard's GeneratingErrorState — Phase 2.1's
// branded retry screen. Rendered via react-dom/server's
// renderToStaticMarkup so we don't need jsdom or React Testing Library
// for a single rendering assertion. The spec's intent is to confirm
// the Retry button + message text reach the DOM; static markup is
// enough to verify that.

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GeneratingErrorState } from "@/app/wizard/_components/GeneratingDoneStates";
import { PLAN_GEN_ERROR_COPY } from "@/lib/plan-gen-result";

// React escapes apostrophes / quotes as numeric HTML entities in the
// static markup, so a literal string-contains check on raw output
// misses them. Normalising decodes the two entities we actually use
// in this copy so the assertion stays readable.
function decodeEntities(html: string): string {
  return html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
}

describe("GeneratingErrorState", () => {
  it("renders the Try again button + copy for generation_timeout", () => {
    const html = decodeEntities(
      renderToStaticMarkup(
        createElement(GeneratingErrorState, {
          code: "generation_timeout",
          requestId: "deadbeef",
          onTryAgain: () => {},
          onEditSetup: () => {},
        }),
      ),
    );
    expect(html).toContain("Try again");
    expect(html).toContain("Edit setup");
    expect(html).toContain(PLAN_GEN_ERROR_COPY.generation_timeout.title);
    expect(html).toContain("LOST THE SIGNAL");
    expect(html).toContain("DEADBEEF");
  });

  it("omits the Edit setup secondary when no handler is provided", () => {
    const html = decodeEntities(
      renderToStaticMarkup(
        createElement(GeneratingErrorState, {
          code: "unknown",
          onTryAgain: () => {},
        }),
      ),
    );
    expect(html).not.toContain("Edit setup");
    // Retry is always present — that's the primary CTA contract.
    expect(html).toContain("Try again");
  });

  it("uses the shared copy table for each code variant", () => {
    for (const code of [
      "generation_timeout",
      "validation_failed",
      "anthropic_error",
      "unknown",
    ] as const) {
      const html = decodeEntities(
        renderToStaticMarkup(
          createElement(GeneratingErrorState, {
            code,
            onTryAgain: () => {},
          }),
        ),
      );
      const copy = PLAN_GEN_ERROR_COPY[code];
      expect(html).toContain(copy.title);
      expect(html).toContain(copy.body);
    }
  });
});
