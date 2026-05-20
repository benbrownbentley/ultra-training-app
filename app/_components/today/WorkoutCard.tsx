"use client";

import { useTransition } from "react";
import Link from "next/link";
import { logWorkout } from "@/app/actions";
import type { Workout, WorkoutKind } from "@/lib/plan";
import { MOTIFS } from "./motifs";
import { ArrowRight, CheckCircle, ChevronUpRight } from "./icons";
import { useLoggedToast } from "./LoggedToast";

// Maps the database kind to the design's eyebrow label.
function eyebrowFor(kind: WorkoutKind): string {
  if (kind === "run") return "RUN";
  if (kind === "gym") return "STRENGTH";
  return "MOBILITY";
}

interface Props {
  workout: Workout;
  // True while a plan regeneration is in flight — dims the card and
  // disables its action buttons so the user can't double-act on stale data.
  dim?: boolean;
  loggedAt?: string | null;
}

// True if any actuals field has been populated. Drives whether the
// "+ ADD ACTUALS →" affordance shows in the logged footer.
function hasActuals(w: Workout): boolean {
  return (
    w.actual_duration_min != null ||
    w.actual_distance_km != null ||
    w.actual_elevation_gain_m != null ||
    w.actual_hr_avg != null ||
    w.actual_rpe != null ||
    (w.actual_notes != null && w.actual_notes.length > 0) ||
    w.actual_detail != null
  );
}

export function WorkoutCard({ workout, dim, loggedAt }: Props) {
  const [isPending, startTransition] = useTransition();
  const toast = useLoggedToast();
  const Motif = MOTIFS[workout.kind];
  const isLogged = workout.status === "completed";
  const isSkipped = workout.status === "skipped";
  const isFaded = dim || isPending;
  const eyebrow = eyebrowFor(workout.kind);
  const actualsCaptured = hasActuals(workout);

  function setStatus(next: Workout["status"]) {
    const wasUnlogged = workout.status !== "completed";
    startTransition(() => {
      void (async () => {
        try {
          await logWorkout(workout.id, next);
          // Only nudge the user toward actuals if they just transitioned
          // from not-done → done. Editing a logged card or skipping
          // shouldn't surface the toast.
          if (next === "completed" && wasUnlogged) {
            toast.show({ workoutId: workout.id, title: workout.title });
          }
        } catch (e) {
          console.error("Failed to log workout", e);
        }
      })();
    });
  }

  // Formats the "DONE · HH:MM" timestamp shown on logged cards in the design.
  // Falls back to "—" if the column isn't populated yet (e.g. legacy rows).
  const doneTime = loggedAt
    ? new Date(loggedAt).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null;

  return (
    <div
      className="relative overflow-hidden rounded-[14px] border border-zinc-200 bg-white transition-opacity duration-200 dark:border-zinc-800 dark:bg-[#0f0f11]"
      style={{ opacity: isFaded ? 0.55 : 1 }}
    >
      <Link
        href={`/workout/${workout.id}`}
        aria-label={`Open ${workout.title} details`}
        className="block px-[18px] pb-1 pt-4 transition active:scale-[0.99]"
      >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-[55%]"
        style={{
          maskImage: "linear-gradient(to left, black 30%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to left, black 30%, transparent 100%)",
        }}
      >
        <Motif color="#10b981" opacity={0.16} />
      </div>

      <div className="relative mb-1.5 flex items-start justify-between">
        <span
          className={`whitespace-nowrap font-mono text-[10.5px] font-semibold uppercase ${
            isLogged
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-zinc-500 dark:text-zinc-500"
          }`}
          style={{ letterSpacing: "0.2em" }}
        >
          — {eyebrow}
        </span>
        {isLogged ? (
          <CheckCircle color="#10b981" size={16} />
        ) : (
          <ChevronUpRight
            color="rgb(161 161 170)"
            size={15}
          />
        )}
      </div>

      <h3
        className="relative m-0 text-[19px] font-medium leading-[1.15] text-zinc-950 dark:text-zinc-50"
        style={{ letterSpacing: "-0.01em" }}
      >
        {workout.title}
      </h3>

      <div
        className="relative mt-2 font-mono text-[13px] text-zinc-950 dark:text-zinc-50"
        style={{ letterSpacing: "0.005em" }}
      >
        {workout.details}
      </div>

      {isSkipped && (
        <div
          className="relative mt-1 font-mono text-[13px] text-zinc-500"
          style={{ letterSpacing: "0.005em" }}
        >
          <span className="mr-1.5 text-zinc-400 dark:text-zinc-600">›</span>
          Skipped
        </div>
      )}
      </Link>

      <div className="relative flex flex-wrap items-center gap-2.5 px-[18px] pb-3.5 pt-2.5">
        {isLogged ? (
          <>
            <button
              type="button"
              onClick={() => setStatus("pending")}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-700 transition hover:underline disabled:opacity-50 dark:text-emerald-400"
            >
              Edit log <ArrowRight color="currentColor" size={13} />
            </button>
            {!actualsCaptured && (
              <Link
                href={`/workout/${workout.id}`}
                className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[10.5px] uppercase text-emerald-700 transition active:scale-[0.97] hover:underline dark:text-emerald-400"
                style={{ letterSpacing: "0.18em" }}
              >
                + ADD ACTUALS →
              </Link>
            )}
            <span className="flex-1" />
            {doneTime && (
              <span
                className="font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
                style={{ letterSpacing: "0.18em" }}
              >
                DONE · {doneTime}
              </span>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStatus("completed")}
              disabled={isFaded}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-500 px-3.5 text-[13px] font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_6px_16px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Log done
              <ArrowRight color="#052e1f" size={13} />
            </button>
            <button
              type="button"
              onClick={() => setStatus(isSkipped ? "pending" : "skipped")}
              disabled={isFaded}
              className="inline-flex h-9 items-center justify-center rounded-lg px-3.5 text-[13px] font-medium text-zinc-600 transition hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              {isSkipped ? "Unskip" : "Skip"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
