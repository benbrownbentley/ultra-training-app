import { MotifTopo } from "@/app/_components/today/motifs";
import { formatLongDateWithYear } from "@/lib/utils";

interface Props {
  raceName: string;
  raceDateIso: string;
  distance: string;
  elevationGainM?: number | null;
  daysToRace: number;
}

// Big emerald slab marking the race itself. Shown inside the race-week
// view and at the very end of the plan list when the race is imminent.
export function RaceTile({
  raceName,
  raceDateIso,
  distance,
  elevationGainM,
  daysToRace,
}: Props) {
  const imminent = daysToRace >= 0 && daysToRace <= 7;
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-emerald-500 px-5 pb-6 pt-5 text-emerald-950"
      style={{ boxShadow: "0 12px 36px rgba(16,185,129,0.30)" }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-55">
        <MotifTopo color="#052e1f" opacity={0.18} />
      </div>
      <div className="relative">
        <span
          className="font-mono text-[10.5px] font-bold uppercase text-emerald-950"
          style={{ letterSpacing: "0.24em" }}
        >
          — RACE DAY
          {imminent && daysToRace >= 0
            ? ` · STARTS IN ${daysToRace} DAY${daysToRace === 1 ? "" : "S"}`
            : ""}
        </span>
        <h2
          className="mt-2 mb-1.5 text-[34px] font-medium leading-none text-emerald-950"
          style={{ letterSpacing: "-0.025em" }}
        >
          {raceName}
        </h2>
        <p
          className="font-mono text-[12.5px] font-medium text-emerald-950/80"
          style={{ letterSpacing: "0.02em" }}
        >
          {formatLongDateWithYear(raceDateIso).toUpperCase()} · {distance}
          {elevationGainM != null && ` · +${elevationGainM} m`}
        </p>
      </div>
    </div>
  );
}
