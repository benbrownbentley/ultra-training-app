"use client";

import { useEffect } from "react";
import { ErrorShell } from "@/app/_components/error-shell";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <ErrorShell
      route="profile"
      eyebrow="PROFILE · UNREACHABLE"
      title="We couldn't load your profile."
      body="No data was changed. Try again — if it sticks, your plan is still safe on Today."
      primaryLabel="Try again"
      onPrimary={reset}
      secondaryHref="/"
      secondaryLabel="Back to Today"
      requestId={error.digest}
    />
  );
}
