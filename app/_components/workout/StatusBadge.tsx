type Tone = "success" | "warn" | "muted";

const PALETTE: Record<
  Tone,
  { fg: string; bg: string; border: string }
> = {
  success: {
    fg: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/[0.08]",
    border: "border-emerald-200 dark:border-emerald-500/40",
  },
  warn: {
    fg: "text-amber-600 dark:text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-500/[0.10]",
    border: "border-amber-200 dark:border-amber-500/40",
  },
  muted: {
    fg: "text-zinc-500",
    bg: "bg-transparent",
    border: "border-zinc-200 dark:border-zinc-800",
  },
};

export function StatusBadge({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) {
  const p = PALETTE[tone];
  return (
    <span
      className={`whitespace-nowrap rounded font-mono text-[10px] font-semibold uppercase ${p.fg} ${p.bg} ${p.border} border px-1.5 py-[3px]`}
      style={{ letterSpacing: "0.18em" }}
    >
      {children}
    </span>
  );
}
