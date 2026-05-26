"use client";

import { Section } from "@/app/_components/workout/Section";
import { TabBar } from "@/app/_components/today/TabBar";
import { ArrowRight } from "@/app/_components/today/icons";
import type { ChangeType, WeekDiff } from "@/lib/preview";
import type { ContextRow } from "@/lib/regen-context";
import { RegenHeader } from "./RegenHeader";
import {
  BasedOnRow,
  ChangeBadge,
  DayDiffRow,
  StatusHeading,
  SummaryCard,
  WeekSectionHeader,
} from "./atoms";

interface Props {
  summary: string;
  changes: Array<{
    type: ChangeType;
    text: string;
  }>;
  changedWeeks: WeekDiff[];
  unchangedTrailing: number;
  contextRows: ContextRow[];
  onAccept: () => void;
  onRegenerateAgain: () => void;
  onDiscard: () => void;
  isPending: boolean;
  pendingAction: "accept" | "discard" | "regenerate" | null;
}

function Week({ week }: { week: WeekDiff }) {
  return (
    <div className="mb-3.5">
      <WeekSectionHeader label={week.label} sub={week.sub} />
      <div>
        {week.days.map((d, i) => (
          <DayDiffRow key={i} {...d} />
        ))}
        <div className="border-t border-zinc-200 dark:border-zinc-800" />
      </div>
    </div>
  );
}

export function StateResult({
  summary,
  changes,
  changedWeeks,
  unchangedTrailing,
  contextRows,
  onAccept,
  onRegenerateAgain,
  onDiscard,
  isPending,
  pendingAction,
}: Props) {
  return (
    <div className="flex min-h-svh w-full flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <RegenHeader />
      <div className="flex-1 overflow-y-auto pt-4">
        <div className="mx-auto flex w-full max-w-[640px] flex-col">
          <div className="px-4 pb-3.5 sm:px-5">
            <StatusHeading label="PLAN UPDATED · JUST NOW" accent />
          </div>

          <div className="px-4 pb-3.5 sm:px-5">
            <SummaryCard>{summary}</SummaryCard>
          </div>

          {changes.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pb-4 sm:px-5">
              {changes.map((c, i) => (
                <ChangeBadge
                  key={i}
                  kind={c.type}
                  label={c.type.toUpperCase()}
                  body={c.text}
                />
              ))}
            </div>
          )}

          <Section label="WEEK BY WEEK">
            {changedWeeks.length === 0 ? (
              <p
                className="m-0 font-mono text-[11px] uppercase text-zinc-400 dark:text-zinc-600"
                style={{ letterSpacing: "0.14em" }}
              >
                NO PER-WEEK CHANGES
              </p>
            ) : (
              changedWeeks.map((week, i) => <Week key={i} week={week} />)
            )}
            {unchangedTrailing > 0 && (
              <p
                className="mt-2 font-mono text-[11px] uppercase text-zinc-400 dark:text-zinc-600"
                style={{ letterSpacing: "0.14em" }}
              >
                +{unchangedTrailing} WEEK{unchangedTrailing === 1 ? "" : "S"} UNCHANGED
              </p>
            )}
          </Section>

          {contextRows.length > 0 && (
            <Section label="BASED ON">
              <div>
                {contextRows.map((r) => (
                  <BasedOnRow key={r.label} label={r.label} value={r.value} />
                ))}
                <div className="border-t border-zinc-200 dark:border-zinc-800" />
              </div>
            </Section>
          )}

          {/* Bottom padding so the last diff row clears the sticky
              action bar that overlays this scroll region. */}
          <div className="h-20" />
        </div>
      </div>
      <ActionBar
        onAccept={onAccept}
        onRegenerateAgain={onRegenerateAgain}
        onDiscard={onDiscard}
        isPending={isPending}
        pendingAction={pendingAction}
      />
      <TabBar active="plan" />
    </div>
  );
}

function ActionBar({
  onAccept,
  onRegenerateAgain,
  onDiscard,
  isPending,
  pendingAction,
}: {
  onAccept: () => void;
  onRegenerateAgain: () => void;
  onDiscard: () => void;
  isPending: boolean;
  pendingAction: "accept" | "discard" | "regenerate" | null;
}) {
  // Sticky to the viewport bottom so long diffs can scroll without
  // burying the actions. Soft upward shadow visually separates it
  // from scrolled content; safe-area-aware bottom padding lifts the
  // controls above the iOS home indicator. Keep + Regen + Accept
  // share one row (Keep on the left as a ghost link, Accept the
  // primary fill on the right) so the hierarchy reads at a glance.
  return (
    <div className="sticky bottom-0 z-20 border-t border-zinc-200 bg-zinc-50 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),18px)] shadow-[0_-12px_24px_rgba(0,0,0,0.08)] sm:px-5 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_-12px_24px_rgba(0,0,0,0.45)]">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onDiscard}
          disabled={isPending}
          className="bg-transparent text-[12.5px] font-medium text-zinc-400 hover:text-zinc-600 disabled:opacity-50 dark:text-zinc-600 dark:hover:text-zinc-400"
        >
          {pendingAction === "discard" ? "Discarding…" : "Keep current plan"}
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onRegenerateAgain}
          disabled={isPending}
          className="inline-flex h-11 items-center justify-center rounded-[10px] border border-zinc-200 px-4 text-sm font-medium text-zinc-950 transition hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-700"
        >
          {pendingAction === "regenerate" ? "Working…" : "Regenerate again"}
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={isPending}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingAction === "accept" ? "Accepting…" : "Accept new plan"}
          {pendingAction !== "accept" && <ArrowRight color="#052e1f" size={16} />}
        </button>
      </div>
    </div>
  );
}
