"use client";

// Phase 2.5.1 + 2.5.2 progress UI. Drives the per-phase advance loop
// client-side via sequential `advanceJob` calls. As of Phase 2.5.2:
//
// 1. Handles a new `kicking-off` job status (server returns the
//    jobId in ~50ms before the meta-plan call runs — this component
//    fires runMetaPlanForJob on mount and renders a pre-meta UI
//    variant while it waits).
// 2. Skips the per-phase getGenerationJobStatus refetch — advanceJob
//    now returns workoutCount inline so we compose the next snapshot
//    locally instead of round-tripping the DB.
// 3. Rotating phase-flavour text under the active phase, fading on a
//    ~3s cycle. Mirrors the legacy GeneratingState's vert-fade-rotate
//    pattern.
// 4. Prominent center-bottom timer with pulsing colon paired with
//    honest "usually 3–5 minutes" copy.
//
// Outcome routing is owned by the caller — onComplete and onFailed
// callbacks fire exactly once when the loop reaches a terminal state.

import { useEffect, useRef, useState } from "react";
import {
  advanceJob,
  getGenerationJobStatus,
  runMetaPlanForJob,
} from "@/app/actions";
import { MotifTopo } from "@/app/_components/today/motifs";
import { VertLogo } from "@/app/_components/today/icons";
import { PHASE_COPY, PHASE_FLAVOUR } from "@/lib/phase-flavour";
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

