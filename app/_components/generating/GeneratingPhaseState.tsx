"use client";

// Phase 2.5 progress UI. Polls getGenerationJobStatus every 2s, renders
// per-phase progress with three states per phase (queued / generating /
// done). Replaces the wizard's atmospheric `GeneratingState` + the
// regen sheet's button-spinner during the chunked-generation path.
// See CHUNKING_SPEC.md §3.8 and §9 for the design decisions.
//
// Outcome routing is owned by the caller — when the polled status
// flips to `complete`, the parent decides where to send the user
// (DoneState on wizard, /regen?preview=<id> on regen). When it flips
// to `failed`, the parent renders the friendly error UX.

import { useEffect, useState } from "react";
import { getGenerationJobStatus } from "@/app/actions";
import { MotifTopo } from "@/app/_components/today/motifs";
import { VertLogo } from "@/app/_components/today/icons";
import type {
  GenerationPhase,
  JobStatusSnapshot,
} from "@/lib/plan-generation-types";

interface Props {
  jobId: number;
  // Fired exactly once when the polled status first flips to
  // 'complete'. The caller routes to DoneState (wizard) or
  // /regen?preview=<id> (regen) based on the snapshot.
  onComplete: (snapshot: JobStatusSnapshot) => void;
  // Fired exactly once when polled status first flips to 'failed'
  // or 'cancelled'. The caller renders the branded error UX.
  onFailed: (snapshot: JobStatusSnapshot) => void;
  // Optional: override the poll cadence in milliseconds. Default 2s
  // matches the spec recommendation (fast enough that progress feels
  // live, slow enough that polling isn't a load concern).
  pollIntervalMs?: number;
}

// Per-phase status copy. Mirrors the methodology in the system prompt
// + Ben's "Building base / Building build / Building peak / Building
// taper" framing from the design session.
const PHASE_COPY: Record<
  GenerationPhase,
  { eyebrow: string; tagline: string }
> = {
  base: {
    eyebrow: "BASE PHASE",
    tagline: "Building the aerobic foundation.",
  },
  build: {
    eyebrow: "BUILD PHASE",
    tagline: "Adding race-specific intensity.",
  },
  peak: {
    eyebrow: "PEAK PHASE",
    tagline: "Sharpening the engine.",
  },
  taper: {
    eyebrow: "TAPER PHASE",
    tagline: "Locking in fitness, shedding fatigue.",
  },
};

export function GeneratingPhaseState({
  jobId,
  onComplete,
  onFailed,
  pollIntervalMs = 2000,
}: Props) {
  const [snapshot, setSnapshot] = useState<JobStatusSnapshot | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Poll the job status. Single interval driving both the snapshot
  // updates and the elapsed timer (the timer ticks every second
  // independently of the poll cadence).
  useEffect(() => {
    let cancelled = false;
    let terminalFired = false;
    const startedAt = Date.now();

    async function poll() {
      try {
        const next = await getGenerationJobStatus(jobId);
        if (cancelled) return;
        if (next) {
          setSnapshot(next);
          // Terminal-state routing — fire exactly once per mount.
          if (!terminalFired) {
            if (next.status === "complete") {
              terminalFired = true;
              onComplete(next);
            } else if (
              next.status === "failed" ||
              next.status === "cancelled"
            ) {
              terminalFired = true;
              onFailed(next);
            }
          }
        }
      } catch (e) {
        // Polling failure is non-fatal — the next tick will likely
        // succeed. Log so production-debugging has a breadcrumb.
        console.warn("[GeneratingPhaseState] poll failed:", e);
      }
    }

    poll();
    const pollHandle = window.setInterval(poll, pollIntervalMs);
    const tickHandle = window.setInterval(() => {
      if (cancelled) return;
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(pollHandle);
      window.clearInterval(tickHandle);
    };
  }, [jobId, onComplete, onFailed, pollIntervalMs]);

  // Render before the first poll lands — show the atmospheric loader
  // shell without phase detail. Same vibe as the legacy GeneratingState
  // so the user doesn't see a flash of empty content.
  const phases = snapshot?.metaPlan.phases ?? [];
  const completedSet = new Set(snapshot?.completedPhases ?? []);
  // The "active" phase is the first not-yet-completed one. Anything
  // after it stays dim.
  const activeIdx = phases.findIndex((p) => !completedSet.has(p.phase));

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
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 py-10">
        <div className="mb-7">
          <VertLogo size="lg" accent="#10b981" textColor="currentColor" />
        </div>
        <div
          className="font-mono text-[12px] font-semibold uppercase text-emerald-500"
          style={{ letterSpacing: "0.22em" }}
        >
          — BUILDING YOUR PLAN
        </div>

        {phases.length === 0 ? (
          // Pre-first-poll: show only the pulse dots so the screen
          // doesn't look blank.
          <div className="mt-8 flex gap-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="vert-pulse-dot inline-block h-2 w-2 rounded-full bg-emerald-500"
                style={{ animationDelay: `${i * 0.25}s` }}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 flex w-full max-w-[340px] flex-col gap-2">
            {phases.map((p, i) => {
              const isDone = completedSet.has(p.phase);
              const isActive = i === activeIdx;
              const copy = PHASE_COPY[p.phase];
              return (
                <PhaseLine
                  key={p.phase}
                  eyebrow={copy.eyebrow}
                  tagline={copy.tagline}
                  isDone={isDone}
                  isActive={isActive}
                />
              );
            })}
          </div>
        )}

        {/* Elapsed timer — honest signal without a hard expectation.
            Lives bottom-right so it doesn't compete visually with the
            phase column. */}
        <p
          className="absolute bottom-9 right-9 font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
          style={{ letterSpacing: "0.18em" }}
        >
          {formatElapsed(elapsedSec)}
        </p>
      </div>
    </div>
  );
}

interface LineProps {
  eyebrow: string;
  tagline: string;
  isDone: boolean;
  isActive: boolean;
}

function PhaseLine({ eyebrow, tagline, isDone, isActive }: LineProps) {
  // Three visual states:
  //   • done — emerald check + dim text
  //   • active — pulse dot + accent text
  //   • queued — dim everything
  const eyebrowTone = isDone
    ? "text-emerald-600 dark:text-emerald-400"
    : isActive
      ? "text-emerald-500"
      : "text-zinc-400 dark:text-zinc-600";
  const taglineTone = isDone
    ? "text-zinc-500 dark:text-zinc-500"
    : isActive
      ? "text-zinc-950 dark:text-zinc-50"
      : "text-zinc-400 dark:text-zinc-600";
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="mt-[3px] flex h-3.5 w-3.5 items-center justify-center">
        {isDone ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5l4.5 4.5L19 7"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : isActive ? (
          <span
            className="vert-pulse-dot inline-block h-2 w-2 rounded-full bg-emerald-500"
          />
        ) : (
          <span className="h-2 w-2 rounded-full border border-zinc-300 dark:border-zinc-700" />
        )}
      </div>
      <div className="flex-1 text-left">
        <div
          className={`font-mono text-[11px] font-semibold uppercase ${eyebrowTone}`}
          style={{ letterSpacing: "0.2em" }}
        >
          — {eyebrow}
        </div>
        <div
          className={`mt-0.5 font-mono text-[12px] ${taglineTone}`}
          style={{ letterSpacing: "0.02em" }}
        >
          {tagline}
        </div>
      </div>
    </div>
  );
}

/** Formats an elapsed-seconds counter as `M:SS` (e.g. `1:43`). */
function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
