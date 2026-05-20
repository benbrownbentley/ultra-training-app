import Link from "next/link";
import { MotifTopo } from "@/app/_components/today/motifs";
import { ArrowRight } from "@/app/_components/today/icons";
import { TabBar } from "@/app/_components/today/TabBar";
import { RegenHeader } from "./RegenHeader";
import { StatusHeading } from "./atoms";

// Apologetic error state. Sleepy crescent moon (the same glyph rest days
// use) reinforces "our servers are taking a break", not "something is
// burning". The user's existing plan is unchanged.
export function StateError({ requestId = "2A8F" }: { requestId?: string }) {
  return (
    <div className="relative flex min-h-svh w-full flex-col overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-65 dark:opacity-55"
      >
        <MotifTopo color="#a1a1aa" opacity={0.14} />
      </div>

      <RegenHeader />

      <div className="relative mx-auto flex w-full max-w-[480px] flex-1 flex-col items-start justify-center px-6 py-10">
        <div className="relative mb-6 inline-flex h-[76px] w-[76px] items-center justify-center rounded-full border border-zinc-200 bg-transparent dark:border-zinc-800">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 14a8 8 0 11-9.5-9.5A6.5 6.5 0 0020 14z"
              stroke="rgb(113 113 122)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="absolute -top-2 -right-1.5 font-mono text-[11px] font-semibold text-zinc-500"
            style={{ letterSpacing: "0.05em" }}
          >
            z<sup className="ml-px text-[8px]">z</sup>
          </span>
        </div>

        <StatusHeading label="REGENERATION · REST DAY" />

        <h2
          className="mt-3.5 max-w-[360px] text-[26px] font-medium leading-tight text-zinc-950 dark:text-zinc-50"
          style={{ letterSpacing: "-0.02em" }}
        >
          Looks like our servers are having a rest day.
        </h2>
        <p className="mt-3 max-w-[360px] text-[14.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          Your plan is safe and unchanged. Give us a minute — we&apos;ll be
          back at it shortly.
        </p>

        <div className="mt-7 flex w-full items-center gap-2.5">
          <Link
            href="/regen?state=generating"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400"
          >
            Try again
            <ArrowRight color="#052e1f" size={16} />
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center px-3 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            Back to Today
          </Link>
        </div>

        <p
          className="mt-7 font-mono text-[10.5px] uppercase text-zinc-400 dark:text-zinc-600"
          style={{ letterSpacing: "0.18em" }}
        >
          ERROR · NETWORK · REQ #{requestId}
        </p>
      </div>

      <TabBar active="plan" />
    </div>
  );
}