export function GeneratingPhaseState({
  jobId,
  onComplete,
  onFailed,
}: Props) {
  const [snapshot, setSnapshot] = useState<JobStatusSnapshot | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    onFailedRef.current = onFailed;
  }, [onFailed]);

  // Lifecycle: sync state → if kicking-off, fire runMetaPlanForJob →
  // then loop advanceJob until terminal. Each step short-circuits if
  // cancelled (component unmounted) or already-fired (terminal).
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
      // Sync to current state — covers Phase 2.5.2 kicking-off case
      // (we just precreated the job and need to fire the meta-plan)
      // plus resume cases where the user refreshed mid-pipeline.
      let initial = await getGenerationJobStatus(jobId);
      if (cancelled) return;
      if (!initial) {
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
      // Phase 2.5.2: fire the meta-plan call if it hasn't run yet.
      // runMetaPlanForJob is idempotent — safe under StrictMode
      // double-mount or remount-then-resume.
      if (initial.status === "kicking-off") {
        const meta = await runMetaPlanForJob(jobId);
        if (cancelled) return;
        if (!meta.ok) {
          const latest = await getGenerationJobStatus(jobId);
          if (cancelled) return;
          fireFailed(
            latest ?? {
              jobId,
              status: "failed",
              trigger: initial.trigger,
              metaPlan: { meta_summary: "", phases: [] },
              completedPhases: [],
              workoutCount: 0,
              previewId: null,
              failureCode: meta.code,
              failurePhase: "meta",
            },
          );
          return;
        }
        // Re-sync so we have the meta_plan + flipped status before
        // starting the advance loop. Single refetch — the advance
        // loop below avoids them per-phase via the workoutCount the
        // action returns.
        const refreshed = await getGenerationJobStatus(jobId);
        if (cancelled) return;
        if (!refreshed) {
          fireFailed({
            jobId,
            status: "failed",
            trigger: initial.trigger,
            metaPlan: { meta_summary: "", phases: [] },
            completedPhases: [],
            workoutCount: 0,
            previewId: null,
            failureCode: "unknown",
            failurePhase: null,
          });
          return;
        }
        setSnapshot(refreshed);
        initial = refreshed;
      }

      // Run phases sequentially until terminal. We compose the next
      // snapshot locally from advanceJob's return so we don't
      // round-trip the DB per phase (Phase 2.5.2 optimization).
      let working: JobStatusSnapshot = initial;
      while (!cancelled) {
        const result = await advanceJob(jobId);
        if (cancelled) return;
        if (!result.ok) {
          // Refetch the row's authoritative failure state — the
          // helpers already wrote failure_code + failure_phase on the
          // row, so the UI's error copy can lean on that.
          const latest = await getGenerationJobStatus(jobId);
          if (cancelled) return;
          if (latest) setSnapshot(latest);
          fireFailed(
            latest ?? {
              jobId,
              status: "failed",
              trigger: working.trigger,
              metaPlan: working.metaPlan,
              completedPhases: working.completedPhases,
              workoutCount: working.workoutCount,
              previewId: null,
              failureCode: result.code,
              failurePhase: null,
            },
          );
          return;
        }
        // Compose the next snapshot from advanceJob's return data —
        // no DB refetch per phase.
        const next: JobStatusSnapshot = {
          ...working,
          status: result.status,
          completedPhases: result.completedPhases,
          workoutCount: result.workoutCount,
          previewId: result.previewId,
        };
        setSnapshot(next);
        working = next;
        if (result.status === "complete") {
          fireComplete(next);
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

  // Two top-level render modes:
  //   • kicking-off / no phases yet → "designing your training arc"
  //     atmospheric panel (no phase rows). Bridges the ~8s gap
  //     between precreate and meta-plan completion.
  //   • normal → phase rows + active-phase rotating flavour text.
  const isKickingOff =
    !snapshot || snapshot.status === "kicking-off" || snapshot.metaPlan.phases.length === 0;
  const phases = snapshot?.metaPlan.phases ?? [];
  const completedSet = new Set(snapshot?.completedPhases ?? []);
  const activeIdx = phases.findIndex((p) => !completedSet.has(p.phase));
  const activePhase = activeIdx >= 0 ? phases[activeIdx]?.phase : null;

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

        {isKickingOff ? (
          <>
            <div
              className="font-mono text-[12px] font-semibold uppercase text-emerald-500"
              style={{ letterSpacing: "0.22em" }}
            >
              — DESIGNING YOUR TRAINING ARC
            </div>
            <p
              className="mt-3 max-w-[300px] text-center font-mono text-[12px] text-zinc-500 dark:text-zinc-500"
              style={{ letterSpacing: "0.02em" }}
            >
              Mapping the periodization phases for your race window.
            </p>
            <div className="mt-7 flex gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="vert-pulse-dot inline-block h-2 w-2 rounded-full bg-emerald-500"
                  style={{ animationDelay: `${i * 0.25}s` }}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <div
              className="font-mono text-[12px] font-semibold uppercase text-emerald-500"
              style={{ letterSpacing: "0.22em" }}
            >
              — BUILDING YOUR PLAN
            </div>
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
            {activePhase && (
              <PhaseFlavourRotator phase={activePhase} />
            )}
          </>
        )}

        {/* Center-bottom paired timer + honest copy. Pulsing colon
            ticks once per second so the page never feels frozen. */}
        <div
          className="absolute bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[13px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500"
          aria-live="polite"
        >
          <span className="text-zinc-700 dark:text-zinc-300">
            {formatElapsedWithPulse(elapsedSec)}
          </span>
          <span className="mx-2 text-zinc-300 dark:text-zinc-700">·</span>
          <span>usually 3–5 minutes</span>
        </div>
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

/**
 * Rotating five-line flavour text per active phase. Crossfades on a
 * ~3s cycle using the same animation pattern as the legacy
 * `GeneratingState`. Keyed on `phase` so the rotation resets cleanly
 * when the active phase advances.
 */
function PhaseFlavourRotator({ phase }: { phase: GenerationPhase }) {
  const lines = PHASE_FLAVOUR[phase];
  return (
    <div
      key={phase}
      className="relative mt-4 h-[18px] w-full max-w-[340px]"
      aria-live="polite"
    >
      {lines.map((line, i) => (
        <div
          key={i}
          className="vert-fade-rotate absolute inset-0 flex items-center justify-center text-center font-mono text-[11.5px] text-zinc-500 dark:text-zinc-500"
          style={{
            letterSpacing: "0.02em",
            // 3.5s per line × N lines = full cycle. Each line is fully
            // visible for ~3.5s (the keyframe's 12%-32% hold window),
            // which gives the eye comfortable reading time before the
            // crossfade kicks in. Bumped from 3s on 2026-05-22 after Ben
            // flagged the previous timing as just too quick to land.
            animationDelay: `${i * 3.5}s`,
            animationDuration: `${lines.length * 3.5}s`,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

/**
 * Returns the `M:SS` elapsed timer with a per-second pulsing colon.
 * Even seconds show `:`; odd seconds show ` ` (a non-breaking
 * full-width-equivalent). The colon's perceived blink confirms the
 * page is alive — no JS animation needed beyond the existing tick.
 */
function formatElapsedWithPulse(totalSeconds: number): React.ReactNode {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const colonVisible = totalSeconds % 2 === 0;
  return (
    <>
      {m}
      <span
        aria-hidden
        style={{
          // No width / display / textAlign overrides — Geist Mono gives
          // every glyph (including `:`) an identical fixed width, so
          // the natural inline span keeps "1:43" tight without
          // shifting the colon off-center. Earlier explicit width was
          // narrower than the glyph and pushed the visible character
          // to the right; removed on 2026-05-22.
          opacity: colonVisible ? 1 : 0.25,
          transition: "opacity 0.18s linear",
        }}
      >
        :
      </span>
      {s.toString().padStart(2, "0")}
      <span className="ml-1.5 text-zinc-400 dark:text-zinc-600">elapsed</span>
    </>
  );
}
