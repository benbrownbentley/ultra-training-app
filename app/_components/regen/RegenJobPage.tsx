"use client";

// Page-scoped wrapper around GeneratingPhaseState for the
// /regen?job=<id> path. Polls the orchestrator's job status; once
// complete with a previewId, routes to /regen?preview=<id> so the
// existing diff UI takes over. On failure, routes to
// /regen?error=<code> so the user lands on the branded retry state
// (RegenErrorPage handles the Resume CTA wiring).

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { GeneratingPhaseState } from "@/app/_components/generating/GeneratingPhaseState";
import type { JobStatusSnapshot } from "@/lib/plan-generation-types";

interface Props {
  jobId: number;
}

export function RegenJobPage({ jobId }: Props) {
  const router = useRouter();

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
