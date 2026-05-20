"use client";

import { useEffect } from "react";
import { ErrorShell } from "@/app/_components/error-shell";

export default function JournalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <ErrorShell
      route="journal"
      eyebrow="JOURNAL · UNREACHABLE"
      title="We couldn't load your journal."
      body="Your entries are safe. This is usually a network hiccup — try again in a few seconds."
      primaryLabel="Try again"
      onPrimary={reset}
      secondaryHref="/"
      secondaryLabel="Back to Today"
      requestId={error.digest}
    />
  );
}
