"use client";

// Slide-up sheet on mobile / centred card on desktop. Lets the user log a
// custom activity outside the prescribed plan — gym session they squeezed
// in, a recovery hike they took on a rest day, etc. Writes a workout row
// flagged is_custom=true so regen preserves it.

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { addCustomActivity } from "@/app/actions";
import type { WorkoutKind } from "@/lib/plan";
import { ArrowRight } from "./icons";

// The parent unmounts the sheet entirely on close (rather than passing
// open=false), so all local state resets automatically when the sheet
// re-mounts. No reset effect needed here.

// One chip per DB kind. The label IS the canonical title — the user
// types what they did in the details field, but the kind chip alone
// decides which variant body renders on the drill-down.
const KIND_OPTIONS: { label: string; kind: WorkoutKind; title: string }[] = [
  { label: "Run", kind: "run", title: "Run" },
  { label: "Strength", kind: "gym", title: "Strength" },
  { label: "Hike", kind: "hike", title: "Hike" },
  { label: "Cross", kind: "cross", title: "Cross-training" },
  { label: "Physio", kind: "physio", title: "Physio" },
  { label: "Mobility", kind: "mobility", title: "Mobility" },
];

interface Props {
  date: string;
  onClose: () => void;
}

export function AddActivitySheet({ date, onClose }: Props) {
  const [picked, setPicked] = useState(0);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const detailsId = useId();
  const headingId = useId();

  // Close on Escape — standard sheet keyboard affordance.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = useCallback(() => {
    const choice = KIND_OPTIONS[picked];
    const finalDetails = details.trim();
    if (!finalDetails) {
      setError("Add a sentence or two on what you did.");
      return;
    }
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await addCustomActivity({
            kind: choice.kind,
            title: choice.title,
            details: finalDetails,
            date,
          });
          onClose();
        } catch (e) {
          console.error("Failed to add activity", e);
          setError("Couldn't save — try again.");
        }
      })();
    });
  }, [picked, details, date, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/60 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      onClick={(e) => {
        // Click-through on the backdrop dismisses; clicks on the card
        // bubble up only when the user explicitly hits Close.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full flex-col gap-4 rounded-t-[20px] border-t border-zinc-200 bg-zinc-50 px-4 pb-[max(env(safe-area-inset-bottom),18px)] pt-4 shadow-[0_-20px_60px_rgba(0,0,0,0.18)] sm:max-w-[420px] sm:rounded-[20px] sm:border sm:px-5 sm:pb-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h2
            id={headingId}
            className="font-mono text-[10.5px] font-semibold uppercase text-zinc-500 dark:text-zinc-400"
            style={{ letterSpacing: "0.2em" }}
          >
            — ADD ACTIVITY · {date}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Kind picker — wraps onto two rows on narrow viewports so all six
            fit without horizontal scroll. */}
        <div className="flex flex-wrap gap-1.5">
          {KIND_OPTIONS.map((o, i) => {
            const active = i === picked;
            return (
              <button
                key={o.label}
                type="button"
                onClick={() => setPicked(i)}
                className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition active:scale-[0.97] ${
                  active
                    ? "border-emerald-500 bg-emerald-500 text-emerald-950"
                    : "border-zinc-200 bg-transparent text-zinc-950 dark:border-zinc-800 dark:text-zinc-50"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor={detailsId}
            className="font-mono text-[10px] uppercase text-zinc-500"
            style={{ letterSpacing: "0.2em" }}
          >
            DETAILS
          </label>
          <textarea
            id={detailsId}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="e.g. 30 min easy bike, +120m vert"
            disabled={isPending}
            className="min-h-[90px] w-full resize-y rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[13.5px] leading-relaxed text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:placeholder:text-zinc-600"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-[13.5px] font-medium text-zinc-500 hover:text-zinc-950 disabled:opacity-50 dark:hover:text-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition active:scale-[0.97] hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Adding…" : "Add to today"}
            {!isPending && <ArrowRight color="#052e1f" size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
