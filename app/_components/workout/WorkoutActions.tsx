"use client";

import { useTransition } from "react";
import { logWorkout } from "@/app/actions";
import type { WorkoutStatus } from "@/lib/plan";
import { ArrowRight } from "@/app/_components/today/icons";

type Variant = "upcoming" | "logged" | "skipped" | "missed" | "future";

interface Props {
  id: number;
  variant: Variant;
  loggedAt?: string | null;
}

// Sticky-bottom action bar on the workout detail page. Each variant has its
// own primary action; we surface them all rather than disable, because the
// design treats "log retrospectively" as the same write as "mark done" —
// only the labelling changes.
export function WorkoutActions({ id, variant, loggedAt }: Props) {
  const [isPending, startTransition] = useTransition();

  function setStatus(next: WorkoutStatus) {
    startTransition(() => {
      void logWorkout(id, next);
    });
  }

  if (variant === "logged") {
    return (
      <div className="flex items-center justify-center gap-3 border-t border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <button
          type="button"
          onClick={() => setStatus("pending")}
          disabled={isPending}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-zinc-200 bg-transparent px-4 text-sm font-medium text-zinc-950 transition active:scale-[0.97] hover:border-zinc-300 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-700"
        >
          Edit log
        </button>
        <span
          className="px-1 font-mono text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
          style={{ letterSpacing: "0.18em" }}
        >
          {loggedAt ? `DONE · ${formatLoggedAt(loggedAt)}` : "DONE"}
        </span>
      </div>
    );
  }

  if (variant === "future") {
    return (
      <div className="flex items-center justify-center border-t border-zinc-200 bg-zinc-50 px-4 py-3.5 dark:border-zinc-800 dark:bg-zinc-950">
        <span
          className="font-mono text-[10.5px] uppercase text-zinc-400 dark:text-zinc-600"
          style={{ letterSpacing: "0.2em" }}
        >
          — LOG OPENS ON THE DAY
        </span>
      </div>
    );
  }

  const primaryLabel =
    variant === "missed" || variant === "skipped"
      ? "Log retrospectively"
      : "Mark done";

  return (
    <div className="flex items-center justify-center gap-3 border-t border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <button
        type="button"
        onClick={() => setStatus("completed")}
        disabled={isPending}
        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition active:scale-[0.97] hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {primaryLabel}
        <ArrowRight color="#052e1f" size={16} />
      </button>
      <button
        type="button"
        onClick={() =>
          setStatus(variant === "skipped" ? "pending" : "skipped")
        }
        disabled={isPending}
        className="inline-flex h-11 items-center justify-center rounded-[10px] border border-zinc-200 px-4 text-sm font-medium text-zinc-950 transition active:scale-[0.97] hover:border-zinc-300 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-700"
      >
        {variant === "skipped" ? "Unskip" : "Mark skipped"}
      </button>
    </div>
  );
}

function formatLoggedAt(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
