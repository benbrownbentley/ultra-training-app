"use client";

import { useTransition } from "react";
import Link from "next/link";
import { logWorkout } from "@/app/actions";
import type { Workout, WorkoutKind } from "@/lib/plan";
import type { Variant } from "@/lib/workout-variant";
import { summarisePlannedDetailForDiff } from "@/lib/preview";
import { MOTIFS } from "./motifs";
import { ArrowRight, CheckCircle, ChevronUpRight } from "./icons";
import { useLoggedToast } from "./LoggedToast";

// Maps the database kind to the design's eyebrow label. Mirrors the
// six DB kinds 1:1 — visual subtype is no longer inferred from title.
function eyebrowFor(kind: WorkoutKind): string {
  if (kind === "run") return "RUN";
  if (kind === "gym") return "STRENGTH";
  if (kind === "hike") return "HIKE";
  if (kind === "cross") return "CROSS";
  if (kind === "physio") return "PHYSIO";
  return "MOBILITY";
}

// Variant-aware eyebrow tail. The kind label is constant; the suffix
// flips with the workout's classification so a past-day card reads as
// MISSED, a future-day one as UPCOMING, etc.
function eyebrowSuffix(variant: Variant): string | null {
  if (variant === "missed") return "MISSED";
  if (variant === "future") return "UPCOMING";
  if (variant === "skipped") return "SKIPPED";
  return null;
}

function eyebrowTone(variant: Variant): string {
  if (variant === "logged") return "text-emerald-700 dark:text-emerald-400";
  if (variant === "missed") return "text-amber-600 dark:text-amber-500";
  if (variant === "future") return "text-zinc-400 dark:text-zinc-600";
  if (variant === "skipped") return "text-zinc-500 dark:text-zinc-500";
  return "text-zinc-500 dark:text-zinc-500";
}

interface Props {
  workout: Workout;
  // Classified state (today/past/future × pending/logged/skipped) —
  // computed at the call site via lib/workout-variant.classifyWorkout.
  variant: Variant;
  // True while a plan regeneration is in flight — dims the card and
  // disables its action buttons so the user can't double-act on stale data.
  dim?: boolean;
  loggedAt?: string | null;
}

// True if any actuals field has been populated. Drives whether the
// "+ ADD ACTUALS →" first-time prompt shows in the logged footer.
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

export function WorkoutCard({ workout, variant, dim, loggedAt }: Props) {
  const [isPending, startTransition] = useTransition();
  const toast = useLoggedToast();
  const Motif = MOTIFS[workout.kind];
  const isFaded = dim || isPending;
  const eyebrow = eyebrowFor(workout.kind);
  const suffix = eyebrowSuffix(variant);
  const tone = eyebrowTone(variant);
  const actualsCaptured = hasActuals(workout);

  function setStatus(next: Workout["status"]) {
    const wasCompleted = workout.status === "completed";
    startTransition(() => {
      void (async () => {
        try {
          await logWorkout(workout.id, next);
          if (next === "completed" && !wasCompleted) {
            toast.show({
              kind: "logged",
              workoutId: workout.id,
              title: workout.title,
            });
          } else if (next === "pending" && wasCompleted) {
            // Unlog toast carries an Undo that re-logs with a fresh
            // timestamp. Captured actuals on the row survive the
            // status flip (logWorkout only touches status + logged_at),
            // so undo is a clean state restore aside from the
            // re-logged-at moving forward by a few seconds.
            toast.show({
              kind: "unlogged",
              workoutId: workout.id,
              title: workout.title,
              onUndo: () => setStatus("completed"),
            });
          }
        } catch (e) {
          console.error("Failed to log workout", e);
        }
      })();
    });
  }

  // Short readout derived from the structured planned_detail. Legacy
  // backfilled rows surface their notes directly (the summariser
  // handles both shapes).
  const summary = summarisePlannedDetailForDiff(workout.planned_detail);

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
      {/* Overlay link — receives clicks across the entire card body.
          The content layer below is pointer-events:none so taps fall
          through to this link; the button row re-enables pointer
          events on itself so its clicks don't bubble to navigation. */}
      <Link
        href={`/workout/${workout.id}`}
        aria-label={`Open ${workout.title} details`}
        className="absolute inset-0 z-0 transition active:scale-[0.99]"
      />

      {/* Topographic motif sits between the overlay link and the
          content layer; pointer-events:none so it stays purely
          decorative. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-0 w-[55%]"
        style={{
          maskImage: "linear-gradient(to left, black 30%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to left, black 30%, transparent 100%)",
        }}
      >
        <Motif color="#10b981" opacity={0.16} />
      </div>

      <div className="pointer-events-none relative z-10 px-[18px] pb-3.5 pt-4">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <span
            className={`whitespace-nowrap font-mono text-[10.5px] font-semibold uppercase ${tone}`}
            style={{ letterSpacing: "0.2em" }}
          >
            — {eyebrow}
            {suffix && (
              <>
                <span className="mx-1.5 opacity-50">·</span>
                {suffix}
              </>
            )}
          </span>
          {variant === "logged" ? (
            <CheckCircle color="#10b981" size={16} />
          ) : (
            <ChevronUpRight color="rgb(161 161 170)" size={15} />
          )}
        </div>

        <h3
          className="m-0 text-[19px] font-medium leading-[1.15] text-zinc-950 dark:text-zinc-50"
          style={{ letterSpacing: "-0.01em" }}
        >
          {workout.title}
        </h3>

        {summary && (
          <div
            className="mt-2 font-mono text-[13px] text-zinc-950 dark:text-zinc-50"
            style={{ letterSpacing: "0.005em" }}
          >
            {summary}
          </div>
        )}

        {variant === "skipped" && (
          <div
            className="mt-1 font-mono text-[13px] text-zinc-500"
            style={{ letterSpacing: "0.005em" }}
          >
            <span className="mr-1.5 text-zinc-400 dark:text-zinc-600">›</span>
            Skipped
          </div>
        )}

        {/* Footer — pointer-events re-enabled per-control so buttons
            capture clicks while dead space inside the row falls
            through to the overlay link. */}
        <CardFooter
          variant={variant}
          actualsCaptured={actualsCaptured}
          doneTime={doneTime}
          isFaded={isFaded}
          isPending={isPending}
          workoutId={workout.id}
          onMarkDone={() => setStatus("completed")}
          onSkip={() => setStatus("skipped")}
          onLogRetro={() => setStatus("completed")}
          onUnlog={() => setStatus("pending")}
        />
      </div>
    </div>
  );
}

