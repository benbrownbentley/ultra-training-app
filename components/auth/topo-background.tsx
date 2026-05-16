interface TopoBackgroundProps {
  color?: string;
  opacity?: number;
  dense?: boolean;
}

/**
 * Decorative topographic ridges rendered as deterministic sine waves.
 * Used as the soft background art on the trail panel.
 */
export function TopoBackground({
  color = "#10b981",
  opacity = 0.22,
  dense = true,
}: TopoBackgroundProps) {
  const count = dense ? 14 : 10;
  const lines: string[] = [];

  for (let i = 0; i < count; i++) {
    const y = 30 + i * 22;
    const amp = 18 + (i % 3) * 6;
    const wl = 80 + (i % 4) * 12;
    let d = `M -20 ${y}`;
    for (let x = 0; x <= 820; x += 4) {
      const yy =
        y +
        Math.sin((x + i * 30) / wl) * amp +
        Math.sin((x + i * 15) / (wl * 2.3)) * amp * 0.35;
      d += ` L ${x} ${yy.toFixed(1)}`;
    }
    lines.push(d);
  }

  return (
    <svg
      viewBox="0 0 800 360"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    >
      {lines.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke={color}
          strokeWidth={i % 4 === 0 ? 1.2 : 0.6}
          opacity={opacity}
          fill="none"
        />
      ))}
    </svg>
  );
}
