import { redirect } from "next/navigation";
import { getAthleteProfile, getPlan } from "@/lib/supabase/server";
import { addDays, daysBetween, getTodayISO, weekStart } from "@/lib/utils";
import { TodayPageClient } from "@/app/_components/today/TodayPageClient";
import { buildContextRows, buildRecentSkips } from "@/lib/regen-context";
import type { Day } from "@/lib/plan";

export const dynamic = "force-dynamic";
// Server actions invoked from this page (notably previewPlan) call
// Claude with a structured tool schema that emits ~150-250 workouts
// each with a per-workout `why` (Phase 2). Output token count is high
// enough that 60s isn't always sufficient. 300 is the Vercel Pro max.
export const maxDuration = 300;

// Short weekday + day-of-month in the style the design uses ("TUE 17 MAY").
function formatTodayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date
    .toLocaleDateString("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    })
    .toUpperCase();
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; day?: string }>;
}) {
  const [plan, profile] = await Promise.all([getPlan(), getAthleteProfile()]);
  if (!plan || plan.days.length === 0) {
    redirect("/wizard");
  }

  const params = await searchParams;
  const todayIso = getTodayISO();
  // ?day= lets the WeekStrip pills swap the TODAY section to a different day
  // without losing the rest of the page chrome. Falls back to actual today.
  const selectedDayIso =
    params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day)
      ? params.day
      : todayIso;
  const selectedDay =
    plan.days.find((d) => d.date === selectedDayIso) ?? null;
  const selectedTomorrow =
    plan.days.find((d) => d.date === addDays(selectedDayIso, 1)) ?? null;
  const daysToRace = daysBetween(todayIso, plan.race.date);
  const isViewingToday = selectedDayIso === todayIso;

  // Week navigation — params.week is the ISO date of any day in the desired
  // week; we normalise to its Monday so links round-trip cleanly. When the
  // user is viewing a specific day, prefer that day's week.
  const currentWeekStart = weekStart(todayIso);
  const selectedWeekStart =
    params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week)
      ? weekStart(params.week)
      : params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day)
        ? weekStart(params.day)
        : currentWeekStart;
  const isCurrentWeek = selectedWeekStart === currentWeekStart;
  const prevWeekStart = addDays(selectedWeekStart, -7);
  const nextWeekStart = addDays(selectedWeekStart, 7);

  const weekDates = Array.from({ length: 7 }, (_, i) =>
    addDays(selectedWeekStart, i),
  );
  const daysByDate = new Map(plan.days.map((d) => [d.date, d]));
  const weekDays: Day[] = weekDates.map(
    (date) => daysByDate.get(date) ?? { date, workouts: [] },
  );

  // Plan-strip "WK X / Y" comes from the first plan day (treated as
  // plan start) and the race date. Guards against the edge case where
  // today falls outside the planned span.
  const planStartIso = plan.days[0].date;
  const planStart = planStartIso < todayIso ? planStartIso : todayIso;
  const totalWeeks = Math.max(
    1,
    Math.ceil(daysBetween(planStart, plan.race.date) / 7),
  );
  const weekIndex = Math.min(
    totalWeeks,
    Math.max(1, Math.floor(daysBetween(planStart, todayIso) / 7) + 1),
  );

  // Map workout id → logged_at ISO so cards can render the
  // "DONE · HH:MM" caption when the user has logged the session.
  const loggedAtById: Record<number, string | null> = Object.fromEntries(
    plan.days.flatMap((d) =>
      d.workouts
        .filter((w) => w.logged_at)
        .map((w) => [w.id, w.logged_at] as const),
    ),
  );

  const regenContextRows = buildContextRows({ plan, profile, todayIso });
  // Sparse if we have no fresh adherence data to feed Claude — the sheet
  // then nudges the user to type notes so the regen has something new to
  // chew on.
  const regenSparseTip = !regenContextRows.some((r) => r.label === "LAST 14");
  // Skipped + missed workouts in the last 14 days — drives the
  // regen-sheet's RECENT SKIPS hint with a pre-filled note flow.
  const regenRecentSkips = buildRecentSkips({ plan, todayIso });

  return (
    <TodayPageClient
      plan={plan}
      todayIso={todayIso}
      selectedDayIso={selectedDayIso}
      today={selectedDay}
      tomorrow={selectedTomorrow}
      daysToRace={daysToRace}
      weekDays={weekDays}
      isCurrentWeek={isCurrentWeek}
      prevWeekHref={`/?week=${prevWeekStart}`}
      nextWeekHref={`/?week=${nextWeekStart}`}
      resetHref="/"
      todayLabel={formatTodayLabel(selectedDayIso)}
      isViewingToday={isViewingToday}
      weekIndex={weekIndex}
      totalWeeks={totalWeeks}
      loggedAtById={loggedAtById}
      regenContextRows={regenContextRows}
      regenSparseTip={regenSparseTip}
      regenRecentSkips={regenRecentSkips}
    />
  );
}
