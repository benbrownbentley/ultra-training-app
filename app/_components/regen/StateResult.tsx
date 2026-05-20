import { Section } from "@/app/_components/workout/Section";
import { TabBar } from "@/app/_components/today/TabBar";
import { RegenHeader } from "./RegenHeader";
import {
  BasedOnRow,
  ChangeBadge,
  DayDiffRow,
  StatusHeading,
  SummaryCard,
  WeekSectionHeader,
} from "./atoms";
import { RegenActionBar } from "./RegenActionBar";
import {
  BASED_ON_ROWS,
  SUMMARY_RESULT,
  WEEK_6,
  WEEK_7,
  type WeekDiff,
} from "./placeholders";

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

export function StateResult() {
  return (
    <div className="flex min-h-svh w-full flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <RegenHeader />
      <div className="flex-1 overflow-y-auto pt-4">
        <div className="mx-auto flex w-full max-w-[640px] flex-col">
          <div className="px-4 pb-3.5 sm:px-5">
            <StatusHeading label="PLAN UPDATED · JUST NOW" accent />
          </div>

          <div className="px-4 pb-3.5 sm:px-5">
            <SummaryCard>{SUMMARY_RESULT}</SummaryCard>
          </div>

          <div className="flex flex-wrap gap-2 px-4 pb-4 sm:px-5">
            <ChangeBadge kind="shifted" label="SHIFTED" body="Sat long → Thu" />
            <ChangeBadge kind="reduced" label="REDUCED" body="weekly volume −8%" />
            <ChangeBadge kind="added" label="ADDED" body="2× calf strength" />
          </div>

          <Section
            label="WEEK BY WEEK"
            right={
              <span
                className="font-mono text-[10px] uppercase text-zinc-500"
                style={{ letterSpacing: "0.16em" }}
              >
                VIEW ALL 18 →
              </span>
            }
          >
            <Week week={WEEK_6} />
            <Week week={WEEK_7} />
            <p
              className="mt-2 font-mono text-[11px] uppercase text-zinc-400 dark:text-zinc-600"
              style={{ letterSpacing: "0.14em" }}
            >
              WEEKS 8–18 UNCHANGED
            </p>
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