interface FooterProps {
  variant: Variant;
  actualsCaptured: boolean;
  doneTime: string | null;
  isFaded: boolean;
  isPending: boolean;
  workoutId: number;
  onMarkDone: () => void;
  onSkip: () => void;
  onLogRetro: () => void;
  // Reverts a logged workout to pending. Fires from the explicit ×
  // UNLOG text link on the logged variant; the unlogged toast surfaces
  // an Undo within a 5s window so the action stays reversible.
  onUnlog: () => void;
}

function CardFooter({
  variant,
  actualsCaptured,
  doneTime,
  isFaded,
  isPending,
  workoutId,
  onMarkDone,
  onSkip,
  onLogRetro,
  onUnlog,
}: FooterProps) {
  // Future: no action buttons — preview only.
  if (variant === "future") {
    return (
      <div className="pointer-events-none mt-3 flex items-center">
        <span
          className="font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
          style={{ letterSpacing: "0.18em" }}
        >
          — LOG OPENS ON THE DAY
        </span>
      </div>
    );
  }

  // Logged: no Log/Skip buttons. + ADD ACTUALS → on the left,
  // × UNLOG ghost link beside it (lower visual weight — should not
  // compete for attention), DONE timestamp on the right. The
  // CheckCircle in the eyebrow row is the passive status indicator;
  // UNLOG is the explicit interactive control.
  if (variant === "logged") {
    return (
      <div className="pointer-events-none relative mt-3 flex flex-wrap items-center gap-2.5">
        {!actualsCaptured && (
          <Link
            href={`/workout/${workoutId}`}
            className="pointer-events-auto inline-flex items-center gap-1 whitespace-nowrap font-mono text-[10.5px] uppercase text-emerald-700 transition active:scale-[0.97] hover:underline dark:text-emerald-400"
            style={{ letterSpacing: "0.18em" }}
          >
            + ADD ACTUALS →
          </Link>
        )}
        <button
          type="button"
          onClick={onUnlog}
          disabled={isFaded || isPending}
          className="pointer-events-auto inline-flex items-center gap-0.5 whitespace-nowrap bg-transparent font-mono text-[10.5px] uppercase text-zinc-400 transition active:scale-[0.97] hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-600 dark:hover:text-zinc-400"
          style={{ letterSpacing: "0.18em" }}
        >
          × UNLOG
        </button>
        <span className="flex-1" />
        {doneTime && (
          <span
            className="font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
            style={{ letterSpacing: "0.18em" }}
          >
            DONE · {doneTime}
          </span>
        )}
      </div>
    );
  }

  // Missed: only "Log retrospectively" — no Skip button (already past).
  // Row container is pointer-events-none so dead space inside the row
  // (right of the button) falls through to the card overlay Link.
  // pointer-events-auto is re-enabled per-control.
  if (variant === "missed") {
    return (
      <div className="pointer-events-none mt-3 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={onLogRetro}
          disabled={isFaded}
          className="pointer-events-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-500 bg-amber-50 px-3.5 text-[13px] font-semibold text-amber-900 transition active:scale-[0.97] hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
        >
          Log retrospectively
          <ArrowRight color="currentColor" size={13} />
        </button>
      </div>
    );
  }

  // Skipped: offer "Log retrospectively" + an Unskip toggle so the
  // user can revert. Same pointer-events handling as the other rows.
  if (variant === "skipped") {
    return (
      <div className="pointer-events-none mt-3 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={onLogRetro}
          disabled={isFaded}
          className="pointer-events-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-500 px-3.5 text-[13px] font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_6px_16px_rgba(16,185,129,0.28)] transition active:scale-[0.97] hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Log retrospectively
          <ArrowRight color="#052e1f" size={13} />
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={isFaded || isPending}
          className="pointer-events-auto inline-flex h-9 items-center justify-center rounded-lg px-3.5 text-[13px] font-medium text-zinc-600 transition active:scale-[0.97] hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Unskip
        </button>
      </div>
    );
  }

  // Upcoming (pending + today): full Log done / Skip pair. Row
  // container is pointer-events-none so empty space between/around
  // the two buttons falls through to the card-overlay Link — fixes
  // the dead-zone right of "Skip" not opening the drill-down.
  return (
    <div className="pointer-events-none mt-3 flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={onMarkDone}
        disabled={isFaded}
        className="pointer-events-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-500 px-3.5 text-[13px] font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_6px_16px_rgba(16,185,129,0.28)] transition active:scale-[0.97] hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Log done
        <ArrowRight color="#052e1f" size={13} />
      </button>
      <button
        type="button"
        onClick={onSkip}
        disabled={isFaded}
        className="pointer-events-auto inline-flex h-9 items-center justify-center rounded-lg px-3.5 text-[13px] font-medium text-zinc-600 transition active:scale-[0.97] hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        Skip
      </button>
    </div>
  );
}
