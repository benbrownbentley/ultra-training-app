import type { PlanWeek } from "@/lib/plan-derive";

interface Props {
  weeks: PlanWeek[];
  currentWeek: number;
  width?: number;
  height?: number;
}

// Volume + vert curve across the whole block. Phase tints sit behind as
// faint bands; the emerald marker pins the current week. Sized fluid via
// viewBox so the same SVG renders cleanly at mobile and desktop widths.
export function VolumeSparkline({
  weeks,
  currentWeek,
  width = 354,
  height = 100,
}: Props) {
  if (weeks.length === 0) return null;
  const padL = 24;
  const padR = 8;
  const padT = 14;
  const padB = 18;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const n = weeks.length;

  const vols = weeks.map((w) => w.stats.volKm);
  const verts = weeks.map((w) => w.stats.vertM);
  const maxVol = Math.max(1, ...vols);
  const maxVert = Math.max(1, ...verts);

  const xAt = (i: number) =>
    n === 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW;
  const yVol = (v: number) => padT + innerH - (v / maxVol) * innerH;
  const yVert = (v: number) => padT + innerH - (v / maxVert) * innerH;

  // Phase bands — contiguous runs of equal phase
  const bands: { phase: string; x: number; w: number }[] = [];
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && weeks[j].phase === weeks[i].phase) j++;
    const x1 = padL + ((i - 0.5) / Math.max(1, n - 1)) * innerW;
    const x2 = padL + ((j - 1 + 0.5) / Math.max(1, n - 1)) * innerW;
    bands.push({
      phase: weeks[i].phase,
      x: Math.max(padL, x1),
      w: Math.min(padL + innerW, x2) - Math.max(padL, x1),
    });
    i = j;
  }

  const phaseTint = (phase: string): string => {
    switch (phase) {
      case "build":
        return "rgba(16,185,129,0.10)";
      case "peak":
        return "rgba(16,185,129,0.18)";
      case "taper":
        return "rgba(110,231,183,0.18)";
      default:
        return "rgba(0,0,0,0)";
    }
  };

  const volPath = weeks
    .map(
      (w, idx) =>
        `${idx === 0 ? "M" : " L"} ${xAt(idx).toFixed(1)} ${yVol(w.stats.volKm).toFixed(1)}`,
    )
    .join("");
  const vertPath = weeks
    .map(
      (w, idx) =>
        `${idx === 0 ? "M" : " L"} ${xAt(idx).toFixed(1)} ${yVert(w.stats.vertM).toFixed(1)}`,
    )
    .join("");
  const volFillPath = `${volPath} L ${xAt(n - 1).toFixed(1)} ${padT + innerH} L ${xAt(0).toFixed(1)} ${padT + innerH} Z`;

  const curIdx = Math.max(0, Math.min(n - 1, currentWeek - 1));
  const curX = xAt(curIdx);
  const curY = yVol(weeks[curIdx].stats.volKm);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block" }}>
      {bands.map((b, idx) => (
        <rect
          key={idx}
          x={b.x}
          y={padT - 2}
          width={b.w}
          height={innerH + 4}
          fill={phaseTint(b.phase)}
        />
      ))}
      <path d={volFillPath} fill="rgba(16,185,129,0.10)" />
      <path
        d={volPath}
        stroke="#10b981"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={vertPath}
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2 3"
        opacity={0.4}
      />
      <line
        x1={curX}
        y1={padT - 2}
        x2={curX}
        y2={padT + innerH + 2}
        stroke="#10b981"
        strokeWidth="1.5"
      />
      <circle
        cx={curX}
        cy={curY}
        r="3.5"
        fill="currentColor"
        stroke="#10b981"
        strokeWidth="2"
        className="text-zinc-50 dark:text-zinc-950"
      />
      <text
        x={padL - 6}
        y={yVol(maxVol)}
        textAnchor="end"
        dominantBaseline="middle"
        fontFamily="'Geist Mono', monospace"
        fontSize="9"
        fill="currentColor"
        opacity={0.45}
        letterSpacing="0.05em"
      >
        {maxVol}
      </text>
      <text
        x={padL - 6}
        y={padT + innerH}
        textAnchor="end"
        dominantBaseline="middle"
        fontFamily="'Geist Mono', monospace"
        fontSize="9"
        fill="currentColor"
        opacity={0.45}
      >
        0
      </text>
      <text
        x={xAt(0)}
        y={height - 4}
        textAnchor="start"
        fontFamily="'Geist Mono', monospace"
        fontSize="9"
        fill="currentColor"
        opacity={0.45}
        letterSpacing="0.1em"
      >
        W1
      </text>
      <text
        x={xAt(n - 1)}
        y={height - 4}
        textAnchor="end"
        fontFamily="'Geist Mono', monospace"
        fontSize="9"
        fill="currentColor"
        opacity={0.45}
        letterSpacing="0.1em"
      >
        W{n} · RACE
      </text>
      <text
        x={curX}
        y={height - 4}
        textAnchor="middle"
        fontFamily="'Geist Mono', monospace"
        fontSize="9"
        fill="#10b981"
        fontWeight="600"
        letterSpacing="0.1em"
      >
        YOU · W{currentWeek}
      </text>
    </svg>
  );
}

export function SparklineCard({
  weeks,
  currentWeek,
}: {
  weeks: PlanWeek[];
  currentWeek: number;
}) {
  return (
    <div className="rounded-[14px] border border-zinc-200 bg-white px-3.5 pb-1.5 pt-3.5 text-zinc-950 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span
          className="font-mono text-[10px] uppercase text-zinc-500"
          style={{ letterSpacing: "0.2em" }}
        >
          — VOLUME ARC
        </span>
        <div className="flex gap-3">
          <span
            className="font-mono text-[10px] text-zinc-500"
            style={{ letterSpacing: "0.05em" }}
          >
            <span className="mr-1.5 inline-block h-[2px] w-2 bg-emerald-500 align-middle" />
            VOL km
          </span>
          <span
            className="font-mono text-[10px] text-zinc-500"
            style={{ letterSpacing: "0.05em" }}
          >
            <span className="mr-1.5 inline-block w-2 border-t border-dashed border-zinc-400 align-middle" />
            VERT m
          </span>
        </div>
      </div>
      <VolumeSparkline weeks={weeks} currentWeek={currentWeek} />
    </div>
  );
}
