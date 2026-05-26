import Link from "next/link";
import type { PlanWeek } from "@/lib/plan-derive";
import { dayPrimaryKind, daySummaryLabel, phaseLabel } from "@/lib/plan-derive";
import type { Day, UnitSystem } from "@/lib/plan";
import { classifyWorkout } from "@/lib/workout-variant";
import { formatDistance, formatElevation } from "@/lib/units";
import {
  CheckMini,
  WorkoutKindIcon,
} from "@/app/_components/today/icons";

interface Props {
  week: PlanWeek;
  totalWeeks: number;
  todayIso: string;
  // User's preferred display units. Storage is always km; this is the
  // render-time conversion only.
  unitSystem: UnitSystem;
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

type DayStatus = "logged" | "skipped" | "missed" | null;

// Per-day completion state for the week-strip glyph. Only past days carry
// one — today and the future show the plain kind icon, since a pending
// workout isn't "missed" until the day is actually over. Precedence on
// mixed-status days: missed wins (one missed session is the signal worth
// surfacing), then any-logged reads as logged, else skipped.
function dayCompletionStatus(day: Day, todayIso: string): DayStatus {
  if (day.workouts.length === 0) return null; // rest day
  if (day.date >= todayIso) return null; // today or future — no retro glyph
  const variants = day.workouts.map((w) =>
    classifyWorkout(w.status, day.date, todayIso),
  );
  if (variants.every((v) => v === "logged")) return "logged";
  if (variants.every((v) => v === "skipped")) return "skipped";
  if (variants.some((v) => v === "missed")) return "missed";
  if (variants.some((v) => v === "logged")) return "logged";
  return "skipped";
}

// Small status badge overlaid on the day pill's top-right corner. Logged
// reuses the shared CheckMini; skipped/missed are bare ×/! glyphs kept
// legible at ~10px. Colour is carried via currentColor so the className
// drives the theme token.
function DayStatusGlyph({ status }: { status: Exclude<DayStatus, null> }) {
  if (status === "logged") return <CheckMini color="#10b981" size={10} />;
  if (status === "skipped") {
    return (
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        className="text-zinc-400 dark:text-zinc-600"
      >
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      className="text-amber-500"
    >
      <path
        d="M12 5v9"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="19" r="1.3" fill="currentColor" />
    </svg>
  );
}

// One week in the long-form plan list. Whole row links to `/plan/week/[n]`
// so a tap deep-links into the day-by-day drilldown.
export function WeekSection({
  week,
  totalWeeks,
  todayIso,
  unitSystem,
  dim,
}: Props) {
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
          const completion = dayCompletionStatus(day, todayIso);
          const isRest = day.workouts.length === 0;
          const isoDay = day.date.split("-").map(Number);
          const weekdayIdx = new Date(
            Date.UTC(isoDay[0], isoDay[1] - 1, isoDay[2]),
          ).getUTCDay();
          const dayInitial = ["S", "M", "T", "W", "T", "F", "S"][weekdayIdx];
          return (
            <div
              key={day.date}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg border px-1 py-2 ${
                isToday
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/[0.08]"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              {/* Past-day completion badge — logged ✓ / skipped × / missed !.
                  Absolutely positioned so the kind icon below stays centred. */}
              {completion && (
                <span className="absolute right-0.5 top-0.5">
                  <DayStatusGlyph status={completion} />
                </span>
              )}
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
              {/* Kind icon is always the base layer so resting/run/strength
                  context is preserved even on logged or skipped past days. */}
              <div className="flex h-3 items-center">
                <WorkoutKindIcon
                  kind={isRest ? null : primaryKind}
                  color={isToday ? "#10b981" : "rgb(82 82 91)"}
                />
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
            {formatDistance(week.stats.volKm, unitSystem)}
          </span>
        </span>
        {week.stats.vertM > 0 && (
          <span
            className="font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
            style={{ letterSpacing: "0.14em" }}
          >
            VERT{" "}
            <span className="ml-1 font-medium text-zinc-950 dark:text-zinc-50">
              {formatElevation(week.stats.vertM, unitSystem)}
            </span>
          </span>
        )}
      </div>
    </Link>
  );
}
