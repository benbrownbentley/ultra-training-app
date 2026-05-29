"use client";

// In-page minimisable sheet that wraps the same GeneratingPhaseState
// the /regen?job=<id> page renders. Opens when the user taps VIEW
// on the in-progress banner. Closing it doesn't affect the job —
// the chain self-drives server-side (PR 1) and the banner stays put
// so the user can re-open the sheet anytime. See PROJECT_BRIEF.md →
// "Regen async + notification UX (2026-05-28)".
//
// Mounted once at the layout level alongside RegenStatusBanner and
// RegenStatusProvider; the provider owns the open/close state so a
// banner tap and a sheet minimise stay in sync.

import { useEffect, useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { GeneratingPhaseState } from "@/app/_components/generating/GeneratingPhaseState";
import type { JobStatusSnapshot } from "@/lib/plan-generation-types";
import { useRegenStatus } from "./RegenStatusProvider";

const noopSubscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function RegenProgressSheet() {
  const { state, sheetOpen, closeSheet } = useRegenStatus();
  const isClient = useIsClient();

  // Only mount when both the user has asked for the sheet and the
  // banner state actually has a job in flight. Defends against a
  // late state transition (e.g. job completes while the sheet's
  // mid-open) leaving the sheet dangling with no jobId.
  if (!isClient) return null;
  if (!sheetOpen) return null;
  if (state.kind !== "in_progress" || state.jobId === null) return null;

  return createPortal(
    <SheetBody jobId={state.jobId} onClose={closeSheet} />,
    document.body,
  );
}

function SheetBody({
  jobId,
  onClose,
}: {
  jobId: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const titleId = useId();

  // Close on Escape + freeze background scroll. Matches the
  // RegenerateSheet's behaviour so the two sheets feel native to
  // the same modal vocabulary.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
    };
  }, [onClose]);

  function handleComplete(snapshot: JobStatusSnapshot) {
    // The provider's auto-close effect will fire once Realtime
    // delivers the "complete" payload, but we close immediately on
    // the in-sheet callback too so navigation feels snappy. Routing
    // mirrors RegenJobPage so users land at the diff view.
    onClose();
    if (snapshot.previewId) {
      router.push(`/regen?preview=${snapshot.previewId}`);
    }
  }

  function handleFailed(snapshot: JobStatusSnapshot) {
    // Banner flips to error via Realtime; sheet just closes so the
    // user sees the banner's retry CTA rather than a frozen ceremony.
    onClose();
    const code = snapshot.failureCode ?? "unknown";
    router.push(`/regen?error=${code}&jobId=${snapshot.jobId}`);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 font-sans"
    >
      {/* Backdrop — same layered treatment as RegenerateSheet so the
          two sheets feel like one design system. Tap-to-close on
          backdrop matches user mental model for minimising. */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-zinc-50 dark:bg-zinc-950" />
        <button
          type="button"
          aria-label="Minimise"
          onClick={onClose}
          className="absolute inset-0 bg-zinc-950/35 backdrop-blur-sm dark:bg-black/55"
        />
      </div>

      {/* Surface — bottom sheet on mobile, centered modal at sm:+.
          Taller than RegenerateSheet because the GeneratingPhaseState
          inside needs room for the per-phase progress list. */}
      <div
        className={[
          "absolute left-0 right-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[20px] bg-zinc-50 text-zinc-950 shadow-[0_-16px_48px_rgba(0,0,0,0.35)] dark:bg-zinc-950 dark:text-zinc-50",
          "sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2 sm:max-h-[88dvh] sm:w-[560px] sm:max-w-[92%] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-zinc-200 sm:shadow-[0_24px_64px_rgba(0,0,0,0.45)] sm:dark:border-zinc-800",
        ].join(" ")}
      >
        {/* Drag handle (mobile only) — visual cue this is dismissable. */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Minimise pill — non-destructive close. Closing here just
            re-collapses to the banner; the job keeps advancing
            server-side via the self-drive chain. Sized to read as
            "minimise" not "cancel" — the user can re-open from the
            banner anytime. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Minimise"
          className="absolute top-3.5 right-3.5 inline-flex h-[30px] items-center gap-1.5 rounded-full border border-zinc-200 px-3 font-mono text-[10.5px] uppercase text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900/40"
          style={{ letterSpacing: "0.18em" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Minimise
        </button>

        <div
          id={titleId}
          className="sr-only"
        >
          Plan generation in progress
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-5 sm:px-6">
          <GeneratingPhaseState
            jobId={jobId}
            onComplete={handleComplete}
            onFailed={handleFailed}
          />
        </div>
      </div>
    </div>
  );
}
