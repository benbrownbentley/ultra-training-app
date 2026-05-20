// Horizontal rule with a centered phase label — sits between two
// consecutive week sections when the phase changes.
export function PhaseDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      <span
        className="font-mono text-[10px] font-semibold uppercase text-emerald-500"
        style={{ letterSpacing: "0.22em" }}
      >
        — {label}
      </span>
      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
