"use client";

import { useEffect } from "react";
import { ErrorShell } from "@/app/_components/error-shell";

export default function RegenError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <ErrorShell
      route="regen"
      eyebrow="REGENERATION · REST DAY"
      title="Looks like our servers are having a rest day."
      body="Your plan is safe and unchanged. Give us a minute — we'll be back at it shortly."
      primaryLabel="Try again"
      onPrimary={reset}
      secondaryHref="/"
      secondaryLabel="Back to Today"
      requestId={error.digest}
    />
  );
}
