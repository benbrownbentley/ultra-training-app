"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary for the home segment. Next.js renders this when
 * a Server Component or Server Action under `app/` throws. `reset()` re-runs
 * the segment, which is the right recovery path for transient Supabase or
 * Claude API failures.
 */
export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
        Something went wrong
      </div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        We couldn&apos;t load your training plan.
      </h1>
      <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        This is usually a temporary connection hiccup. Try again, and if it
        keeps happening, check the server logs.
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
      >
        Try again
      </button>
    </div>
  );
}
