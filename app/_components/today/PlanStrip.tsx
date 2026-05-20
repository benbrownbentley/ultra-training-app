import { ReactNode } from "react";

interface CellProps {
  label: string;
  value: string;
  accent?: boolean;
}

function Cell({ label, value, accent }: CellProps) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className="whitespace-nowrap font-mono text-[9.5px] uppercase text-zinc-400 dark:text-zinc-600"
        style={{ letterSpacing: "0.18em" }}
      >
        {label}
      </span>
      <span
        className={`whitespace-nowrap font-mono text-[12px] font-medium ${
          accent
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-zinc-950 dark:text-zinc-50"
        }`}
        style={{ letterSpacing: "0.01em" }}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <span aria-hidden className="h-3.5 w-px bg-zinc-200 dark:bg-zinc-800" />
  );
}

// Slim stat strip above the tab bar. Stats are positional: a, b, c, then the
// REGEN slot is filled by the caller because it owns the regenerate transition.
export function PlanStrip({
  a,
  b,
  c,
  regen,
}: {
  a: CellProps;
  b: CellProps;
  c: CellProps;
  regen: ReactNode;
}) {
  return (
    <div className="flex h-9 items-center justify-between border-t border-b border-zinc-200 bg-zinc-50 px-4 sm:px-5 dark:border-zinc-800 dark:bg-zinc-950">
      <Cell {...a} />
      <Divider />
      <Cell {...b} />
      <Divider />
      <Cell {...c} />
      <Divider />
      {regen}
    </div>
  );
}
