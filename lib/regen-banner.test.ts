// Pure-derivation tests for the regen banner. The server-side
// hydration helper (getBannerStateForUser) isn't covered here — it
// hits Supabase and isn't worth the mocking ceremony for v2. The
// derivation function is what the banner UI fans out from, and
// covering each branch + each kind transition is what protects
// against state-machine bugs as PRs 3 and 4 extend the surface.

import { describe, expect, it } from "vitest";
import {
  bannerStateFromRow,
  type BannerJobRow,
  type BannerPreviewRow,
} from "@/lib/regen-banner";
import type { MetaPlan } from "@/lib/plan-generation-types";

const META_2_PHASES: MetaPlan = {
  meta_summary: "",
  phases: [
    {
      phase: "base",
      weekStartIso: "2026-05-20",
      weekEndIso: "2026-06-09",
      weeks: 3,
    },
    {
      phase: "build",
      weekStartIso: "2026-06-10",
      weekEndIso: "2026-06-30",
      weeks: 3,
    },
  ],
};

function regenJob(overrides: Partial<BannerJobRow> = {}): BannerJobRow {
  return {
    id: 42,
    status: "pending",
    trigger: "regen",
    meta_plan: META_2_PHASES,
    completed_phases: [],
    preview_id: null,
    failure_code: null,
    notes: null,
    updated_at: "2026-05-28T18:30:00Z",
    ...overrides,
  };
}

describe("bannerStateFromRow", () => {
  it("returns idle when no job is passed", () => {
    expect(bannerStateFromRow(null, null).kind).toBe("idle");
  });

  it("returns idle for wizard-trigger jobs regardless of status", () => {
    // Wizard finalize publishes workouts directly to the live plan —
    // there's no preview surface for the banner to point at.
    for (const status of [
      "kicking-off",
      "pending",
      "complete",
      "failed",
    ] as const) {
      const out = bannerStateFromRow(
        regenJob({ trigger: "wizard", status }),
        null,
      );
      expect(out.kind).toBe("idle");
    }
  });

  it("derives in_progress with phase 1 of N when no phases are complete", () => {
    const out = bannerStateFromRow(
      regenJob({ status: "pending", completed_phases: [] }),
      null,
    );
    expect(out).toMatchObject({
      kind: "in_progress",
      jobId: 42,
      phaseIndex: 1,
      phaseTotal: 2,
      phaseLabel: "Base",
    });
  });

  it("advances phaseIndex + phaseLabel as completed_phases grows", () => {
    const out = bannerStateFromRow(
      regenJob({ status: "pending", completed_phases: ["base"] }),
      null,
    );
    expect(out).toMatchObject({
      kind: "in_progress",
      phaseIndex: 2,
      phaseTotal: 2,
      phaseLabel: "Build",
    });
  });

  it("shows 'Finalizing' once every phase has completed", () => {
    const out = bannerStateFromRow(
      regenJob({
        status: "pending",
        completed_phases: ["base", "build"],
      }),
      null,
    );
    expect(out).toMatchObject({
      kind: "in_progress",
      phaseIndex: 2,
      phaseTotal: 2,
      phaseLabel: "Finalizing",
    });
  });

  it("returns in_progress with null phase fields on kicking-off with no meta-plan yet", () => {
    // Precreate-then-meta path: the empty meta_plan shape lands during
    // precreate; runMetaPlanForJob populates phases afterwards. Banner
    // shouldn't crash on the intermediate state.
    const out = bannerStateFromRow(
      regenJob({
        status: "kicking-off",
        meta_plan: { meta_summary: "", phases: [] },
      }),
      null,
    );
    expect(out.kind).toBe("in_progress");
    expect(out.phaseIndex).toBeNull();
    expect(out.phaseTotal).toBeNull();
    expect(out.phaseLabel).toBeNull();
  });

  it("returns ready when status=complete with a pending preview", () => {
    const out = bannerStateFromRow(
      regenJob({ status: "complete", preview_id: 99 }),
      { id: 99, status: "pending" },
    );
    expect(out).toMatchObject({
      kind: "ready",
      jobId: 42,
      previewId: 99,
    });
  });

  it("drops to idle when status=complete but the preview is already accepted", () => {
    // User accepted the preview from another tab or earlier session —
    // banner shouldn't keep pointing at it.
    const out = bannerStateFromRow(
      regenJob({ status: "complete", preview_id: 99 }),
      { id: 99, status: "accepted" },
    );
    expect(out.kind).toBe("idle");
  });

  it("drops to idle when status=complete but the preview was discarded", () => {
    const out = bannerStateFromRow(
      regenJob({ status: "complete", preview_id: 99 }),
      { id: 99, status: "discarded" },
    );
    expect(out.kind).toBe("idle");
  });

  it("drops to idle when status=complete but no preview row was loaded", () => {
    // The preview row could be missing if it was hard-deleted or the
    // join failed; treat as idle rather than dangling a Review CTA.
    const out = bannerStateFromRow(
      regenJob({ status: "complete", preview_id: 99 }),
      null,
    );
    expect(out.kind).toBe("idle");
  });

  it("returns error with failure_code + notes when status=failed", () => {
    const out = bannerStateFromRow(
      regenJob({
        status: "failed",
        failure_code: "generation_timeout",
        notes: "no junk miles this week",
      }),
      null,
    );
    expect(out).toMatchObject({
      kind: "error",
      jobId: 42,
      failureCode: "generation_timeout",
      failedNotes: "no junk miles this week",
    });
  });

  it("returns idle for cancelled jobs", () => {
    const out = bannerStateFromRow(
      regenJob({ status: "cancelled" }),
      null,
    );
    expect(out.kind).toBe("idle");
  });

  it("ignores the preview row when the job is still in_progress", () => {
    // The job loaded a preview from a prior regen but the latest is
    // pending again — banner should show in_progress, not ready,
    // because the current job hasn't landed a preview yet.
    const out = bannerStateFromRow(
      regenJob({ status: "pending" }),
      { id: 1, status: "pending" } as BannerPreviewRow,
    );
    expect(out.kind).toBe("in_progress");
  });

  it("threads updated_at through to lastUpdatedAt on in_progress + error states", () => {
    // The lazy watchdog in RegenStatusProvider reads lastUpdatedAt to
    // decide whether a chain has gone silent. Idle/cancelled rows
    // don't need it (no watchdog action) but the live branches do.
    const stamp = "2026-05-28T17:00:00Z";
    const inProgress = bannerStateFromRow(
      regenJob({ status: "pending", updated_at: stamp }),
      null,
    );
    expect(inProgress.lastUpdatedAt).toBe(stamp);

    const failed = bannerStateFromRow(
      regenJob({ status: "failed", updated_at: stamp }),
      null,
    );
    expect(failed.lastUpdatedAt).toBe(stamp);
  });
});
