"use client";

// Page-scoped wrapper around GeneratingPhaseState for the
// /regen?job=<id> path. The dedicated route now plays as a brief
// atmospheric ceremony (~8s) before auto-dismissing the user back
// to "/", where the global banner picks up the in-flight chain and
// tapping it re-opens the same GeneratingPhaseState inside the
// minimisable RegenProgressSheet. See PROJECT_BRIEF.md → "Regen
// async + notification UX (2026-05-28)" for the hybrid tap-flow
// decision.
//
// onComplete / onFailed still fire from inside the ceremony — if
// the chain happens to land in <8s (rare but real for small plans
// or resumed jobs) the existing routing pushes the user straight
// to the preview/error page rather than home.

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GeneratingPhaseState } from "@/app/_components/generating/GeneratingPhaseState";
import type { JobStatusSnapshot } from "@/lib/plan-generation-types";

// 8 seconds — long enough to read as "ceremony" rather than a redirect
// flash, short enough that the user isn't pinned waiting on a chain
// that takes minutes. The banner + sheet take over after this.
const CEREMONY_DURATION_MS = 8000;

interface Props {
  jobId: number;
}

export function RegenJobPage({ jobId }: Props) {
  const router = useRouter();

  // Fixed-window auto-dismiss. Cleanup clears the timer if the user
  // navigates away early OR onComplete/onFailed fires first (those
  // call router.replace which unmounts this component before the
  // timer fires, so the cleanup is the safety net for memory leaks
  // — not the primary cancel path).
  useEffect(() => {
    const t = window.setTimeout(() => {
      router.replace("/");
    }, CEREMONY_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [router]);

  const onComplete = useCallback(
    (snapshot: JobStatusSnapshot) => {
      // Regen orchestrator always sets previewId on complete. Wizard
      // shouldn't land here at all — it stays inside WizardClient's
      // state machine.
      if (snapshot.previewId) {
        router.replace(`/regen?preview=${snapshot.previewId}`);
      } else {
        // Defensive: complete but no previewId means something
        // unusual happened (wizard-trigger job that somehow routed
        // here, or RPC race). Bounce home rather than hang.
        router.replace("/");
      }
    },
    [router],
  );

  const onFailed = useCallback(
    (snapshot: JobStatusSnapshot) => {
      const code = snapshot.failureCode ?? "unknown";
      router.replace(`/regen?error=${code}&jobId=${snapshot.jobId}`);
    },
    [router],
  );

  return (
    <GeneratingPhaseState
      jobId={jobId}
      onComplete={onComplete}
      onFailed={onFailed}
    />
  );
}
