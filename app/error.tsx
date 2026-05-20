"use client";

import { useEffect } from "react";
import { ErrorShell } from "@/app/_components/error-shell";

// Root error boundary — catches anything thrown by the home segment or
// the route group layouts. No secondary "Back to Today" link because
// this IS the Today segment; that'd just be circular.
export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <ErrorShell
      route="home"
      eyebrow="REST DAY"
      title="Looks like our servers are having a rest day."
      body="Your plan is safe. Give us a minute — we'll be back at it shortly."
      primaryLabel="Try again"
      onPrimary={reset}
      requestId={error.digest}
    />
  );
}
