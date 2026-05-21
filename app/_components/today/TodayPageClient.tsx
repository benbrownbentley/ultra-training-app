"use client";

import Link from "next/link";
import type { Day, Plan } from "@/lib/plan";
import type { ContextRow } from "@/lib/regen-context";
import { Header } from "./Header";
import { WorkoutCard } from "./WorkoutCard";
import { RestCard, TomorrowPreview } from "./RestCard";
import { WeekStrip, buildWeekSummaries } from "./WeekStrip";
import { PlanStrip } from "./PlanStrip";
import { TabBar } from "./TabBar";
import { RegenButton } from "./RegenButton";
import { LoggedToastProvider } from "./LoggedToast";
import { AddActivityRow } from "./AddActivityRow";

interface Props {
  plan: Plan;
  todayIso: string;
  // The day the user is currently viewing — equals todayIso when they're on
  // actual today, otherwise the ?day= they tapped to.
  selectedDayIso: string;
  today: Day | null;
  tomorrow: Day | null;
  daysToRace: number;
  weekDays: Day[];
  isCurrentWeek: boolean;
  prevWeekHref: string;
  nextWeekHref: string;
  resetHref: string;
  todayLabel: string;
  // Whether the day being shown in the TODAY section is the real today, or
  // the user has tapped a different WeekStrip pill via ?day=.
  isViewingToday: boolean;
  weekIndex: number;
  totalWeeks: number;
  // Workouts that were logged today, mapped by workout id to their
  // logged_at timestamp for the "DONE · HH:MM" affordance in the card footer.
  loggedAtById: Record<number, string | null>;
  // Context to pre-populate the regenerate sheet with so the user can see
  // what Claude already knows before choosing to regenerate.
  regenContextRows: ContextRow[];
  regenSparseTip: boolean;
}

function shortRaceName(name: string): string {
  return name.split(" ").slice(0, 2).join(" ").toUpperCase();
}

// Top-level shell for the Today screen. Regeneration is now owned by the
// universal RegenerateSheet (opened from the REGEN chip in the plan strip),
// so this component stays purely a renderer of plan data.
export function TodayPageClient({
  plan,
  todayIso,
  selectedDayIso,
  today,
  tomorrow,
  daysToRace,
  weekDays,
  isCurrentWeek,
  prevWeekHref,
  nextWeekHref,
  resetHref,
  todayLabel,
  isViewingToday,
  weekIndex,
  totalWeeks,
  loggedAtById,
  regenContextRows,
  regenSparseTip,
}: Props) {
  const todayWorkouts = today?.workouts ?? [];
  const isRestDay = todayWorkouts.length === 0;
  const allLogged =
    !isRestDay && todayWorkouts.every((w) => w.status === "completed");

  // Stacked centered eyebrow — date prominent on top, contextual state below.
  // The bottom label flips to LOGGED in emerald when the user's done with the
  // day, otherwise it tells them whether they're on today or browsing.
  const bottomLabel = allLogged
    ? "LOGGED"
    : isViewingToday
      ? "TODAY"
      : "BROWSING";

  const weekSummaries = buildWeekSummaries(weekDays, todayIso, selectedDayIso);
  const phaseLabel = `WK ${weekIndex}/${totalWeeks} · ${daysToRace}D OUT`;

  return (
    <LoggedToastProvider>
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <Header phase={phaseLabel} />

      <div className="flex flex-1 flex-col gap-4 overflow-hidden px-4 py-4 sm:px-5 sm:py-5">
        <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4">
          <section>
            <div className="mb-4 flex flex-col items-center gap-1">
              <div
                className="font-mono text-[13px] uppercase text-zinc-700 dark:text-zinc-300"
                style={{ letterSpacing: "0.18em" }}
              >
                {todayLabel}
              </div>
              <div
                className={`font-mono text-[11px] uppercase ${
                  allLogged
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-zinc-500"
                }`}
                style={{ letterSpacing: "0.2em" }}
              >
                — {bottomLabel} —
              </div>
              {!isViewingToday && (
                <Link
                  href="/"
                  className="mt-1 font-mono text-[10.5px] uppercase text-emerald-700 transition active:scale-[0.97] hover:text-emerald-600 dark:text-emerald-400"
                  style={{ letterSpacing: "0.18em" }}
                >
                  ← BACK TO TODAY
                </Link>
              )}
            </div>

            {isRestDay ? (
              <div className="flex flex-col gap-2.5">
                <RestCard />
                {tomorrow && tomorrow.workouts.length > 0 && (
                  <TomorrowPreview
                    summary={`${tomorrow.workouts[0].title} · ${tomorrow.workouts[0].details}`}
                  />
                )}
                <AddActivityRow date={selectedDayIso} />
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {todayWorkouts.map((w) => (
                  <WorkoutCard
                    key={w.id}
                    workout={w}
                    loggedAt={loggedAtById[w.id] ?? null}
                  />
                ))}
                <AddActivityRow date={selectedDayIso} />
              </div>
            )}
          </section>

          <WeekStrip
            days={weekSummaries}
            prevWeekHref={prevWeekHref}
            nextWeekHref={nextWeekHref}
            resetHref={resetHref}
            isCurrentWeek={isCurrentWeek}
          />
        </div>
      </div>

      <PlanStrip
        a={{ label: "WK", value: `${weekIndex}/${totalWeeks}` }}
        b={{ label: "RACE", value: shortRaceName(plan.race.name) }}
        c={{ label: "OUT", value: `${daysToRace}D`, accent: true }}
        regen={
          <RegenButton
            contextRows={regenContextRows}
            showSparseTip={regenSparseTip}
            isPending={false}
          />
        }
      />
      <TabBar active="today" />
    </div>
    </LoggedToastProvider>
  );
}
