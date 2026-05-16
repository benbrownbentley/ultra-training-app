"use client";

import { useState, useTransition } from "react";
import { regeneratePlan } from "@/app/actions";

export function RegeneratePlanButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (
      !confirm(
        "Regenerating will replace the entire plan (and clear any ✓/⏭ you've logged). Continue?",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await regeneratePlan();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to regenerate plan");
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-400"
      >
        {isPending
          ? "Generating plan (this may take ~30s)…"
          : "Regenerate plan with Claude"}
      </button>
      {error && (
        <div className="max-w-md text-center text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
