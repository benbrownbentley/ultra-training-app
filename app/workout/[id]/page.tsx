import { notFound } from "next/navigation";
import { getWorkoutById } from "@/lib/supabase/server";
import { getTodayISO } from "@/lib/utils";
import { DetailHeader } from "@/app/_components/workout/DetailHeader";
import { TitleBlock } from "@/app/_components/workout/TitleBlock";
import { MetricsRow } from "@/app/_components/workout/MetricsRow";
import { Section } from "@/app/_components/workout/Section";
import { Banner } from "@/app/_components/workout/Banner";
import { WorkoutActions } from "@/app/_components/workout/WorkoutActions";
import { ActualsForm } from "@/app/_components/workout/ActualsForm";
import { TabBar } from "@/app/_components/today/TabBar";
import { extractMetrics } from "@/app/_components/workout/extract-metrics";
import { deriveWorkoutContent } from "@/lib/workout-content";

export const dynamic = "force-dynamic";

// Formats a workout's date for the eyebrow line: "WED 18 MAY".
function formatEyebrowDate(iso: string): string {
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

type Variant = "upcoming" | "logged" | "skipped" | "missed" | "future";

interface BadgeAndBanner {
  variant: Variant;
  badge?: { tone: "success" | "warn" | "muted"; label: string };
  banner?: { tone: "warn" | "muted" | "success"; label: string; body?: React.ReactNode };
}

// Derives the displayed state from raw status + relative date. Centralised
// so the title badge, top banner, and bottom-bar actions all read from the
// same source of truth.
function classify(
  status: "pending" | "completed" | "skipped",
  dateIso: string,
  todayIso: string,
): BadgeAndBanner {
  if (status === "completed") {
    return { variant: "logged", badge: { tone: "success", label: "LOGGED" } };
  }
  if (status === "skipped") {
    return {
      variant: "skipped",
      badge: { tone: "muted", label: "SKIPPED" },
      banner: {
        tone: "muted",
        label: "SKIPPED",
        body: "You can still log this retrospectively — it'll be folded into the next plan update.",
      },
    };
  }
  if (dateIso < todayIso) {
    return {
      variant: "missed",
      badge: { tone: "warn", label: "MISSED" },
      banner: {
        tone: "warn",
        label: "MISSED · YOU CAN STILL LOG THIS",
        body: "Logged retrospective sessions are still fed into your next plan update.",
      },
    };
  }
  if (dateIso > todayIso) {
    return {
      variant: "future",
      badge: { tone: "muted", label: "UPCOMING" },
      banner: {
        tone: "muted",
        label: "UPCOMING",
        body: "Log fields open up on the day of the workout.",
      },
    };
  }
  return { variant: "upcoming" };
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

  const todayIso = getTodayISO();
  const { variant, badge, banner } = classify(workout.status, workout.date, todayIso);

  const content = deriveWorkoutContent(workout.kind, workout.title, workout.details);
  const eyebrow = `${formatEyebrowDate(workout.date)} · ${content.subLabel}`;
  const metrics = extractMetrics(workout.details, workout.kind);
  const isFuture = variant === "future";

  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <DetailHeader backHref="/" />

      <div className="flex flex-1 flex-col overflow-y-auto pb-4">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-2">
          {banner && (
            <Banner tone={banner.tone} label={banner.label} body={banner.body} />
          )}

          <TitleBlock
            kind={workout.kind}
            eyebrow={eyebrow}
            title={workout.title}
            description={content.description}
            badge={badge}
          />

          {metrics.length > 0 && <MetricsRow items={metrics} />}

          <Section label="PRESCRIPTION">
            <p className="text-[14.5px] leading-relaxed text-zinc-950 dark:text-zinc-50">
              {workout.details}
            </p>
          </Section>

          <ActualsForm
            workoutId={workout.id}
            kind={workout.kind}
            content={content}
            variant={variant}
            status={workout.status}
            loggedAt={workout.logged_at}
            isFuture={isFuture}
            initial={{
              duration_min: workout.actual_duration_min,
              distance_km: workout.actual_distance_km,
              elevation_gain_m: workout.actual_elevation_gain_m,
              hr_avg: workout.actual_hr_avg,
              rpe: workout.actual_rpe,
              notes: workout.actual_notes ?? "",
              detail: workout.actual_detail,
            }}
          />
        </div>
      </div>

      <WorkoutActions
        id={workout.id}
        variant={variant}
        loggedAt={workout.logged_at}
      />
      <TabBar active="today" />
    </div>
  );
}
