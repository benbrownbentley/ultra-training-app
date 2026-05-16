"use client";

import { useTransition } from "react";
import { logWorkout } from "@/app/actions";
import type { WorkoutStatus } from "@/lib/plan";

interface Props {
  id: number;
  status: WorkoutStatus;
}

export function WorkoutLogButtons({ id, status }: Props) {
  const [isPending, startTransition] = useTransition();

  function toggle(target: Exclude<WorkoutStatus, "pending">) {
    const next: WorkoutStatus = status === target ? "pending" : target;
    startTransition(() => {
      void logWorkout(id, next);
    });
  }

  const completeActive = status === "completed";
  const skipActive = status === "skipped";

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => toggle("completed")}
        aria-label={completeActive ? "Unmark completed" : "Mark completed"}
        className={`flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-semibold transition disabled:opacity-50 ${
          completeActive
            ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500"
            : "border border-zinc-300 text-zinc-700 hover:border-emerald-500 hover:text-emerald-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-emerald-400 dark:hover:text-emerald-400"
        }`}
      >
        ✓
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => toggle("skipped")}
        aria-label={skipActive ? "Unmark skipped" : "Mark skipped"}
        className={`flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-semibold transition disabled:opacity-50 ${
          skipActive
            ? "bg-zinc-700 text-white shadow-sm dark:bg-zinc-600"
            : "border border-zinc-300 text-zinc-500 hover:border-zinc-500 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
        }`}
      >
        ⏭
      </button>
    </div>
  );
}
