import { notFound } from "next/navigation";
import { getWorkoutById } from "@/lib/supabase/server";
import { getTodayISO } from "@/lib/utils";
import { DetailHeader } from "@/app/_components/workout/DetailHeader";
import { TitleBlock } from "@/app/_components/workout/TitleBlock";
import { MetricsRow } from "@/app/_components/workout/MetricsRow";
import { Section } from "@/app/_components/workout/Section";
import { Banner } from "@/app/_components/workout/Banner";
import { WorkoutActions } from "@/app/_components/workout/WorkoutActions";
import { TabBar } from "@/app/_components/today/TabBar";
import {
  extractMetrics,
  kindEyebrow,
} from "@/app/_components/workout/extract-metrics";

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

  const eyebrow = `${formatEyebrowDate(workout.date)} · ${kindEyebrow(workout.kind, workout.title)}`;
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
            badge={badge}
          />

          {metrics.length > 0 && <MetricsRow items={metrics} />}

          <Section label="PRESCRIPTION">
            <p className="text-[14.5px] leading-relaxed text-zinc-950 dark:text-zinc-50">
              {workout.details}
            </p>
          </Section>

          <Section
            label={isFuture ? "LOG · AVAILABLE ON THE DAY" : "LOG"}
            right={
              variant === "logged" && workout.logged_at ? (
                <span
                  className="font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
                  style={{ letterSpacing: "0.18em" }}
                >
                  {formatLoggedAtFull(workout.logged_at)}
                </span>
              ) : undefined
            }
          >
            <LogSummary
              status={workout.status}
              loggedAt={workout.logged_at}
              isFuture={isFuture}
            />
          </Section>
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

function formatLoggedAtFull(iso: string): string {
  return new Date(iso)
    .toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    })
    .toUpperCase();
}

// Free-text logging isn't in v1; this read-only summary stands in for the
// design's per-field log inputs until the data model grows them.
function LogSummary({
  status,
  loggedAt,
  isFuture,
}: {
  status: "pending" | "completed" | "skipped";
  loggedAt: string | null;
  isFuture: boolean;
}) {
  if (isFuture) {
    return (
      <div className="rounded-[10px] border border-dashed border-zinc-200 bg-transparent px-3.5 py-3 text-[13px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        Detailed log fields unlock on{" "}
        <span className="text-zinc-950 dark:text-zinc-50">the day of the workout</span>.
      </div>
    );
  }
  if (status === "completed") {
    return (
      <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[13px] leading-snug text-zinc-950 dark:border-emerald-500/40 dark:bg-emerald-500/[0.08] dark:text-zinc-50">
        <span
          className="mr-2 font-mono text-[10px] uppercase text-emerald-700 dark:text-emerald-400"
          style={{ letterSpacing: "0.2em" }}
        >
          — DONE
        </span>
        {loggedAt
          ? `Marked complete · ${new Date(loggedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
          : "Marked complete."}
      </div>
    );
  }
  if (status === "skipped") {
    return (
      <div className="rounded-[10px] border border-zinc-200 bg-zinc-100 px-3.5 py-3 text-[13px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
        Marked skipped. Tap{" "}
        <span className="text-zinc-950 dark:text-zinc-50">Log retrospectively</span> below to
        flip this to done.
      </div>
    );
  }
  return (
    <div className="rounded-[10px] border border-dashed border-zinc-200 bg-transparent px-3.5 py-3 text-[13px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
      Use the action bar below to mark this workout done or skipped.
      Detailed per-zone, per-set fields ship in a later update.
    </div>
  );
}
