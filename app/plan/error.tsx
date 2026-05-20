"use client";

import { useEffect } from "react";
import { ErrorShell } from "@/app/_components/error-shell";

export default function PlanError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <ErrorShell
      route="plan"
      eyebrow="PLAN · UNREACHABLE"
      title="We couldn't load your plan."
      body="Your training data is safe. Try again — today's workout is still on Today."
      primaryLabel="Try again"
      onPrimary={reset}
      secondaryHref="/"
      secondaryLabel="Back to Today"
      requestId={error.digest}
    />
  );
}
