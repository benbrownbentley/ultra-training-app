"use client";

// Owns the global regen status used by:
//   1. RegenStatusBanner — renders the top-of-page status bar.
//   2. RegenProgressSheet — the in-page sheet that opens when the
//      banner's VIEW tap fires (replaces routing to /regen?job=<id>).
//   3. RegenerateSheet — reads `inFlight` to disable its Regenerate
//      button when a regen is already running, so the user gets a
//      "see banner" treatment instead of starting a duplicate job.
//
// Three consumers, one Realtime subscription. Without this provider
// each consumer would set up its own subscription and re-derive
// state, drifting whenever any of the paths missed an update.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { getRegenBannerState, resumeStuckJob } from "@/app/actions";
import type { BannerState } from "@/lib/regen-banner";

// If a chain's last heartbeat (job row updated_at) is older than this,
// the lazy watchdog assumes the chain died mid-phase and fires a
// resume. Phases typically finish in <60s on the chunked path; 3 min
// is a generous gate that avoids false positives on a slow Claude
// response while still catching genuinely dead chains quickly enough
// to matter to the user. The daily janitor cron (1h threshold)
// catches whatever the lazy watchdog misses.
const WATCHDOG_STALE_THRESHOLD_MS = 3 * 60 * 1000;

const IDLE: BannerState = {
  kind: "idle",
  jobId: null,
  previewId: null,
  phaseIndex: null,
  phaseTotal: null,
  phaseLabel: null,
  failureCode: null,
  failedNotes: null,
  lastUpdatedAt: null,
};

interface RegenStatusContextValue {
  state: BannerState;
  // Convenience flag — equivalent to `state.kind === "in_progress"`
  // but cleaner at every read site (especially RegenerateSheet's
  // button-disabled binding).
  inFlight: boolean;
  // Whether the in-page progress sheet is currently mounted. Banner
  // toggles this on VIEW tap; RegenProgressSheet consumes it.
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  // Forces a fresh server fetch — RegenerateSheet calls this after
  // submitting a new regen so the banner reflects in_progress
  // immediately rather than waiting for the first Realtime payload.
  refresh: () => Promise<void>;
}

const RegenStatusContext = createContext<RegenStatusContextValue>({
  state: IDLE,
  inFlight: false,
  sheetOpen: false,
  openSheet: () => {},
  closeSheet: () => {},
  refresh: async () => {},
});

interface ProviderProps {
  // Null on unauthenticated routes (sign-in, sign-up). Provider stays
  // mounted but skips the Realtime subscription so it remains a
  // no-op cheap consumer-friendly default.
  userId: string | null;
  initialState: BannerState | null;
  children: React.ReactNode;
}

export function RegenStatusProvider({
  userId,
  initialState,
  children,
}: ProviderProps) {
  const [state, setState] = useState<BannerState>(initialState ?? IDLE);
  // User intent rather than effective open state — the consumer's
  // visible `sheetOpen` is derived as `userWantsSheetOpen && state
  // is in_progress`. Derivation avoids the set-state-in-effect
  // anti-pattern that would otherwise be needed to auto-close the
  // sheet when the chain finishes / fails.
  const [userWantsSheetOpen, setUserWantsSheetOpen] = useState(false);

  // Single source of truth refresh. Used by both the Realtime callback
  // and the explicit RegenerateSheet post-submit refresh.
  const refresh = useCallback(async () => {
    try {
      const next = await getRegenBannerState();
      setState(next);
    } catch (err) {
      console.error("[regen-status] refresh failed", err);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`regen-status-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "plan_generation_jobs",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  // Lazy watchdog. Fires once on mount when the initial state shows
  // an in-flight chain whose last heartbeat is older than the stale
  // threshold — typical signal that the Vercel function died
  // mid-phase and the self-drive chain never recovered. Calling
  // resumeStuckJob is idempotent: runAdvanceJobEngine picks the next
  // pending phase via pickNextPhase, so a chain that's actually
  // alive (just slow on the current phase) at most wastes one
  // duplicate Claude call. We guard against multi-fire with a ref so
  // a re-render mid-flight doesn't double-trigger.
  const watchdogFiredRef = useRef(false);
  useEffect(() => {
    if (!userId) return;
    if (watchdogFiredRef.current) return;
    if (state.kind !== "in_progress") return;
    if (state.jobId === null || state.lastUpdatedAt === null) return;
    const ageMs = Date.now() - new Date(state.lastUpdatedAt).getTime();
    if (ageMs < WATCHDOG_STALE_THRESHOLD_MS) return;
    watchdogFiredRef.current = true;
    const jobId = state.jobId;
    void (async () => {
      try {
        await resumeStuckJob(jobId);
        await refresh();
      } catch (err) {
        console.error("[regen-watchdog] resume failed", err);
      }
    })();
  }, [userId, state.kind, state.jobId, state.lastUpdatedAt, refresh]);

  const inFlight = state.kind === "in_progress";
  // Effective sheet visibility — derived rather than synchronized.
  // If the chain finishes or fails while the sheet is open, this
  // flips to false automatically and the sheet unmounts without us
  // having to mutate state inside an effect.
  const sheetOpen = userWantsSheetOpen && inFlight;

  const value = useMemo<RegenStatusContextValue>(
    () => ({
      state,
      inFlight,
      sheetOpen,
      openSheet: () => setUserWantsSheetOpen(true),
      closeSheet: () => setUserWantsSheetOpen(false),
      refresh,
    }),
    [state, inFlight, sheetOpen, refresh],
  );

  return (
    <RegenStatusContext.Provider value={value}>
      {children}
    </RegenStatusContext.Provider>
  );
}

export function useRegenStatus(): RegenStatusContextValue {
  return useContext(RegenStatusContext);
}
