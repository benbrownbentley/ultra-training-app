import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkoutById } from "@/lib/supabase/server";
import { WorkoutLogButtons } from "@/app/_components/WorkoutLogButtons";

export const dynamic = "force-dynamic";

function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatLongDate(iso: string) {
  return parseISO(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function workoutIcon(kind: string) {
  if (kind === "run") return "🏃";
  if (kind === "gym") return "🏋️";
  return "🧘";
}

function statusLabel(status: string) {
  if (status === "completed") return "✓ Completed";
  if (status === "skipped") return "⏭ Skipped";
  return "Pending";
}

export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const workout = await getWorkoutById(numericId);
  if (!workout) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8 sm:py-12">
      <header>
        <Link
          href="/"
          className="text-xs font-medium text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          ← Back to today
        </Link>
      </header>

      <section className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start gap-4">
          <span className="text-4xl leading-none" aria-hidden>
            {workoutIcon(workout.kind)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
              {workout.kind}
            </div>
            <h1 className="mt-1 text-2xl font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
              {workout.title}
            </h1>
            <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {formatLongDate(workout.date)}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-zinc-50 p-4 text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200">
          {workout.details}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Status
            </div>
            <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {statusLabel(workout.status)}
            </div>
            {workout.logged_at && (
              <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Logged{" "}
                {new Date(workout.logged_at).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            )}
          </div>
          <WorkoutLogButtons id={workout.id} status={workout.status} />
        </div>
      </section>
    </div>
  );
}
