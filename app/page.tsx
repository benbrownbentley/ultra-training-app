import type { Workout } from "@/lib/plan";
import { getPlan } from "@/lib/supabase";
import { WorkoutLogButtons } from "@/app/_components/WorkoutLogButtons";
import { RegeneratePlanButton } from "@/app/_components/RegeneratePlanButton";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
  }).format(new Date());
}

function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatLongDate(iso: string) {
  return parseISO(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function shortWeekday(iso: string) {
  return WEEKDAYS_SHORT[parseISO(iso).getUTCDay()];
}

function daysBetween(fromIso: string, toIso: string) {
  return Math.round(
    (parseISO(toIso).getTime() - parseISO(fromIso).getTime()) / 86_400_000,
  );
}

function weekStart(iso: string) {
  const d = parseISO(iso);
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number) {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function workoutIcon(kind: Workout["kind"]) {
  if (kind === "run") return "🏃";
  if (kind === "gym") return "🏋️";
  return "🧘";
}

export default async function Home() {
  const plan = await getPlan();
  const todayIso = getTodayISO();
  const today = plan.days.find((d) => d.date === todayIso);
  const daysToRace = daysBetween(todayIso, plan.race.date);

  const weekStartIso = weekStart(todayIso);
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    addDays(weekStartIso, i),
  );
  const daysByDate = new Map(plan.days.map((d) => [d.date, d]));
  const weekDays = weekDates.map(
    (date) => daysByDate.get(date) ?? { date, workouts: [] },
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8 sm:py-12">
      <header>
        <h1 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          Training
        </h1>
      </header>

      <section className="rounded-2xl bg-emerald-600 px-5 py-4 text-white shadow-sm dark:bg-emerald-500/90">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">
              Goal race
            </div>
            <div className="mt-1 text-lg font-semibold leading-tight">
              {plan.race.name}
            </div>
            <div className="text-sm opacity-90">
              {plan.race.distance} · {formatLongDate(plan.race.date)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold leading-none">{daysToRace}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">
              days to go
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
          Today
        </div>
        <div className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {today ? formatLongDate(today.date) : "—"}
        </div>

        {today ? (
          <ul className="mt-4 flex flex-col gap-3">
            {today.workouts.map((w) => (
              <li
                key={w.id}
                className={`flex items-center gap-3 rounded-xl bg-zinc-50 p-4 transition dark:bg-zinc-800/60 ${
                  w.status === "pending" ? "" : "opacity-60"
                }`}
              >
                <span className="text-2xl leading-none" aria-hidden>
                  {workoutIcon(w.kind)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-zinc-900 dark:text-zinc-50">
                    {w.title}
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    {w.details}
                  </div>
                </div>
                <WorkoutLogButtons id={w.id} status={w.status} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            No workout scheduled for today. Enjoy the rest.
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          This week
        </h2>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((day) => {
            const isToday = day.date === todayIso;
            const hasRun = day.workouts.some((w) => w.kind === "run");
            const hasGym = day.workouts.some((w) => w.kind === "gym");
            return (
              <div
                key={day.date}
                className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center ${
                  isToday
                    ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300"
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
                  {shortWeekday(day.date)}
                </div>
                <div className="text-lg font-semibold leading-none">
                  {day.date.slice(-2)}
                </div>
                <div className="mt-0.5 flex h-4 items-center gap-0.5 text-xs leading-none">
                  {hasRun && <span aria-hidden>🏃</span>}
                  {hasGym && <span aria-hidden>🏋️</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-2 flex justify-center">
        <RegeneratePlanButton />
      </div>

      <footer className="mt-auto pt-6 text-center text-[11px] text-zinc-400 dark:text-zinc-600">
        v1 · {plan.days.length} days loaded from Supabase
      </footer>
    </div>
  );
}
