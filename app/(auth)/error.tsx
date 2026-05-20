"use client";

import { useEffect } from "react";
import { ErrorShell } from "@/app/_components/error-shell";

// Catches errors thrown *inside* the auth route group's pages. The
// group's layout (if it ever throws) is caught by the root error.tsx,
// not here — Next.js doesn't let a route group catch its own layout's
// errors.
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <ErrorShell
      route="auth"
      eyebrow="SIGN-IN · STUMBLE"
      title="We couldn't complete that sign-in."
      body="Your account is fine — something on our end tripped. Try again, or if it keeps happening, ping us and we'll dig in."
      primaryLabel="Try again"
      onPrimary={reset}
      secondaryHref="/sign-in"
      secondaryLabel="Back to sign-in"
      requestId={error.digest}
    />
  );
}
