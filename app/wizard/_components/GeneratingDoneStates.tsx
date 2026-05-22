"use client";

import { useRouter } from "next/navigation";
import { MotifTopo } from "@/app/_components/today/motifs";
import { VertLogo, ArrowRight } from "@/app/_components/today/icons";
import {
  PLAN_GEN_ERROR_COPY,
  type PlanGenErrorCode,
} from "@/lib/plan-gen-result";

const STATUS_LINES = [
  "Reading your inputs…",
  "Mapping your training block…",
  "Designing this week…",
  "Setting up your weekly rhythm…",
  "Almost there…",
];

// Atmospheric loader shown while submitWizard is running. Same shape as
// the regen-generating screen for visual continuity.
export function GeneratingState() {
  return (
    <div className="relative flex min-h-svh w-full flex-col overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="absolute inset-0">
        <MotifTopo color="#10b981" opacity={0.11} />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(250,250,250,0.9) 80%)",
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(9,9,11,0.9) 80%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="mb-7">
          <VertLogo size="lg" accent="#10b981" textColor="currentColor" />
        </div>
        <div
          className="font-mono text-[12px] font-semibold uppercase text-emerald-500"
          style={{ letterSpacing: "0.22em" }}
        >
          — BUILDING YOUR PLAN
        </div>
        <div className="relative mt-[18px] h-[22px] w-full max-w-[340px]">
          {STATUS_LINES.map((l, i) => (
            <div
              key={i}
              className="vert-fade-rotate absolute inset-0 flex items-center justify-center font-mono text-[13px] text-zinc-600 dark:text-zinc-400"
              style={{
                letterSpacing: "0.02em",
                animationDelay: `${i * 2}s`,
                animationDuration: "10s",
              }}
            >
              {l}
            </div>
          ))}
        </div>
        <div className="mt-8 flex gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="vert-pulse-dot inline-block h-2 w-2 rounded-full bg-emerald-500"
              style={{ animationDelay: `${i * 0.25}s` }}
            />
          ))}
        </div>
        <p
          className="absolute bottom-9 font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
          style={{ letterSpacing: "0.18em" }}
        >
          USUALLY 5–15 SECONDS
        </p>
      </div>
    </div>
  );
}

interface ErrorProps {
  code: PlanGenErrorCode;
  requestId?: string;
  onTryAgain: () => void;
  // Optional secondary action — surfaces an "Edit setup" link on the
  // wizard so the user can adjust inputs that affect plan size (e.g.
  // compress the date window) before retrying. Omit on surfaces where
  // there's nothing to edit.
  onEditSetup?: () => void;
}

// Branded error screen shown when wizard generation fails — Vercel
// timeout, validation exhaustion, Anthropic error, or unknown. Uses
// the same atmospheric topo+radial-fade frame as GeneratingState +
// DoneState so the transition feels like part of the same flow, not a
// dropped-into-a-generic-error-page jolt. Voice + copy come from
// PLAN_GEN_ERROR_COPY so the wizard + regen surfaces stay in sync.
export function GeneratingErrorState({
  code,
  requestId,
  onTryAgain,
  onEditSetup,
}: ErrorProps) {
  const copy = PLAN_GEN_ERROR_COPY[code];
  return (
    <div className="relative flex min-h-svh w-full flex-col overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="absolute inset-0">
        <MotifTopo color="#a1a1aa" opacity={0.13} />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(250,250,250,0.9) 80%)",
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(9,9,11,0.9) 80%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="mb-6">
          <VertLogo size="lg" accent="#a1a1aa" textColor="currentColor" />
        </div>
        <div
          className="font-mono text-[12px] font-semibold uppercase text-zinc-500"
          style={{ letterSpacing: "0.22em" }}
        >
          — {copy.eyebrow}
        </div>
        <h1
          className="m-0 mt-3.5 max-w-[360px] text-[26px] font-medium leading-tight text-zinc-950 dark:text-zinc-50"
          style={{ letterSpacing: "-0.02em" }}
        >
          {copy.title}
        </h1>
        <p className="m-0 mt-3 max-w-[360px] text-[14.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          {copy.body}
        </p>
        <div className="mt-7 flex w-full max-w-[340px] flex-col items-center gap-2.5">
          <button
            type="button"
            onClick={onTryAgain}
            className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400"
          >
            Try again
            <ArrowRight color="#052e1f" size={16} />
          </button>
          {onEditSetup && (
            <button
              type="button"
              onClick={onEditSetup}
              className="inline-flex h-11 items-center justify-center px-3 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
            >
              Edit setup
            </button>
          )}
        </div>
        {requestId && (
          <p
            className="mt-7 font-mono text-[10.5px] uppercase text-zinc-400 dark:text-zinc-600"
            style={{ letterSpacing: "0.18em" }}
          >
            ERROR · WIZARD · REQ #{requestId.toUpperCase()}
          </p>
        )}
      </div>
    </div>
  );
}

// Done state. Manual "See today's workout" CTA — deliberate pause so the
// user reads the confirmation before being dropped into the live plan.
export function DoneState() {
  const router = useRouter();
  return (
    <div className="relative flex min-h-svh w-full flex-col overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="absolute inset-0">
        <MotifTopo color="#10b981" opacity={0.09} />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(250,250,250,0.85) 80%)",
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(9,9,11,0.85) 80%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 py-10 text-center">
        <div
          className="mb-6 inline-flex h-[88px] w-[88px] items-center justify-center rounded-full border border-emerald-500 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/[0.08]"
          style={{ boxShadow: "0 12px 36px rgba(16,185,129,0.20)" }}
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5l4.5 4.5L19 7"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div
          className="font-mono text-[12px] font-semibold uppercase text-emerald-500"
          style={{ letterSpacing: "0.22em" }}
        >
          — PLAN READY
        </div>
        <h1
          className="m-0 mt-3.5 max-w-[320px] text-[32px] font-medium leading-[1.1] text-zinc-950 dark:text-zinc-50"
          style={{ letterSpacing: "-0.025em" }}
        >
          You&apos;re all set.
        </h1>
        <p className="m-0 mt-2.5 max-w-[320px] text-[14.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          Tap continue to see today&apos;s workout. Your plan adapts as you log
          workouts and add notes — visit Profile any time to add more detail.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-7 inline-flex h-11 w-full max-w-[340px] items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400"
        >
          See today&apos;s workout
          <ArrowRight color="#052e1f" size={16} />
        </button>
      </div>
    </div>
  );
}
