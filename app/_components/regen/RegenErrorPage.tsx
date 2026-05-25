"use client";

// Page-scoped wrapper around StateError for the /regen?error=<code>
// generation-failure path. Wires the Try Again CTA to re-fire
// previewPlan via the same envelope path the regen sheet uses, OR
// (when ?jobId=<id> is also present) to resume the partial job from
// its last successful phase. Resume preserves the Phase 2.5
// chunked-pipeline work the user already paid for. See
// lib/plan-gen-result.ts for the error-code taxonomy.

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewPlan, resumeGenerationJob } from "@/app/actions";
import type { PlanGenErrorCode } from "@/lib/plan-gen-result";
import { StateError } from "./StateError";

interface Props {
  code: PlanGenErrorCode;
  requestId?: string;
  // When set, the Try Again button resumes the partial job from its
  // last successful phase (chunked path). When null, retry fires a
  // fresh previewPlan so the orchestrator starts over.
  jobId: number | null;
}

export function RegenErrorPage({ code, requestId, jobId }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const onTryAgain = useCallback(() => {
    startTransition(async () => {
      try {
        // Resume path — preserves the completed phases on the
        // existing job row. Only available on the chunked path
        // (jobId is set). Phase 2.5.2 hotfix: resumeGenerationJob
        // now just flips status back to 'pending' and returns
        // immediately — it does NOT run the orchestrator. The work
        // happens on the next page (the GeneratingPhaseState
        // component's advance loop picks up at the failed phase).
        if (jobId !== null) {
          const r = await resumeGenerationJob(jobId);
          if (!r.ok) {
            router.replace(
              `/regen?error=${r.code}&req=${r.requestId}&jobId=${jobId}`,
            );
            return;
          }
          // Route back to the chunked progress page. The advance
          // loop's first iteration retries the failed phase; if it
          // succeeds, the user lands on the preview diff naturally
          // (via RegenJobPage's onComplete handler).
          router.replace(`/regen?job=${jobId}`);
          return;
        }
        // Fresh-start retry path — legacy single-call OR a new
        // chunked job depending on the env flag.
        const r = await previewPlan();
        if (!r.ok) {
          router.replace(`/regen?error=${r.code}&req=${r.requestId}`);
          return;
        }
        if (r.jobId !== null) {
          router.replace(`/regen?job=${r.jobId}`);
        } else {
          router.replace(`/regen?preview=${r.previewId}`);
        }
      } catch (e) {
        console.error("[RegenErrorPage] retry/resume threw", e);
        router.replace(`/regen?error=generation_timeout`);
      }
    });
  }, [jobId, router]);

  return <StateError onTryAgain={onTryAgain} requestId={requestId} code={code} />;
}
