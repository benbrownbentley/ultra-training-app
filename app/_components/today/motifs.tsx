// Line-art SVG motifs used as low-opacity card backgrounds, one per workout
// primary type. Abstract enough not to claim to be data, recognizable enough
// to read at a glance.

import type { WorkoutKind } from "@/lib/plan";

type MotifProps = { color?: string; opacity?: number };

const containerStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

export function MotifTopo({ color = "#10b981", opacity = 0.16 }: MotifProps) {
  const lines: React.ReactElement[] = [];
  for (let i = 0; i < 8; i++) {
    const y = 14 + i * 16;
    const amp = 10 + (i % 3) * 4;
    const wl = 50 + (i % 4) * 8;
    let d = `M -10 ${y}`;
    for (let x = 0; x <= 320; x += 4) {
      const yy =
        y +
        Math.sin((x + i * 30) / wl) * amp +
        Math.sin((x + i * 15) / (wl * 2.3)) * amp * 0.3;
      d += ` L ${x} ${yy.toFixed(1)}`;
    }
    lines.push(
      <path
        key={i}
        d={d}
        stroke={color}
        strokeWidth={i % 4 === 0 ? 1.2 : 0.6}
        opacity={opacity}
        fill="none"
      />,
    );
  }
  return (
    <svg
      viewBox="0 0 320 160"
      preserveAspectRatio="xMaxYMid slice"
      style={containerStyle}
    >
      {lines}
    </svg>
  );
}

export function MotifBarbell({ color = "#10b981", opacity = 0.18 }: MotifProps) {
  return (
    <svg
      viewBox="0 0 320 160"
      preserveAspectRatio="xMaxYMid slice"
      style={containerStyle}
    >
      <g stroke={color} fill="none" opacity={opacity}>
        <line x1="30" y1="80" x2="290" y2="80" strokeWidth="1.6" />
        <circle cx="70" cy="80" r="24" strokeWidth="1.4" />
        <circle cx="70" cy="80" r="18" strokeWidth="0.8" />
        <circle cx="48" cy="80" r="16" strokeWidth="1.2" />
        <circle cx="48" cy="80" r="11" strokeWidth="0.7" />
        <circle cx="250" cy="80" r="24" strokeWidth="1.4" />
        <circle cx="250" cy="80" r="18" strokeWidth="0.8" />
        <circle cx="272" cy="80" r="16" strokeWidth="1.2" />
        <circle cx="272" cy="80" r="11" strokeWidth="0.7" />
        <line x1="92" y1="68" x2="92" y2="92" strokeWidth="1.2" />
        <line x1="228" y1="68" x2="228" y2="92" strokeWidth="1.2" />
      </g>
    </svg>
  );
}

export function MotifStretch({ color = "#10b981", opacity = 0.2 }: MotifProps) {
  return (
    <svg
      viewBox="0 0 320 160"
      preserveAspectRatio="xMaxYMid slice"
      style={containerStyle}
    >
      <g stroke={color} fill="none" opacity={opacity}>
        {[0, 12, 26, 42, 60, 80].map((off, i) => (
          <path
            key={i}
            d={`M -10 ${130 - off} C 80 ${110 - off * 0.7}, 200 ${
              70 - off * 0.6
            }, 340 ${20 - off * 0.4}`}
            strokeWidth={i === 2 ? 1.4 : 0.8}
          />
        ))}
        <circle cx="30" cy="124" r="2.5" fill={color} />
        <circle cx="290" cy="34" r="2.5" fill={color} />
      </g>
    </svg>
  );
}

// Maps the app's WorkoutKind values onto the design's motif family.
// gym → barbell ("strength"), mobility → flowing arcs, run → topographic.
export const MOTIFS: Record<WorkoutKind, (p: MotifProps) => React.ReactElement> = {
  run: MotifTopo,
  gym: MotifBarbell,
  mobility: MotifStretch,
};
