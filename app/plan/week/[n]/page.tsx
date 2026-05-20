import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAthleteProfile, getPlan } from "@/lib/supabase/server";
import { getTodayISO, formatWeekLabel } from "@/lib/utils";
import { buildPlanWeeks, phaseLabel } from "@/lib/plan-derive";
import type { Day } from "@/lib/plan";
import { formatDistance, formatElevation } from "@/lib/units";
import { TabBar } from "@/app/_components/today/TabBar";
import { WorkoutCard } from "@/app/_components/today/WorkoutCard";
import { MotifStretch } from "@/app/_components/today/motifs";

export const dynamic = "force-dynamic";

// Format a single day's date for the day-row eyebrow line: "MON 16 MAY".
function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    })
    .toUpperCase();
}

export default async function WeekDrilldownPage({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const { n } = await params;
  const weekN = Number(n);
  if (!Number.isFinite(weekN) || weekN < 1) notFound();

  const [plan, profile] = await Promise.all([getPlan(), getAthleteProfile()]);
  if (!plan || plan.days.length === 0) {
    redirect("/wizard");
  }
  const todayIso = getTodayISO();
  const weeks = buildPlanWeeks(plan, todayIso);
  const week = weeks.find((w) => w.weekNum === weekN);
  if (!week) notFound();
  const unitSystem = profile?.unit_system ?? "metric";

  const phaseSlotIdx = weeks
    .filter((w) => w.phase === week.phase)
    .findIndex((w) => w.weekNum === weekN);
  const phaseTotal = weeks.filter((w) => w.phase === week.phase).length;

  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3.5 sm:px-5 dark:border-zinc-800 dark:bg-zinc-950">
        <Link
          href="/plan"
          className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-medium uppercase text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          style={{ letterSpacing: "0.18em" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M14 6l-6 6 6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          PLAN
        </Link>
        <span aria-hidden="true" />
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        <div className="mx-auto flex w-full max-w-[720px] flex-col">
          <div className="px-4 pt-5 sm:px-5">
            <div
              className="font-mono text-[11px] font-semibold uppercase text-emerald-500"
              style={{ letterSpacing: "0.2em" }}
            >
              — WEEK {weekN} OF {weeks.length} · {phaseLabel(week.phase)}
            </div>
            <h1
              className="mt-2.5 text-[26px] font-medium leading-tight text-zinc-950 dark:text-zinc-50"
              style={{ letterSpacing: "-0.02em" }}
            >
              {formatWeekLabel(week.startIso)} — {formatWeekLabel(week.endIso)}
            </h1>
            <span
              className="mt-2 inline-block rounded border border-emerald-200 bg-emerald-50 px-2 py-[3px] font-mono text-[10px] font-semibold uppercase text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/[0.08] dark:text-emerald-400"
              style={{ letterSpacing: "0.18em" }}
            >
              {phaseLabel(week.phase)} PHASE · WEEK {phaseSlotIdx + 1} OF{" "}
              {phaseTotal}
            </span>
          </div>

          <div className="px-4 pt-4 pb-2 sm:px-5">
            <div className="flex gap-1.5">
              <SummaryTile
                label="VOL"
                value={formatDistance(week.stats.volKm, unitSystem)}
                primary
              />
              {week.stats.vertM > 0 && (
                <SummaryTile
                  label="VERT"
                  value={formatElevation(week.stats.vertM, unitSystem)}
                />
              )}
              <SummaryTile
                label="QUALITY"
                value={String(week.stats.qualityCount)}
              />
              <SummaryTile label="PHASE" value={phaseLabel(week.phase)} />
            </div>
          </div>

          <div className="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5">
            {week.days.map((day) => (
              <DayRow key={day.date} day={day} todayIso={todayIso} />
            ))}
          </div>
        </div>
      </div>

      <TabBar active="plan" />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  unit,
  primary,
}: {
  label: string;
  value: string;
  unit?: string;
  primary?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[3px] overflow-hidden rounded-[10px] border border-zinc-200 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-[#0f0f11]">
      <span
        className="font-mono text-[9px] uppercase text-zinc-400 dark:text-zinc-600"
        style={{ letterSpacing: "0.12em" }}
      >
        {label}
      </span>
      <span
        className={`overflow-hidden font-mono text-[15px] font-medium ${
          primary
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-zinc-950 dark:text-zinc-50"
        }`}
        style={{ letterSpacing: "-0.01em" }}
      >
        {value}
        {unit && (
          <span className="ml-1 font-mono text-[10px] text-zinc-500">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

function DayRow({ day, todayIso }: { day: Day; todayIso: string }) {
  const isToday = day.date === todayIso;
  const isRest = day.workouts.length === 0;
  const summary = isRest
    ? "Rest"
    : day.workouts.map((w) => w.title).join(" · ");

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span
          className={`font-mono text-[10.5px] font-semibold uppercase ${
            isToday ? "text-emerald-500" : "text-zinc-500"
          }`}
          style={{ letterSpacing: "0.2em" }}
        >
          — {formatDayLabel(day.date)}
          {isToday && " · TODAY"}
        </span>
        <span
          className="font-mono text-[10.5px] uppercase text-zinc-400 dark:text-zinc-600"
          style={{ letterSpacing: "0.05em" }}
        >
          {summary}
        </span>
      </div>
      {isRest ? (
        <RestRow />
      ) : (
        <div className="flex flex-col gap-2">
          {day.workouts.map((w) => (
            // Full Today-style card with motif + Log done / Skip / Edit log
            // buttons. Logging happens inline; tapping anywhere else routes
            // to /workout/[id] through the inner Link.
            <WorkoutCard key={w.id} workout={w} />
          ))}
        </div>
      )}
    </div>
  );
}

// Rest day chip — uses the brief's "Recovery is the work" copy and the
// flowing-line motif so it stays consistent with the Today rest card.
function RestRow() {
  return (
    <div className="relative overflow-hidden rounded-[12px] border border-zinc-200 bg-white px-4 py-3.5 dark:border-zinc-800 dark:bg-[#0f0f11]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-50"
      >
        <MotifStretch color="#10b981" opacity={0.1} />
      </div>
      <div className="relative">
        <div
          className="font-mono text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
          style={{ letterSpacing: "0.2em" }}
        >
          — REST
        </div>
        <div className="mt-1 text-[14.5px] font-medium leading-snug text-zinc-950 dark:text-zinc-50">
          Recovery is the work.{" "}
          <span className="text-zinc-600 dark:text-zinc-400">
            See you tomorrow.
          </span>
        </div>
      </div>
    </div>
  );
}
