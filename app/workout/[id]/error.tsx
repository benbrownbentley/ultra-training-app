"use client";

import { useEffect } from "react";
import { ErrorShell } from "@/app/_components/error-shell";

export default function WorkoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <ErrorShell
      route="workout"
      eyebrow="SESSION · NOT FOUND"
      title="This workout isn't in your plan."
      body="It may have been replaced by a recent regen, or the link is from an old version of the plan. Head back to Today for the current view."
      primaryLabel="Try again"
      onPrimary={reset}
      secondaryHref="/"
      secondaryLabel="Back to Today"
      requestId={error.digest}
    />
  );
}
