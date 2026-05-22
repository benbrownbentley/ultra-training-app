import { redirect } from "next/navigation";
import {
  getAthleteProfile,
  getPlan,
  getPreviewById,
} from "@/lib/supabase/server";
import { addDays, daysBetween, getTodayISO, weekStart } from "@/lib/utils";
import {
  computePlanDiff,
  isMinorChange,
  summariseDiff,
  type GenerationSummary,
} from "@/lib/preview";
import { buildContextRows } from "@/lib/regen-context";
import { RegenPageClient } from "@/app/_components/regen/RegenPageClient";
import { RegenErrorPage } from "@/app/_components/regen/RegenErrorPage";
import type { PlanGenErrorCode } from "@/lib/plan-gen-result";

export const dynamic = "force-dynamic";
// "Regenerate again" calls previewPlan from this page. Phase 2's
// structured output is token-heavy; bump beyond the default so a full
// ultra plan finishes inside the Vercel function window.
export const maxDuration = 300;

const KNOWN_ERROR_CODES: PlanGenErrorCode[] = [
  "generation_timeout",
  "validation_failed",
  "anthropic_error",
  "unknown",
];

// /regen renders the preview-then-accept screen. The URL is the source of
// truth: ?preview=<id> identifies which pending preview to show; or
// ?error=<code> renders the branded retry state when previewPlan
// failed. Missing or invalid → bounce home (the user almost certainly
// arrived by mistake or from a stale link).
export default async function RegenPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string; error?: string; req?: string }>;
}) {
  const {
    preview: previewParam,
    error: errorParam,
    req: reqParam,
  } = await searchParams;

  // Generation-failure branch. Falls back to the `unknown` code if a
  // stray query param doesn't match the typed set — keeps the page
  // robust against link tampering.
  if (errorParam) {
    const code = (KNOWN_ERROR_CODES.find((c) => c === errorParam) ??
      "unknown") as PlanGenErrorCode;
    return <RegenErrorPage code={code} requestId={reqParam} />;
  }

  if (!previewParam || !/^\d+$/.test(previewParam)) {
    redirect("/");
  }
  const preview = await getPreviewById(Number(previewParam));
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
      previousNotes={preview.notes ?? ""}
    />
  );
}
