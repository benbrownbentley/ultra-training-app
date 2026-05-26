import { redirect } from "next/navigation";
import { getAthleteProfile, getPlan } from "@/lib/supabase/server";
import { daysBetween, getTodayISO } from "@/lib/utils";
import { buildPlanWeeks } from "@/lib/plan-derive";
import { buildContextRows, buildRecentSkips } from "@/lib/regen-context";
import { PlanPageClient } from "@/app/_components/plan/PlanPageClient";

export const dynamic = "force-dynamic";
// RegeneratePlanRow on this page triggers previewPlan. Phase 2's
// structured output needs more wall-clock time than the default.
export const maxDuration = 300;

export default async function PlanPage() {
  const [plan, profile] = await Promise.all([getPlan(), getAthleteProfile()]);
  if (!plan || plan.days.length === 0) {
    redirect("/wizard");
  }
  const todayIso = getTodayISO();
  const weeks = buildPlanWeeks(plan, todayIso);
  const daysToRace = daysBetween(todayIso, plan.race.date);

  // currentWeek index: prefer a week that contains today, otherwise the
  // next future week, otherwise the last week (post-race).
  const todayWeek = weeks.find((w) => w.isCurrent);
  const nextWeek = weeks.find((w) => w.isFuture);
  const currentWeek = todayWeek?.weekNum ?? nextWeek?.weekNum ?? weeks.length;

  const regenContextRows = buildContextRows({ plan, profile, todayIso });
  const regenSparseTip = !regenContextRows.some((r) => r.label === "LAST 14");
  const regenRecentSkips = buildRecentSkips({ plan, todayIso });

  return (
    <PlanPageClient
      weeks={weeks}
      currentWeek={currentWeek}
      totalWeeks={weeks.length}
      daysToRace={daysToRace}
      todayIso={todayIso}
      raceName={plan.race.name}
      raceDateIso={plan.race.date}
      raceDistance={plan.race.distance}
      raceElevationGain={plan.race.elevation_gain ?? null}
      regenContextRows={regenContextRows}
      regenSparseTip={regenSparseTip}
      regenRecentSkips={regenRecentSkips}
      unitSystem={profile?.unit_system ?? "metric"}
    />
  );
}
