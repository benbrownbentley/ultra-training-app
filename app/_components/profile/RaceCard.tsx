import Link from "next/link";
import type { Race, RacePriority } from "@/lib/plan";
import { daysBetween, getTodayISO } from "@/lib/utils";

interface Props {
  race: Race;
}

// Visual treatment per priority. A fills emerald; B outlines emerald;
// C and completed dim out so the cardinal-ordering reads at a glance.
const STYLE: Record<RacePriority, string> = {
  A: "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/[0.08]",
  B: "border-emerald-300 bg-transparent dark:border-emerald-500/40",
  C: "border-zinc-200 bg-transparent opacity-90 dark:border-zinc-800",
  completed:
    "border-zinc-200 bg-transparent opacity-55 dark:border-zinc-800",
};

const PRIORITY_LABEL: Record<RacePriority, string> = {
  A: "A · PRIMARY",
  B: "B · TUNE-UP",
  C: "C · TRAINING-GRADE",
  completed: "COMPLETED",
};

export function RaceCard({ race }: Props) {
  const priority = (race.priority ?? "A") as RacePriority;
  const today = getTodayISO();
  const days = race.date >= today ? daysBetween(today, race.date) : null;
  return (
    <Link
      href={`/profile/race/${race.id ?? ""}`}
      className={`block rounded-[12px] border px-4 py-3.5 transition ${STYLE[priority]}`}
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span
          className="whitespace-nowrap font-mono text-[10.5px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
          style={{ letterSpacing: "0.2em" }}
        >
          — {PRIORITY_LABEL[priority]}
        </span>
        {days != null && (
          <span
            className="font-mono text-[10.5px] uppercase text-zinc-500 dark:text-zinc-400"
            style={{ letterSpacing: "0.14em" }}
          >
            {days <= 14
              ? `${days} day${days === 1 ? "" : "s"}`
              : `${Math.round(days / 7)} wk · ${days} d`}
          </span>
        )}
      </div>
      <div
        className="text-[18px] font-medium leading-tight text-zinc-950 dark:text-zinc-50"
        style={{ letterSpacing: "-0.015em" }}
      >
        {race.name}
      </div>
      <div className="mt-1 font-mono text-[12.5px] text-zinc-600 dark:text-zinc-400">
        {formatRaceDate(race.date)} · {race.distance}
        {race.elevation_gain ? ` · +${race.elevation_gain} m` : ""}
        {race.terrain ? ` · ${race.terrain}` : ""}
      </div>
    </Link>
  );
}

function formatRaceDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
