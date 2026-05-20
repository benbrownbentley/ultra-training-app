import type { MetricTile as MetricTileShape } from "./extract-metrics";

function MetricTile({ label, value, unit, primary }: MetricTileShape) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[3px] overflow-hidden rounded-[10px] border border-zinc-200 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-[#0f0f11]">
      <span
        className="overflow-hidden font-mono text-[9px] uppercase text-zinc-400 dark:text-zinc-600"
        style={{ letterSpacing: "0.12em" }}
      >
        {label}
      </span>
      <span
        className={`overflow-hidden font-mono text-[14px] font-medium ${
          primary
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-zinc-950 dark:text-zinc-50"
        }`}
        style={{ letterSpacing: "-0.01em" }}
      >
        {value}
        {unit && (
          <span className="ml-1 font-mono text-[10px] text-zinc-500">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

export function MetricsRow({ items }: { items: MetricTileShape[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex gap-1.5 px-4 sm:px-5">
      {items.map((m, i) => (
        <MetricTile key={i} {...m} />
      ))}
    </div>
  );
}
