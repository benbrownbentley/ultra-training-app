import Link from "next/link";
import type { Day, WorkoutKind } from "@/lib/plan";
import { CheckMini, WorkoutKindIcon } from "./icons";

interface DaySummary {
  iso: string;
  dayInitial: string;
  date: string;
  primaryKind: WorkoutKind | null;
  label: string;
  done: boolean;
  isToday: boolean;
  // True when this is the day the user has navigated to via ?day= — the
  // strip needs a separate marker so "today" and "currently viewing" can
  // both be visible at the same time.
  isSelected: boolean;
  isPast: boolean;
}

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

// Picks the most "primary" workout of the day to drive the day-pill icon.
// run > gym > mobility — runs are the spine of the plan so they win.
function pickPrimary(day: Day): WorkoutKind | null {
  if (day.workouts.length === 0) return null;
  const order: WorkoutKind[] = ["run", "gym", "mobility"];
  for (const kind of order) {
    const w = day.workouts.find((w) => w.kind === kind);
    if (w) return kind;
  }
  return day.workouts[0].kind;
}

// Compact label shown under each day's icon. Tries to surface a number
// (distance, duration) from the workout details so the strip reads at a
// glance; falls back to the bare kind otherwise.
function summarise(day: Day): string {
  if (day.workouts.length === 0) return "rest";
  const first = day.workouts[0];
  const match = first.details.match(
    /(\d+\.?\d*)\s*(km|mi|min|hr|h)\b/i,
  );
  if (match) return `${match[1]} ${match[2].toLowerCase()}`;
  if (first.kind === "gym") return "strength";
  if (first.kind === "mobility") return "mobility";
  return first.title.toLowerCase().split(" ").slice(0, 1).join(" ");
}

export function buildWeekSummaries(
  weekDays: Day[],
  todayIso: string,
  selectedIso: string = todayIso,
): DaySummary[] {
  return weekDays.map((day) => {
    const parsed = day.date.split("-").map(Number);
    const weekdayIdx = new Date(Date.UTC(parsed[0], parsed[1] - 1, parsed[2])).getUTCDay();
    const allDone =
      day.workouts.length > 0 &&
      day.workouts.every((w) => w.status === "completed");
    return {
      iso: day.date,
      dayInitial: WEEKDAY_INITIALS[weekdayIdx],
      date: day.date.slice(-2),
      primaryKind: pickPrimary(day),
      label: summarise(day),
      done: allDone,
      isToday: day.date === todayIso,
      isSelected: day.date === selectedIso,
      isPast: day.date < todayIso,
    };
  });
}

export function WeekStrip({
  days,
  prevWeekHref,
  nextWeekHref,
  resetHref,
  isCurrentWeek,
}: {
  days: DaySummary[];
  prevWeekHref: string;
  nextWeekHref: string;
  resetHref: string;
  isCurrentWeek: boolean;
}) {
  return (
    <div>
      <div
        className="mb-2.5 whitespace-nowrap font-mono text-[11px] uppercase text-zinc-500 dark:text-zinc-500"
        style={{ letterSpacing: "0.2em" }}
      >
        — THIS WEEK
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => (
          <Link
            key={i}
            href={`/?day=${d.iso}`}
            aria-label={`Open ${d.iso}`}
            className={`flex flex-col items-center gap-1.5 rounded-[10px] border px-1 py-2 transition active:scale-[0.97] ${
              d.isToday && d.isSelected
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/[0.08]"
                : d.isToday
                  ? "border-emerald-500"
                  : d.isSelected
                    ? "border-zinc-400 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/40"
                    : "border-zinc-200 dark:border-zinc-800"
            }`}
            style={{ opacity: d.isPast && !d.done ? 0.55 : 1 }}
          >
            <div
              className={`font-mono text-[10px] ${
                d.isToday
                  ? "font-semibold text-emerald-600 dark:text-emerald-400"
                  : "font-medium text-zinc-500"
              }`}
              style={{ letterSpacing: "0.12em" }}
            >
              {d.dayInitial}
            </div>
            <div className="flex h-3 items-center">
              {d.done ? (
                <CheckMini color="#10b981" size={11} />
              ) : d.primaryKind ? (
                <WorkoutKindIcon
                  kind={d.primaryKind}
                  color={d.isToday ? "#10b981" : "rgb(82 82 91)"}
                />
              ) : (
                <span
                  className="h-px w-2"
                  style={{ background: "rgb(161 161 170)" }}
                />
              )}
            </div>
            <div
              className={`font-mono text-[10px] leading-tight ${
                d.isToday
                  ? "text-zinc-950 dark:text-zinc-50"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
              style={{ textAlign: "center", minHeight: 11 }}
            >
              {d.label}
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2.5">
        <Link
          href={prevWeekHref}
          aria-label="Previous week"
          className="whitespace-nowrap font-mono text-[10px] uppercase text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
          style={{ letterSpacing: "0.16em" }}
        >
          ← PREV
        </Link>
        <Link
          href={resetHref}
          className="whitespace-nowrap font-mono text-[10px] uppercase text-zinc-950 dark:text-zinc-50"
          style={{
            letterSpacing: "0.16em",
            opacity: isCurrentWeek ? 1 : 0.6,
          }}
        >
          · TODAY ·
        </Link>
        <Link
          href={nextWeekHref}
          aria-label="Next week"
          className="whitespace-nowrap font-mono text-[10px] uppercase text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
          style={{ letterSpacing: "0.16em" }}
        >
          NEXT →
        </Link>
      </div>
    </div>
  );
}
