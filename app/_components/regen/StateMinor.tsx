"use client";

import { Section } from "@/app/_components/workout/Section";
import { TabBar } from "@/app/_components/today/TabBar";
import { ArrowRight } from "@/app/_components/today/icons";
import type { WeekDiff } from "@/lib/preview";
import type { ContextRow } from "@/lib/regen-context";
import { RegenHeader } from "./RegenHeader";
import {
  BasedOnRow,
  ChangeBadge,
  StatusHeading,
  SummaryCard,
} from "./atoms";

interface Props {
  summary: string;
  changes: Array<{
    type: "shifted" | "reduced" | "added" | "removed";
    text: string;
  }>;
  changedWeeks: WeekDiff[];
  contextRows: ContextRow[];
  onAccept: () => void;
  onRegenerateAgain: () => void;
  onDiscard: () => void;
  onExpandDiff: () => void;
  isPending: boolean;
  pendingAction: "accept" | "discard" | "regenerate" | null;
}

// Calmer variant for diffs that barely move the plan. The detailed
// week-by-week diff is hidden behind an expand affordance so the page
// doesn't imply churn that didn't happen.
export function StateMinor({
  summary,
  changes,
  changedWeeks,
  contextRows,
  onAccept,
  onRegenerateAgain,
  onDiscard,
  onExpandDiff,
  isPending,
  pendingAction,
}: Props) {
  const totalChangedDays = changedWeeks.reduce(
    (acc, w) => acc + w.days.filter((d) => d.kind !== "unchanged").length,
    0,
  );

  return (
    <div className="flex min-h-svh w-full flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <RegenHeader />
      <div className="flex-1 overflow-y-auto pt-4">
        <div className="mx-auto flex w-full max-w-[640px] flex-col">
          <div className="px-4 pb-3.5 sm:px-5">
            <StatusHeading
              label="PLAN CONFIRMED · MINOR ADJUSTMENTS ONLY"
              accent
            />
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
            <button
              type="button"
              onClick={onExpandDiff}
              disabled={isPending}
              className="flex w-full items-center justify-between rounded-[10px] border border-dashed border-zinc-200 bg-transparent px-4 py-3.5 text-left text-[13px] font-medium text-zinc-950 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-50"
            >
              <span>
                View {totalChangedDays} small adjustment
                {totalChangedDays === 1 ? "" : "s"}
              </span>
              <span className="font-mono text-[11px] text-emerald-500">→</span>
            </button>
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

          <div className="h-2" />
        </div>
      </div>
      <div className="border-t border-zinc-200 bg-zinc-50 px-4 pt-3 pb-3.5 sm:px-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onAccept}
            disabled={isPending}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "accept" ? "Accepting…" : "Accept new plan"}
            {pendingAction !== "accept" && <ArrowRight color="#052e1f" size={16} />}
          </button>
          <button
            type="button"
            onClick={onRegenerateAgain}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-[10px] border border-zinc-200 px-4 text-sm font-medium text-zinc-950 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-50"
          >
            {pendingAction === "regenerate" ? "Working…" : "Regenerate again"}
          </button>
        </div>
        <div className="mt-2.5 flex justify-end">
          <button
            type="button"
            onClick={onDiscard}
            disabled={isPending}
            className="bg-transparent text-[12.5px] font-medium text-zinc-400 hover:text-zinc-600 disabled:opacity-50 dark:text-zinc-600 dark:hover:text-zinc-400"
          >
            {pendingAction === "discard" ? "Discarding…" : "Keep current plan"}
          </button>
        </div>
      </div>
      <TabBar active="plan" />
    </div>
  );
}
