"use client";

// Phase 2.5.1 progress UI. **Drives** the per-phase advance loop
// client-side via sequential `advanceJob` calls — the server actions
// stayed synchronous in Phase 2.5 which meant `previewPlan` /
// `submitWizard` blocked for the full ~4 minutes and this component
// never got a jobId to render against. Now the server returns after
// the fast meta-plan kickoff (~15s); this component takes the jobId
// and runs the loop, re-rendering progress between each phase call.
//
// Outcome routing is owned by the caller — when the loop completes,
// the parent decides where to send the user (DoneState on wizard,
// /regen?preview=<id> on regen). On failure, the parent renders the
// branded error UX.

import { useEffect, useRef, useState } from "react";
import {
  advanceJob,
  getGenerationJobStatus,
} from "@/app/actions";
import { MotifTopo } from "@/app/_components/today/motifs";
import { VertLogo } from "@/app/_components/today/icons";
import type {
  GenerationPhase,
  JobStatusSnapshot,
} from "@/lib/plan-generation-types";

interface Props {
  jobId: number;
  // Fired exactly once when the loop completes successfully. Caller
  // routes based on the snapshot — DoneState (wizard, previewId=null)
  // or /regen?preview=<id> (regen, previewId set).
  onComplete: (snapshot: JobStatusSnapshot) => void;
  // Fired exactly once when a phase fails. Caller renders the
  // branded error UX with a Resume CTA that re-enters this loop.
  onFailed: (snapshot: JobStatusSnapshot) => void;
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
}: Props) {
  const [snapshot, setSnapshot] = useState<JobStatusSnapshot | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  // Terminal handlers are stored in a ref so the advance loop's
  // effect doesn't re-fire when the parent passes new function
  // identities. The component fires each handler at most once per
  // mount (terminalFired flag in the effect).
  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    onFailedRef.current = onFailed;
  }, [onFailed]);

  // The advance loop. Drives one phase per iteration; exits when
  // status flips to "complete" or "failed" or the component unmounts.
  // Sequential — each advanceJob awaits the previous one.
  useEffect(() => {
    let cancelled = false;
    let terminalFired = false;
    const startedAt = Date.now();

    const fireComplete = (s: JobStatusSnapshot) => {
      if (terminalFired || cancelled) return;
      terminalFired = true;
      onCompleteRef.current(s);
    };
    const fireFailed = (s: JobStatusSnapshot) => {
      if (terminalFired || cancelled) return;
      terminalFired = true;
      onFailedRef.current(s);
    };

    async function loop() {
      // Sync to current state — covers resume cases where the user
      // refreshed mid-pipeline. The job row already has whatever
      // phases landed before; the loop picks up at the next pending.
      const initial = await getGenerationJobStatus(jobId);
      if (cancelled) return;
      if (!initial) {
        // Job not found / cross-user → treat as unknown failure.
        fireFailed({
          jobId,
          status: "failed",
          trigger: "regen",
          metaPlan: { meta_summary: "", phases: [] },
          completedPhases: [],
          workoutCount: 0,
          previewId: null,
          failureCode: "unknown",
          failurePhase: null,
        });
        return;
      }
      setSnapshot(initial);
      if (initial.status === "complete") {
        fireComplete(initial);
        return;
      }
      if (initial.status === "failed" || initial.status === "cancelled") {
        fireFailed(initial);
        return;
      }

      // Run phases until terminal. Each advanceJob lands one phase
      // (or the finalize step) and returns the updated state.
      while (!cancelled) {
        const result = await advanceJob(jobId);
        if (cancelled) return;
        if (!result.ok) {
          // Build a synthetic snapshot so the caller's onFailed has
          // enough data to render code-specific copy. The real job
          // row was marked failed by runOnePhase / runFinalize.
          const latest = await getGenerationJobStatus(jobId);
          if (cancelled) return;
          if (latest) setSnapshot(latest);
          fireFailed(
            latest ?? {
              jobId,
              status: "failed",
              trigger: initial.trigger,
              metaPlan: initial.metaPlan,
              completedPhases: result.code === "unknown" ? [] : initial.completedPhases,
              workoutCount: 0,
              previewId: null,
              failureCode: result.code,
              failurePhase: null,
            },
          );
          return;
        }
        // Update snapshot with the latest completed phases + previewId.
        // Refetch the full snapshot so the UI gets workoutCount + any
        // server-side field deltas we don't return in advanceJob.
        const refreshed = await getGenerationJobStatus(jobId);
        if (cancelled) return;
        if (refreshed) setSnapshot(refreshed);
        if (result.status === "complete") {
          fireComplete(
            refreshed ?? {
              jobId,
              status: "complete",
              trigger: initial.trigger,
              metaPlan: initial.metaPlan,
              completedPhases: result.completedPhases,
              workoutCount: 0,
              previewId: result.previewId,
              failureCode: null,
              failurePhase: null,
            },
          );
          return;
        }
      }
    }

    void loop();
    const tickHandle = window.setInterval(() => {
      if (cancelled) return;
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(tickHandle);
    };
  }, [jobId]);

  // Render before the first poll lands — show the atmospheric loader
  // shell without phase detail. Same vibe as the legacy GeneratingState
  // so the user doesn't see a flash of empty content.
  const phases = snapshot?.metaPlan.phases ?? [];
  const completedSet = new Set(snapshot?.completedPhases ?? []);
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
          // Pre-first-sync: show only the pulse dots so the screen
          // doesn't look blank during the ~1s status read.
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
