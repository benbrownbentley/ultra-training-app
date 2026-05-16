interface ElevationProfileProps {
  stroke?: string;
  fill?: string;
  height?: number;
  width?: number;
  className?: string;
}

const POINTS = [
  60, 55, 70, 65, 90, 110, 95, 80, 105, 130, 145, 130, 110, 140, 170, 155, 135,
  115, 95, 100, 80, 65, 70, 55, 40,
];

/**
 * Static elevation chart for the trail-panel foot. The shape is fixed so the
 * visual matches the design without any data dependency.
 */
export function ElevationProfile({
  stroke = "#34d399",
  fill = "rgba(52,211,153,0.16)",
  height = 70,
  width = 360,
  className,
}: ElevationProfileProps) {
  const W = width;
  const H = height;
  const n = POINTS.length - 1;

  let d = "";
  POINTS.forEach((p, i) => {
    const x = (i / n) * W;
    const y = H - p * (H / 200);
    d += (i === 0 ? "M" : " L") + ` ${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const fillD = `${d} L ${W} ${H} L 0 ${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
    >
      <path d={fillD} fill={fill} />
      <path
        d={d}
        stroke={stroke}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
