"use client";

import { useState } from "react";
import type { PlanWeek } from "@/lib/plan-derive";
import { phaseLabel } from "@/lib/plan-derive";
import type { ContextRow } from "@/lib/regen-context";
import { PlanHeader } from "./PlanHeader";
import { SparklineCard } from "./VolumeSparkline";
import { WeekSection } from "./WeekSection";
import { PhaseDivider } from "./PhaseDivider";
import { RaceTile } from "./RaceTile";
import { RegeneratePlanRow } from "./RegeneratePlanRow";
import { TabBar } from "@/app/_components/today/TabBar";

interface Props {
  weeks: PlanWeek[];
  currentWeek: number;
  totalWeeks: number;
  daysToRace: number;
  todayIso: string;
  raceName: string;
  raceDateIso: string;
  raceDistance: string;
  raceElevationGain: number | null;
  regenContextRows: ContextRow[];
  regenSparseTip: boolean;
  unitSystem: import("@/lib/plan").UnitSystem;
}

// Maximum number of past weeks shown before requiring the "view earlier"
// expand. Picked so the screen lands you near the current week without
// burying the upcoming work below several screenfuls of history.
const PAST_PREVIEW_COUNT = 1;

export function PlanPageClient({
  weeks,
  currentWeek,
  totalWeeks,
  daysToRace,
  todayIso,
  raceName,
  raceDateIso,
  raceDistance,
  raceElevationGain,
  regenContextRows,
  regenSparseTip,
  unitSystem,
}: Props) {
  const [pastExpanded, setPastExpanded] = useState(false);
  // RegeneratePlanRow now owns its own pending state via the regen sheet;
  // the plan tab no longer needs to dim the list during regeneration
  // because the sheet's backdrop covers everything.
  const isRegenerating = false;

  const currentIdx = weeks.findIndex((w) => w.weekNum === currentWeek);
  const safeIdx = currentIdx === -1 ? 0 : currentIdx;
  const pastWeeks = weeks.slice(0, safeIdx);
  const currentWeekObj = weeks[safeIdx];
  const futureWeeks = weeks.slice(safeIdx + 1);

  const hiddenPastCount = Math.max(0, pastWeeks.length - PAST_PREVIEW_COUNT);
  const visiblePastWeeks = pastExpanded
    ? pastWeeks
    : pastWeeks.slice(pastWeeks.length - PAST_PREVIEW_COUNT);

  const isRaceWeek = currentWeekObj?.isRaceWeek ?? false;
  const headerLabel = isRaceWeek
    ? `TAPER · WEEK ${currentWeek} OF ${totalWeeks} · ${daysToRace} DAY${daysToRace === 1 ? "" : "S"} TO ${shortRace(raceName)}`
    : `${phaseLabel(currentWeekObj?.phase ?? "build")} · WEEK ${currentWeek} OF ${totalWeeks} · ${weeksToRace(daysToRace)} TO ${shortRace(raceName)}`;

  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <PlanHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[720px] flex-col">
          <div className="flex flex-col gap-3.5 px-4 pt-5 pb-3 sm:px-5">
            <div
              className={`font-mono text-[11px] font-semibold uppercase ${
                isRaceWeek ? "text-emerald-500" : "text-zinc-500"
              }`}
              style={{ letterSpacing: "0.2em" }}
            >
              — {headerLabel}
            </div>
            <SparklineCard weeks={weeks} currentWeek={currentWeek} />
            <RegeneratePlanRow
              contextRows={regenContextRows}
              showSparseTip={regenSparseTip}
            />
          </div>

          <div
            className={`flex flex-col gap-2.5 px-4 pb-5 sm:px-5 ${
              isRegenerating ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {hiddenPastCount > 0 && (
              <button
                type="button"
                onClick={() => setPastExpanded((v) => !v)}
                className="self-start py-1 font-mono text-[10.5px] font-medium uppercase text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
                style={{ letterSpacing: "0.16em" }}
              >
                {pastExpanded
                  ? "↓ COLLAPSE EARLIER WEEKS"
                  : `← VIEW ${hiddenPastCount} EARLIER WEEK${hiddenPastCount === 1 ? "" : "S"}`}
              </button>
            )}

            <WeekList
              weeks={visiblePastWeeks}
              totalWeeks={totalWeeks}
              todayIso={todayIso}
              prevPhase={null}
              dim={isRegenerating}
              unitSystem={unitSystem}
            />

            {currentWeekObj && (
              <>
                {visiblePastWeeks.length > 0 &&
                  visiblePastWeeks[visiblePastWeeks.length - 1].phase !==
                    currentWeekObj.phase && (
                    <PhaseDivider
                      label={`${phaseLabel(currentWeekObj.phase)} PHASE BEGINS`}
                    />
                  )}
                <WeekSection
                  week={currentWeekObj}
                  totalWeeks={totalWeeks}
                  todayIso={todayIso}
                  unitSystem={unitSystem}
                  dim={isRegenerating}
                />
              </>
            )}

            <WeekList
              weeks={futureWeeks}
              totalWeeks={totalWeeks}
              todayIso={todayIso}
              prevPhase={currentWeekObj?.phase ?? null}
              dim={isRegenerating}
              unitSystem={unitSystem}
            />

            <div className="mt-2">
              <RaceTile
                raceName={raceName}
                raceDateIso={raceDateIso}
                distance={raceDistance}
                elevationGainM={raceElevationGain}
                daysToRace={daysToRace}
              />
            </div>
          </div>
        </div>
      </div>
      <TabBar active="plan" />
    </div>
  );
}

// Helper renderer that inserts a PhaseDivider whenever the phase changes
// between two consecutive weeks.
function WeekList({
  weeks,
  totalWeeks,
  todayIso,
  prevPhase,
  dim,
  unitSystem,
}: {
  weeks: PlanWeek[];
  totalWeeks: number;
  todayIso: string;
  prevPhase: string | null;
  dim: boolean;
  unitSystem: import("@/lib/plan").UnitSystem;
}) {
  let last = prevPhase;
  const out: React.ReactNode[] = [];
  for (const w of weeks) {
    if (last && w.phase !== last) {
      out.push(
        <PhaseDivider
          key={`d-${w.weekNum}`}
          label={`${phaseLabel(w.phase)} PHASE BEGINS`}
        />,
      );
    }
    out.push(
      <WeekSection
        key={w.weekNum}
        week={w}
        totalWeeks={totalWeeks}
        todayIso={todayIso}
        unitSystem={unitSystem}
        dim={dim}
      />,
    );
    last = w.phase;
  }
  return <>{out}</>;
}

function shortRace(name: string): string {
  return name.split(" ").slice(0, 2).join(" ").toUpperCase();
}

// Compact "12 WEEKS" / "3 DAYS" framing for the phase header.
function weeksToRace(days: number): string {
  if (days <= 14) return `${days} DAY${days === 1 ? "" : "S"}`;
  const wks = Math.round(days / 7);
  return `${wks} WEEKS`;
}
