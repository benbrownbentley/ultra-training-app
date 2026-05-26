"use client";

import { useState } from "react";
import { Banner } from "./Banner";
import { AddEntrySheets } from "@/app/_components/journal/AddEntrySheets";

interface Props {
  // "missed" → amber/warn banner with the missed-recovery message;
  // "skipped" → muted banner.
  variant: "missed" | "skipped";
  workoutTitle: string;
  // YYYY-MM-DD; pre-filled into the note body so the entry self-dates.
  workoutDateIso: string;
}

/**
 * Drill-down banner for missed / skipped workouts that adds an
 * inline "+ Add note about why this didn't happen" affordance. Tapping
 * the affordance opens the Journal note sheet pre-filled with
 * `"{Missed|Skipped}: {title} on {date} — "`. Cursor lands after the
 * trailing space so the athlete can keep typing.
 *
 * Wraps the shared `Banner` so the chrome stays consistent with other
 * banner tones in the drill-down. Skip + missed adherence already
 * flows to Claude via the adherence summary block; this affordance
 * just lets the athlete attach context Claude can't infer.
 */
export function MissedSkippedBanner({
  variant,
  workoutTitle,
  workoutDateIso,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const isMissed = variant === "missed";
  const tone = isMissed ? "warn" : "muted";
  const label = isMissed ? "MISSED · YOU CAN STILL LOG THIS" : "SKIPPED";
  const bodyText = isMissed
    ? "Logged retrospective sessions are still fed into your next plan update."
    : "You can still log this retrospectively — it'll be folded into the next plan update.";
  const verb = isMissed ? "Missed" : "Skipped";
  const prefillBody = `${verb}: ${workoutTitle} on ${workoutDateIso} — `;
  const linkLabel = isMissed
    ? "+ ADD NOTE ABOUT WHY THIS DIDN'T HAPPEN"
    : "+ ADD NOTE ABOUT WHY";

  return (
    <>
      <Banner
        tone={tone}
        label={label}
        body={
          <div className="flex flex-col gap-1.5">
            <span>{bodyText}</span>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="self-start bg-transparent font-mono text-[10.5px] font-medium uppercase text-emerald-700 transition hover:underline dark:text-emerald-400"
              style={{ letterSpacing: "0.18em" }}
            >
              {linkLabel}
            </button>
          </div>
        }
      />
      <AddEntrySheets
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        prefill={{ type: "note", body: prefillBody }}
      />
    </>
  );
}
