"use client";

// Global regen status banner. Mounted in the root layout so it
// appears on every authenticated page; sits as a thin top bar that
// renders nothing in the idle state. v2's primary "where is my
// regen?" surface — see PROJECT_BRIEF.md → "Regen async +
// notification UX (2026-05-28)".
//
// Data flow:
//   1. Root layout server-renders the initial state via
//      `getBannerStateForUser(userId)` and passes it as a prop. No
//      flash-of-empty on first paint.
//   2. This component subscribes to plan_generation_jobs row changes
//      via Supabase Realtime, filtered to the user's own rows by
//      `user_id=eq.<userId>` (RLS also enforces this; the explicit
//      filter just reduces wasted wire traffic).
//   3. On each payload the banner re-fetches via the
//      `getRegenBannerState` server action so the linked plan_preview
//      status is reflected too — Realtime alone only tells us about
//      the job row, not whether the user has since accepted the
//      preview from another tab.

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getRegenBannerState,
  previewPlan,
} from "@/app/actions";
import type { BannerState } from "@/lib/regen-banner";

interface Props {
  userId: string;
  initialState: BannerState;
}

export function RegenStatusBanner({ userId, initialState }: Props) {
  const router = useRouter();
  const [state, setState] = useState<BannerState>(initialState);
  const [isRetrying, startRetry] = useTransition();

  useEffect(() => {
    const supabase = createClient();

    // Filter to the user's own rows. RLS enforces this server-side
    // too, but pushing the filter down to the publication subscription
    // means the wire only carries our user's payloads.
    const channel = supabase
      .channel(`regen-banner-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "plan_generation_jobs",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Re-derive via the server action so the linked preview
          // row's status (pending / accepted / discarded) is part of
          // the state we render. The payload alone doesn't carry that.
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  async function refresh() {
    try {
      const next = await getRegenBannerState();
      setState(next);
    } catch (err) {
      console.error("[regen-banner] refresh failed", err);
    }
  }

  function handleRetry() {
    // Re-fire previewPlan with the failed job's notes so the new
    // regen starts from the same input. The original failed row stays
    // in the table but is no longer the most-recent regen-trigger row
    // once the new precreate lands, so the banner state derivation
    // moves on automatically.
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
          onClick={() => {
            if (state.jobId) router.push(`/regen?job=${state.jobId}`);
          }}
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
