type Tone = "warn" | "muted" | "success";

const STYLE: Record<
  Tone,
  { container: string; label: string }
> = {
  warn: {
    container:
      "border-amber-200 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/[0.10]",
    label: "text-amber-600 dark:text-amber-500",
  },
  muted: {
    container:
      "border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/40",
    label: "text-zinc-500 dark:text-zinc-400",
  },
  success: {
    container:
      "border-emerald-200 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/[0.08]",
    label: "text-emerald-700 dark:text-emerald-400",
  },
};

export function Banner({
  tone = "muted",
  label,
  body,
}: {
  tone?: Tone;
  label: string;
  body?: React.ReactNode;
}) {
  const s = STYLE[tone];
  return (
    <div
      className={`mx-4 mt-2 flex flex-col gap-1 rounded-[10px] border px-3.5 py-2.5 sm:mx-5 ${s.container}`}
    >
      <span
        className={`font-mono text-[10px] font-semibold uppercase ${s.label}`}
        style={{ letterSpacing: "0.2em" }}
      >
        — {label}
      </span>
      {body && (
        <span className="text-[13px] leading-snug text-zinc-950 dark:text-zinc-50">
          {body}
        </span>
      )}
    </div>
  );
}
