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

import { useCallback, useEffect, useRef } from "react";
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

  // Fixed-window auto-dismiss. The earlier implementation listed
  // `router` in the effect's dep array — but `useRouter()` returns a
  // fresh object identity on every render in Next 16's App Router.
  // GeneratingPhaseState below ticks internal elapsed-time state
  // ~once per second, and re-renders propagate up through context
  // boundaries enough that this parent's effect re-ran constantly,
  // clearing the prior setTimeout and arming a fresh 8s timer. The
  // ceremony never auto-dismissed because the timer kept resetting.
  //
  // Fix: mirror the ref pattern GeneratingPhaseState itself uses for
  // its onComplete/onFailed callbacks (see lines 54–61 of that file).
  // routerRef tracks the latest router instance per render; the
  // timer effect runs exactly once with [] deps and reads the
  // current router off the ref when it fires.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      routerRef.current.replace("/");
    }, CEREMONY_DURATION_MS);
    return () => window.clearTimeout(t);
  }, []);

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
