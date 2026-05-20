"use client";

import { useTransition } from "react";
import { signOut } from "@/app/actions";
import { ActionRow } from "./atoms";

// Wraps ActionRow so the sign-out action fires inside a transition.
export function SignOutRow() {
  const [isPending, startTransition] = useTransition();
  return (
    <ActionRow
      label={isPending ? "Signing out…" : "Sign out"}
      onClick={() => {
        if (isPending) return;
        startTransition(() => {
          void signOut();
        });
      }}
    />
  );
}
