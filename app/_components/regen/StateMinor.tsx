import { Section } from "@/app/_components/workout/Section";
import { TabBar } from "@/app/_components/today/TabBar";
import { RegenHeader } from "./RegenHeader";
import {
  BasedOnRow,
  ChangeBadge,
  StatusHeading,
  SummaryCard,
} from "./atoms";
import { RegenActionBar } from "./RegenActionBar";
import { BASED_ON_ROWS, SUMMARY_MINOR } from "./placeholders";

// Reassurance state — the AI has only nudged things. Diff is collapsed
// behind a "View N small adjustments" affordance so the screen doesn't
// imply churn that didn't happen.
export function StateMinor() {
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
            <SummaryCard>{SUMMARY_MINOR}</SummaryCard>
          </div>

          <div className="flex flex-wrap gap-2 px-4 pb-4 sm:px-5">
            <ChangeBadge
              kind="shifted"
              label="SHIFTED"
              body="Wed strength → Thu"
            />
            <ChangeBadge
              kind="shifted"
              label="SHIFTED"
              body="Sat strength → Sun"
            />
          </div>

          <Section label="WEEK BY WEEK">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-[10px] border border-dashed border-zinc-200 bg-transparent px-4 py-3.5 text-left text-[13px] font-medium text-zinc-950 dark:border-zinc-800 dark:text-zinc-50"
            >
              <span>View 3 small adjustments</span>
              <span className="font-mono text-[11px] text-emerald-500">→</span>
            </button>
          </Section>

          <Section label="BASED ON">
            <div>
              {BASED_ON_ROWS.map((r) => (
                <BasedOnRow key={r.label} label={r.label} value={r.value} />
              ))}
              <div className="border-t border-zinc-200 dark:border-zinc-800" />
            </div>
          </Section>

          <div className="h-2" />
        </div>
      </div>
      <RegenActionBar />
      <TabBar active="plan" />
    </div>
  );
}
