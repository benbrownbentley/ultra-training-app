"use client";

import { useEffect } from "react";
import { ErrorShell } from "@/app/_components/error-shell";

// Wizard state lives in client React state and IS wiped when this
// boundary renders — we don't persist a draft yet. Copy is honest about
// that. Persisting partial wizard input is a v2 hygiene item.
export default function WizardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <ErrorShell
      route="wizard"
      eyebrow="SETUP · PAUSED"
      title="Something went wrong."
      body="Head back to the start and we'll get you set up."
      primaryLabel="Restart setup"
      onPrimary={reset}
      requestId={error.digest}
    />
  );
}
