import { redirect } from "next/navigation";
import { getAthleteProfile, getPlan } from "@/lib/supabase/server";
import { addDays, daysBetween, getTodayISO, weekStart } from "@/lib/utils";
import { TodayPageClient } from "@/app/_components/today/TodayPageClient";
import { buildContextRows } from "@/lib/regen-context";
import type { Day } from "@/lib/plan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  searchParams: Promise<{ week?: string }>;
}) {
  const [plan, profile] = await Promise.all([getPlan(), getAthleteProfile()]);
  if (!plan || plan.days.length === 0) {
    redirect("/wizard");
  }

  const params = await searchParams;
  const todayIso = getTodayISO();
  const todayDay = plan.days.find((d) => d.date === todayIso) ?? null;
  const tomorrowDay =
    plan.days.find((d) => d.date === addDays(todayIso, 1)) ?? null;
  const daysToRace = daysBetween(todayIso, plan.race.date);

  // Week navigation — params.week is the ISO date of any day in the desired
  // week; we normalise to its Monday so links round-trip cleanly.
  const currentWeekStart = weekStart(todayIso);
  const selectedWeekStart =
    params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week)
      ? weekStart(params.week)
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

  // No logged_at exposed via getPlan() yet — passing an empty map is fine,
  // the card simply omits the "DONE · HH:MM" caption when the value is null.
  const loggedAtById: Record<number, string | null> = {};

  const regenContextRows = buildContextRows({ plan, profile, todayIso });
  // Sparse if we have no fresh adherence data to feed Claude — the sheet
  // then nudges the user to type notes so the regen has something new to
  // chew on.
  const regenSparseTip = !regenContextRows.some((r) => r.label === "LAST 14");

  return (
    <TodayPageClient
      plan={plan}
      todayIso={todayIso}
      today={todayDay}
      tomorrow={tomorrowDay}
      daysToRace={daysToRace}
      weekDays={weekDays}
      isCurrentWeek={isCurrentWeek}
      prevWeekHref={`/?week=${prevWeekStart}`}
      nextWeekHref={`/?week=${nextWeekStart}`}
      resetHref="/"
      todayLabel={formatTodayLabel(todayIso)}
      weekIndex={weekIndex}
      totalWeeks={totalWeeks}
      loggedAtById={loggedAtById}
      regenContextRows={regenContextRows}
      regenSparseTip={regenSparseTip}
    />
  );
}
