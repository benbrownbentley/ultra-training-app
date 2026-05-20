import Link from "next/link";
import { MotifTopo } from "./motifs";
import { ArrowRight } from "./icons";

// First-run state. The home Server Component normally redirects to /wizard
// when no plan exists; this card exists for parity with the design and for
// any edge case where the page renders without a plan.
export function EmptyCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white px-6 pb-8 pt-10 dark:border-zinc-800 dark:bg-[#0f0f11]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)",
        }}
      >
        <MotifTopo color="#10b981" opacity={0.18} />
      </div>
      <div className="relative">
        <div
          className="mb-2.5 font-mono text-[11px] uppercase text-emerald-700 dark:text-emerald-400"
          style={{ letterSpacing: "0.2em" }}
        >
          — WELCOME
        </div>
        <div
          className="mb-2 text-[26px] font-medium leading-tight text-zinc-950 dark:text-zinc-50"
          style={{ letterSpacing: "-0.02em" }}
        >
          Tell us about your race.
        </div>
        <p className="mb-6 max-w-[320px] text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Pick your race, set the date, and we&apos;ll plan backward from the
          start line. You can edit anything later.
        </p>
        <Link
          href="/wizard"
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400"
        >
          Set up your training plan
          <ArrowRight color="#052e1f" size={16} />
        </Link>
      </div>
    </div>
  );
}
