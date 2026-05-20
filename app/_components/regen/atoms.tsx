// Atoms shared across the 5 regen states. Kept in a single file because
// each piece is small and the call sites all live in app/regen/.

import { MotifTopo } from "@/app/_components/today/motifs";
import type { ChangeType } from "@/lib/preview";

// Big mono status line at the top of generating / result / accepted screens.
export function StatusHeading({
  label,
  accent,
}: {
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`whitespace-nowrap text-center font-mono text-[12px] font-semibold uppercase ${
        accent ? "text-emerald-500" : "text-zinc-500"
      }`}
      style={{ letterSpacing: "0.2em" }}
    >
      — {label}
    </div>
  );
}

// "From your coach" copy card with the topo motif fading from the right.
export function SummaryCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-zinc-200 bg-white px-[18px] py-5 dark:border-zinc-800 dark:bg-[#0f0f11]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-[55%]"
        style={{
          maskImage: "linear-gradient(to left, black 25%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to left, black 25%, transparent 100%)",
        }}
      >
        <MotifTopo color="#10b981" opacity={0.14} />
      </div>
      <div className="relative">
        <span
          className="font-mono text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
          style={{ letterSpacing: "0.2em" }}
        >
          — FROM YOUR COACH
        </span>
        <p
          className="mt-2.5 text-[16px] font-normal leading-relaxed text-zinc-950 dark:text-zinc-50"
          style={{ letterSpacing: "-0.005em" }}
        >
          {children}
        </p>
      </div>
    </div>
  );
}

const BADGE_STYLE: Record<ChangeType, { container: string; label: string }> = {
  shifted: {
    container:
      "border-emerald-200 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/[0.08]",
    label: "text-emerald-700 dark:text-emerald-400",
  },
  reduced: {
    container:
      "border-amber-200 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/[0.10]",
    label: "text-amber-600 dark:text-amber-500",
  },
  added: {
    container:
      "border-emerald-500 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/[0.08]",
    label: "text-emerald-500",
  },
  removed: {
    container: "border-zinc-200 bg-transparent dark:border-zinc-800",
    label: "text-zinc-500",
  },
};

// Pill summarising one category of change in the diff.
export function ChangeBadge({
  kind,
  label,
  body,
}: {
  kind: ChangeType;
  label: string;
  body: string;
}) {
  const s = BADGE_STYLE[kind];
  return (
    <div
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 ${s.container}`}
    >
      <span
        className={`font-mono text-[9.5px] font-semibold uppercase ${s.label}`}
        style={{ letterSpacing: "0.18em" }}
      >
        {label}
      </span>
      <span className="font-mono text-[11.5px] text-zinc-950 dark:text-zinc-50">
        {body}
      </span>
    </div>
  );
}

type DiffKind = "unchanged" | "changed" | "added" | "removed";

const CHIP_STYLE: Record<DiffKind, string> = {
  unchanged: "",
  added: "border-emerald-500 text-emerald-500",
  changed:
    "border-emerald-200 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400",
  removed: "border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600",
};

function DiffChip({ kind, label }: { kind: DiffKind; label: string }) {
  if (kind === "unchanged") return null;
  return (
    <span
      className={`whitespace-nowrap rounded border px-1.5 py-[2px] font-mono text-[9px] font-semibold uppercase ${CHIP_STYLE[kind]}`}
      style={{ letterSpacing: "0.18em" }}
    >
      {label}
    </span>
  );
}

export interface DayDiff {
  day: string;
  kind: DiffKind;
  title: string;
  primary?: string;
  was?: string;
}

// One day in a week's diff. Day initial highlights emerald when there's a
// change; removed rows strike through and dim.
export function DayDiffRow({ day, kind, title, primary, was }: DayDiff) {
  const dayColor =
    kind === "unchanged"
      ? "text-zinc-400 dark:text-zinc-600"
      : kind === "removed"
        ? "text-zinc-400 dark:text-zinc-600"
        : "text-emerald-500";
  const titleColor =
    kind === "removed"
      ? "text-zinc-400 dark:text-zinc-600"
      : "text-zinc-950 dark:text-zinc-50";
  const titleDeco = kind === "removed" ? "line-through" : "no-underline";
  return (
    <div className="grid grid-cols-[32px_1fr_auto] items-center gap-2.5 border-t border-zinc-200 py-2 dark:border-zinc-800">
      <span
        className={`font-mono text-[10.5px] font-semibold uppercase ${dayColor}`}
        style={{ letterSpacing: "0.14em" }}
      >
        {day}
      </span>
      <div className="flex min-w-0 flex-wrap items-baseline gap-2">
        <span
          className={`text-[13.5px] font-medium ${titleColor} ${titleDeco}`}
        >
          {title}
        </span>
        {primary && (
          <span
            className={`font-mono text-[11.5px] ${
              kind === "removed"
                ? "text-zinc-400 dark:text-zinc-600"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {primary}
          </span>
        )}
        {was && (
          <span
            className="font-mono text-[10.5px] text-zinc-500"
            style={{ letterSpacing: "0.04em" }}
          >
            was {was}
          </span>
        )}
      </div>
      <DiffChip
        kind={kind}
        label={
          kind === "added"
            ? "+ NEW"
            : kind === "changed"
              ? "CHANGED"
              : kind === "removed"
                ? "REMOVED"
                : ""
        }
      />
    </div>
  );
}

export function WeekSectionHeader({
  label,
  sub,
  right,
}: {
  label: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-3">
      <div className="flex items-baseline gap-2.5">
        <span
          className="font-mono text-[10.5px] font-semibold uppercase text-zinc-500"
          style={{ letterSpacing: "0.2em" }}
        >
          — {label}
        </span>
        {sub && (
          <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-600">
            {sub}
          </span>
        )}
      </div>
      {right}
    </div>
  );
}

// One row in the "based on" inputs list.
export function BasedOnRow({
  label,
  value,
  glyph = "›",
}: {
  label: string;
  value: string;
  glyph?: string;
}) {
  return (
    <div className="grid grid-cols-[14px_auto_1fr] gap-2 border-t border-zinc-200 py-2 dark:border-zinc-800">
      <span className="font-mono text-[13px] text-emerald-500">{glyph}</span>
      <span
        className="whitespace-nowrap pt-[2px] font-mono text-[10px] font-semibold uppercase text-zinc-500"
        style={{ letterSpacing: "0.18em" }}
      >
        {label}
      </span>
      <span className="font-mono text-[12px] leading-snug text-zinc-950 dark:text-zinc-50">
        {value}
      </span>
    </div>
  );
}
