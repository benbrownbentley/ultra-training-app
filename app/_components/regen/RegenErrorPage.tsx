"use client";

// Page-scoped wrapper around StateError for the /regen?error=<code>
// generation-failure path. Lives in a client component so we can wire
// the Try Again CTA to re-fire previewPlan via the same envelope path
// the regen sheet uses — keeps every entry-point's retry behavior
// identical. See lib/plan-gen-result.ts for the code taxonomy.

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewPlan } from "@/app/actions";
import type { PlanGenErrorCode } from "@/lib/plan-gen-result";
import { StateError } from "./StateError";

interface Props {
  code: PlanGenErrorCode;
  requestId?: string;
}

export function RegenErrorPage({ code, requestId }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const onTryAgain = useCallback(() => {
    startTransition(async () => {
      try {
        const r = await previewPlan();
        if (!r.ok) {
          router.push(`/regen?error=${r.code}&req=${r.requestId}`);
          return;
        }
        router.push(`/regen?preview=${r.previewId}`);
      } catch (e) {
        console.error("[RegenErrorPage] previewPlan threw", e);
        router.push(`/regen?error=generation_timeout`);
      }
    });
  }, [router]);

  return <StateError onTryAgain={onTryAgain} requestId={requestId} code={code} />;
}
