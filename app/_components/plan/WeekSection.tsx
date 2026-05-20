import Link from "next/link";
import type { PlanWeek } from "@/lib/plan-derive";
import { dayPrimaryKind, daySummaryLabel, phaseLabel } from "@/lib/plan-derive";
import {
  CheckMini,
  WorkoutKindIcon,
} from "@/app/_components/today/icons";

interface Props {
  week: PlanWeek;
  totalWeeks: number;
  todayIso: string;
  // Visually mute the whole week (used during regeneration).
  dim?: boolean;
}

// Phase tint behind the entire card — same palette as the sparkline so the
// page reads as one piece. Returns null for `base` (kept neutral).
function phaseTintClass(phase: string, isCurrent: boolean): string {
  if (isCurrent) return "bg-emerald-50 dark:bg-emerald-500/[0.08]";
  switch (phase) {
    case "build":
      return "bg-emerald-500/[0.05] dark:bg-emerald-500/[0.06]";
    case "peak":
      return "bg-emerald-500/[0.10] dark:bg-emerald-500/[0.11]";
    case "taper":
      return "bg-emerald-200/[0.20] dark:bg-emerald-300/[0.05]";
    default:
      return "";
  }
}

// One week in the long-form plan list. Whole row links to `/plan/week/[n]`
// so a tap deep-links into the day-by-day drilldown.
export function WeekSection({ week, totalWeeks, todayIso, dim }: Props) {
  const tint = phaseTintClass(week.phase, week.isCurrent);
  const borderColor = week.isCurrent
    ? "border-emerald-500"
    : "border-zinc-200 dark:border-zinc-800";
  const labelColor = week.isCurrent
    ? "text-emerald-500"
    : "text-zinc-500";
  const opacity = week.isPast ? "opacity-60" : "opacity-100";

  return (
    <Link
      href={`/plan/week/${week.weekNum}`}
      aria-disabled={dim || undefined}
      className={`block rounded-[12px] border px-4 py-3.5 ${tint} ${borderColor} ${opacity} ${dim ? "pointer-events-none opacity-50" : ""}`}
    >
      <div className="mb-2.5 flex items-baseline justify-between">
        <span
          className={`whitespace-nowrap font-mono text-[10.5px] font-semibold uppercase ${labelColor}`}
          style={{ letterSpacing: "0.2em" }}
        >
          — WEEK {week.weekNum} OF {totalWeeks} · {phaseLabel(week.phase)}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-zinc-400 dark:text-zinc-600"
          />
        </svg>
      </div>

      <div className="flex gap-1">
        {week.days.map((day) => {
          const primaryKind = dayPrimaryKind(day.workouts);
          const isToday = day.date === todayIso;
          const isDayDone =
            day.workouts.length > 0 &&
            day.workouts.every((w) => w.status === "completed");
          const isRest = day.workouts.length === 0;
          const isoDay = day.date.split("-").map(Number);
          const weekdayIdx = new Date(
            Date.UTC(isoDay[0], isoDay[1] - 1, isoDay[2]),
          ).getUTCDay();
          const dayInitial = ["S", "M", "T", "W", "T", "F", "S"][weekdayIdx];
          return (
            <div
              key={day.date}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg border px-1 py-2 ${
                isToday
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/[0.08]"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <span
                className={`font-mono text-[10px] ${
                  isToday
                    ? "font-semibold text-emerald-500"
                    : "font-medium text-zinc-500"
                }`}
                style={{ letterSpacing: "0.1em" }}
              >
                {dayInitial}
              </span>
              <div className="flex h-3 items-center">
                {isDayDone ? (
                  <CheckMini color="#10b981" size={11} />
                ) : (
                  <WorkoutKindIcon
                    kind={isRest ? null : primaryKind}
                    color={
                      isToday ? "#10b981" : "rgb(82 82 91)"
                    }
                  />
                )}
              </div>
              <span
                className={`overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[9.5px] leading-tight ${
                  isToday
                    ? "text-zinc-950 dark:text-zinc-50"
                    : "text-zinc-500 dark:text-zinc-500"
                }`}
                style={{ maxWidth: "100%", textAlign: "center" }}
              >
                {daySummaryLabel(day)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-baseline gap-3.5">
        <span
          className="font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
          style={{ letterSpacing: "0.14em" }}
        >
          VOL{" "}
          <span className="ml-1 font-medium text-zinc-950 dark:text-zinc-50">
            {week.stats.volKm} km
          </span>
        </span>
        {week.stats.vertM > 0 && (
          <span
            className="font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
            style={{ letterSpacing: "0.14em" }}
          >
            VERT{" "}
            <span className="ml-1 font-medium text-zinc-950 dark:text-zinc-50">
              +{week.stats.vertM} m
            </span>
          </span>
        )}
      </div>
    </Link>
  );
}
