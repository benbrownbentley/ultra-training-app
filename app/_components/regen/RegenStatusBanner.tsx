"use client";

// Renders the global regen status bar. Pure consumer — all state +
// Realtime ownership now lives in RegenStatusProvider so this
// component and RegenProgressSheet read from the same source.
//
// In-progress VIEW tap opens the in-page progress sheet rather than
// navigating to /regen?job=<id>. The sheet stays minimisable so the
// user can pop the ceremony view from any page without losing their
// place — see PROJECT_BRIEF.md → "Regen async + notification UX
// (2026-05-28)" for the hybrid tap-flow decision.

import Link from "next/link";
import { useTransition } from "react";
import { previewPlan } from "@/app/actions";
import { useRegenStatus } from "./RegenStatusProvider";

export function RegenStatusBanner() {
  const { state, openSheet, refresh } = useRegenStatus();
  const [isRetrying, startRetry] = useTransition();

  function handleRetry() {
    // Re-fire previewPlan with the failed job's notes so the new
    // regen starts from the same input. The original failed row
    // stays in the table but is no longer the most-recent regen
    // trigger row once the new precreate lands, so the banner state
    // derivation moves on automatically.
    startRetry(async () => {
      await previewPlan(state.failedNotes ?? undefined);
      await refresh();
    });
  }

  if (state.kind === "idle") return null;

  if (state.kind === "in_progress") {
    return (
      <BannerShell>
        <button
          type="button"
          onClick={openSheet}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <PulseDot />
          <BannerLabel tone="progress">
            Generating your plan
            {state.phaseTotal !== null && state.phaseIndex !== null ? (
              <>
                <span className="mx-2 opacity-50">·</span>
                Phase {state.phaseIndex} of {state.phaseTotal}
                {state.phaseLabel ? ` — ${state.phaseLabel}` : ""}
              </>
            ) : null}
          </BannerLabel>
          <BannerAction>VIEW →</BannerAction>
        </button>
      </BannerShell>
    );
  }

  if (state.kind === "ready") {
    return (
      <BannerShell tone="ready">
        <Link
          href={`/regen?preview=${state.previewId}`}
          className="flex flex-1 items-center gap-3"
        >
          <span
            className="inline-flex h-2 w-2 rounded-full bg-emerald-500"
            aria-hidden
          />
          <BannerLabel tone="ready">New plan ready</BannerLabel>
          <BannerAction tone="ready">Review →</BannerAction>
        </Link>
      </BannerShell>
    );
  }

  // error
  return (
    <BannerShell tone="error">
      <div className="flex flex-1 items-center gap-3">
        <span
          className="inline-flex h-2 w-2 rounded-full bg-amber-500"
          aria-hidden
        />
        <BannerLabel tone="error">Plan generation failed</BannerLabel>
        <button
          type="button"
          onClick={handleRetry}
          disabled={isRetrying}
          className="font-mono text-[10.5px] uppercase text-amber-700 transition active:scale-[0.97] hover:underline disabled:opacity-50 dark:text-amber-400"
          style={{ letterSpacing: "0.18em" }}
        >
          {isRetrying ? "Restarting…" : "Try again →"}
        </button>
      </div>
    </BannerShell>
  );
}

// ─── Sub-elements ─────────────────────────────────────────────────

function BannerShell({
  tone,
  children,
}: {
  tone?: "progress" | "ready" | "error";
  children: React.ReactNode;
}) {
  // Thin top bar — light zinc tint by default, emerald-tinted in
  // ready state, amber-tinted in error. Border-bottom separates from
  // the page chrome so the banner reads as a distinct surface
  // without competing with the page content.
  const toneClass =
    tone === "ready"
      ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/5 dark:border-emerald-500/20"
      : tone === "error"
        ? "bg-amber-50 border-amber-200 dark:bg-amber-500/5 dark:border-amber-500/20"
        : "bg-zinc-50 border-zinc-200 dark:bg-zinc-900/40 dark:border-zinc-800";
  return (
    <div
      className={`flex h-9 items-center gap-3 border-b px-4 sm:px-5 ${toneClass}`}
      role="status"
    >
      {children}
    </div>
  );
}

function BannerLabel({
  tone,
  children,
}: {
  tone: "progress" | "ready" | "error";
  children: React.ReactNode;
}) {
  const colour =
    tone === "ready"
      ? "text-emerald-900 dark:text-emerald-200"
      : tone === "error"
        ? "text-amber-900 dark:text-amber-200"
        : "text-zinc-800 dark:text-zinc-200";
  return (
    <span
      className={`font-mono text-[11px] uppercase ${colour}`}
      style={{ letterSpacing: "0.16em" }}
    >
      {children}
    </span>
  );
}

function BannerAction({
  tone,
  children,
}: {
  tone?: "ready";
  children: React.ReactNode;
}) {
  const colour =
    tone === "ready"
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-zinc-600 dark:text-zinc-400";
  return (
    <span
      className={`ml-auto font-mono text-[10.5px] uppercase ${colour}`}
      style={{ letterSpacing: "0.18em" }}
    >
      {children}
    </span>
  );
}

function PulseDot() {
  // Matches the existing .vert-pulse-dot motif used on the regen
  // page. Two-layer dot: solid centre + animated ring expressing
  // "the chain is alive."
  return (
    <span className="relative inline-flex h-2 w-2" aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  );
}
