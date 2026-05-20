import type { WorkoutKind } from "@/lib/plan";
import { MOTIFS } from "@/app/_components/today/motifs";
import { StatusBadge } from "./StatusBadge";

type BadgeTone = "success" | "warn" | "muted";

interface Props {
  kind: WorkoutKind;
  eyebrow: string;
  title: string;
  description?: string;
  badge?: { tone: BadgeTone; label: string };
}

// Page-spanning title section. Motif fades from the right edge, matching the
// scale used on the Today card so visual continuity is preserved when you
// tap a card into this detail view.
export function TitleBlock({ kind, eyebrow, title, description, badge }: Props) {
  const Motif = MOTIFS[kind];
  return (
    <div className="relative overflow-hidden px-4 pb-6 pt-5 sm:px-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-[70%]"
        style={{
          maskImage: "linear-gradient(to left, black 25%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to left, black 25%, transparent 100%)",
        }}
      >
        <Motif color="#10b981" opacity={0.18} />
      </div>
      <div className="relative">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span
            className="whitespace-nowrap font-mono text-[10.5px] uppercase text-zinc-500"
            style={{ letterSpacing: "0.2em" }}
          >
            — {eyebrow}
          </span>
          {badge && <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
        </div>
        <h1
          className="m-0 text-[28px] font-medium leading-[1.1] text-zinc-950 sm:text-[30px] dark:text-zinc-50"
          style={{ letterSpacing: "-0.02em" }}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-[380px] text-[14.5px] leading-snug text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
