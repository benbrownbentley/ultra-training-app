import { redirect } from "next/navigation";
import {
  getAthleteProfile,
  getPlan,
  getPreviewById,
  getLatestPendingPreview,
} from "@/lib/supabase/server";
import { daysBetween, getTodayISO, weekStart } from "@/lib/utils";
import { addDays } from "@/lib/utils";
import {
  computePlanDiff,
  isMinorChange,
  summariseDiff,
  type GenerationSummary,
  type PreviewRow,
} from "@/lib/preview";
import { buildContextRows } from "@/lib/regen-context";
import { RegenPageClient } from "@/app/_components/regen/RegenPageClient";

export const dynamic = "force-dynamic";

// /regen renders the preview-then-accept screen. Reads a specific preview
// when ?preview=<id> is supplied, otherwise falls back to the user's
// latest pending preview. Sends users home if there's nothing pending.
export default async function RegenPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview: previewParam } = await searchParams;

  let preview: PreviewRow | null = null;
  if (previewParam && /^\d+$/.test(previewParam)) {
    preview = await getPreviewById(Number(previewParam));
  }
  if (!preview) {
    preview = await getLatestPendingPreview();
  }
  if (!preview || preview.status !== "pending") {
    redirect("/");
  }

  const [plan, profile] = await Promise.all([
    getPlan(),
    getAthleteProfile(),
  ]);
  if (!plan) {
    // No current plan to diff against — treat as initial generation,
    // which the wizard already covers. Bounce home.
    redirect("/");
  }

  const todayIso = getTodayISO();
  const futureDays = plan.days.filter((d) => d.date >= todayIso);

  // Total weeks for the per-week label headers. Use the plan's window so
  // labels match what the rest of the app shows.
  const planStartIso = plan.days[0]?.date ?? todayIso;
  const totalWeeks = Math.max(
    1,
    Math.ceil(daysBetween(weekStart(planStartIso), addDays(plan.race.date, 6)) / 7),
  );

  const weeks = computePlanDiff({
    currentDays: futureDays,
    previewWorkouts: preview.workouts,
    ctx: {
      raceDate: plan.race.date,
      racePriority: (plan.race.priority ?? null) as
        | import("@/lib/plan").RacePriority
        | null,
      todayIso,
      totalWeeks,
    },
  });

  const { changedWeeks, unchangedTrailing } = summariseDiff(weeks);
  const minor = isMinorChange(weeks);

  const summary: GenerationSummary = preview.generation_summary ?? {
    summary:
      "I updated your plan based on the latest context. Tap a week to see what changed.",
    changes: [],
  };

  const contextRows = buildContextRows({ plan, profile, todayIso });
  const regenSparseTip = !contextRows.some((r) => r.label === "LAST 14");

  return (
    <RegenPageClient
      previewId={preview.id}
      isMinor={minor}
      summary={summary}
      changedWeeks={changedWeeks}
      unchangedTrailing={unchangedTrailing}
      contextRows={contextRows}
      regenSparseTip={regenSparseTip}
    />
  );
}
