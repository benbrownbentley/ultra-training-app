// Builds the "context Claude already has" row list shown in the regenerate
// sheet. Each row is a single fact pulled from the existing data model;
// rows are omitted when their source is empty so we don't ever render an
// empty-looking row.

import type { AthleteProfile, Plan } from "@/lib/plan";
import { addDays, daysBetween } from "@/lib/utils";

export interface ContextRow {
  label: string;
  value: string;
}

interface BuildArgs {
  plan: Plan;
  profile: AthleteProfile | null;
  todayIso: string;
}

function pluralise(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function buildContextRows({
  plan,
  profile,
  todayIso,
}: BuildArgs): ContextRow[] {
  const rows: ContextRow[] = [];

  // INJURY — surfaces athlete-reported issues so the user knows Claude
  // already factors them in.
  if (profile?.injury_notes) {
    rows.push({ label: "INJURY", value: profile.injury_notes });
  }

  // OTHER — life context (travel, work, family) the wizard captured.
  if (profile?.other_commitments) {
    rows.push({ label: "CONTEXT", value: profile.other_commitments });
  }

  // LAST 14 — adherence summary across the most recent 14 days. Window is
  // exclusive of today; the future doesn't tell us anything about how the
  // last block actually landed.
  const windowStart = addDays(todayIso, -14);
  const recentWorkouts = plan.days
    .filter((d) => d.date >= windowStart && d.date < todayIso)
    .flatMap((d) => d.workouts);
  if (recentWorkouts.length > 0) {
    const completed = recentWorkouts.filter((w) => w.status === "completed").length;
    const skipped = recentWorkouts.filter((w) => w.status === "skipped").length;
    const pending = recentWorkouts.filter((w) => w.status === "pending").length;
    const parts = [
      `${completed} done`,
      skipped > 0 ? `${skipped} skipped` : null,
      pending > 0 ? `${pending} unlogged` : null,
    ].filter(Boolean);
    rows.push({ label: "LAST 14", value: parts.join(" · ") });
  }

  // TARGET — always present so the user can see the race assumption.
  const daysToRace = daysBetween(todayIso, plan.race.date);
  const targetParts: string[] = [plan.race.name];
  if (daysToRace > 14) {
    targetParts.push(`${Math.round(daysToRace / 7)} weeks out`);
  } else if (daysToRace >= 0) {
    targetParts.push(pluralise(daysToRace, "day") + " to go");
  }
  rows.push({ label: "TARGET", value: targetParts.join(" · ") });

  return rows;
}
