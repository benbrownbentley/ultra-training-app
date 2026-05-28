"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { createPortal } from "react-dom";

// Returns true once we're past the initial render on the client. Stays
// false during SSR and the hydration pass so createPortal never targets a
// missing `document`. Avoids the setState-in-effect lint warning that the
// useState+useEffect pattern would trigger.
const noopSubscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
import { useRouter } from "next/navigation";
import { previewPlan } from "@/app/actions";
import { MotifTopo } from "@/app/_components/today/motifs";
import { ArrowRight } from "@/app/_components/today/icons";
import { AddEntrySheets } from "@/app/_components/journal/AddEntrySheets";
import { useRegenStatus } from "@/app/_components/regen/RegenStatusProvider";
import type { ContextRow, RecentSkips } from "@/lib/regen-context";

interface Props {
  open: boolean;
  onClose: () => void;
  contextRows: ContextRow[];
  // Set true when the user has very little new data since the last regen
  // (sparse context). Surfaces the "add notes for a meaningful change" tip.
  showSparseTip?: boolean;
  // Skipped + missed workouts in the recent window — when count > 0,
  // surfaces a RECENT SKIPS hint with an inline "add a note" affordance
  // that opens the journal note sheet pre-filled.
  recentSkips?: RecentSkips;
  // Seed value for the textarea. Used by "Regenerate again" on /regen so
  // the user keeps the notes they typed for the previous attempt.
  initialNotes?: string;
}

const PLACEHOLDER = `e.g. "I'm feeling great — push the volume a bit", or "Achilles is still flaring — keep it light."`;

// Outer wrapper just owns the portal + mount handshake. The actual sheet
// body is rendered only when `open` is true, so its internal state
// (notes, error) auto-resets on each open without us juggling effects.
export function RegenerateSheet({
  open,
  onClose,
  contextRows,
  showSparseTip,
  recentSkips,
  initialNotes,
}: Props) {
  const isClient = useIsClient();
  if (!open || !isClient) return null;
  return createPortal(
    <SheetBody
      onClose={onClose}
      contextRows={contextRows}
      showSparseTip={showSparseTip}
      recentSkips={recentSkips}
      initialNotes={initialNotes}
    />,
    document.body,
  );
}

function SheetBody({
  onClose,
  contextRows,
  showSparseTip,
  recentSkips,
  initialNotes,
}: Omit<Props, "open">) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const titleId = useId();
  // Read inFlight from the shared regen-status context so the
  // Regenerate button disables itself when a prior regen is still
  // running. The banner is the recovery surface — duplicate kickoffs
  // are blocked server-side too (already_in_flight code from PR 1)
  // but disabling client-side keeps the UX from rendering a useless
  // tap target. Refresh primes the banner state right after submit
  // so the user sees the new chain in_progress without waiting on
  // the first Realtime payload.
  const { inFlight, refresh } = useRegenStatus();

  // Focus the textarea once painted so mobile keyboards rise immediately.
  useEffect(() => {
    const handle = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => window.clearTimeout(handle);
  }, []);

  // Close on Escape and freeze background scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    document.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
    };
  }, [onClose, isPending]);

  const router = useRouter();
  const submit = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await previewPlan(notes);
        if (!r.ok) {
          // already_in_flight is the banner's job — surface it
          // inline rather than bouncing to /regen?error, because the
          // user's recovery surface is the banner they can already
          // see. Server returns this when a prior regen is still
          // running (e.g. another tab kicked one off).
          if (r.code === "already_in_flight") {
            setError(
              "A regen is already running — check the banner at the top of the page.",
            );
            void refresh();
            return;
          }
          // Branded full-screen error — closes the sheet and lets
          // /regen?error=<code> render the StateError variant the user
          // can retry from. Stable across timeout, validation,
          // anthropic, and unknown codes per lib/plan-gen-result.ts.
          onClose();
          router.push(`/regen?error=${r.code}&req=${r.requestId}`);
          return;
        }
        // Prime the banner state so the user sees in_progress
        // immediately, not after the first Realtime payload.
        void refresh();
        onClose();
        // Phase 2.5 chunked path returns a jobId — route to the
        // progress page which polls until complete then auto-routes
        // to the preview diff. Legacy path lands at ?preview=<id>
        // directly.
        if (r.jobId !== null) {
          router.push(`/regen?job=${r.jobId}`);
        } else {
          router.push(`/regen?preview=${r.previewId}`);
        }
      } catch (e) {
        // Network-level failure (504 HTML response, dropped connection)
        // — the server action's typed envelope never reached us. Treat
        // identically to a returned generation_timeout so the UX path
        // is the same.
        console.error("[RegenerateSheet] previewPlan threw", e);
        onClose();
        router.push(`/regen?error=generation_timeout`);
      }
    });
  }, [notes, onClose, refresh, router]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 font-sans"
    >
      {/* Backdrop — topo motif behind dim+blur so the rest of the app
          reads as "still there, just out of focus". */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-zinc-50 dark:bg-zinc-950" />
        <div className="absolute inset-0 opacity-45">
          <MotifTopo color="#10b981" opacity={0.09} />
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={isPending ? undefined : onClose}
          className="absolute inset-0 bg-zinc-950/35 backdrop-blur-sm dark:bg-black/55"
        />
      </div>

      {/* Surface — bottom sheet on mobile, centered modal at sm: and up. */}
      <div
        className={[
          "absolute left-0 right-0 bottom-0 flex max-h-[78dvh] flex-col rounded-t-[20px] bg-zinc-50 text-zinc-950 shadow-[0_-16px_48px_rgba(0,0,0,0.35)] dark:bg-zinc-950 dark:text-zinc-50",
          "sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2 sm:max-h-[88dvh] sm:w-[480px] sm:max-w-[92%] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-zinc-200 sm:shadow-[0_24px_64px_rgba(0,0,0,0.45)] sm:dark:border-zinc-800",
        ].join(" ")}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Close X (desktop only) */}
        <button
          type="button"
          onClick={isPending ? undefined : onClose}
          aria-label="Close"
          className="absolute top-3.5 right-3.5 hidden h-[30px] w-[30px] items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed sm:inline-flex dark:border-zinc-800 dark:hover:text-zinc-50"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="flex-1 overflow-y-auto px-5 pt-3.5 pb-3 sm:px-6 sm:pt-6">
          <div
            id={titleId}
            className="font-mono text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
            style={{ letterSpacing: "0.2em" }}
          >
            — REGENERATE PLAN
          </div>

          <div className="mt-4">
            <p className="m-0 text-sm leading-snug text-zinc-600 dark:text-zinc-400">
              Recent context we already have:
            </p>
            <div className="mt-1.5">
              {contextRows.length > 0 ? (
                <>
                  {contextRows.map((c, i) => (
                    <ContextRowItem key={i} {...c} />
                  ))}
                  <div className="border-t border-zinc-200 dark:border-zinc-800" />
                </>
              ) : (
                <div className="mt-1 border-y border-zinc-200 py-3 dark:border-zinc-800">
                  <span className="font-mono text-[12.5px] text-zinc-600 dark:text-zinc-400">
                    <span className="mr-2 text-emerald-500">·</span>
                    Just your race target and athlete profile.
                  </span>
                </div>
              )}
            </div>

            {recentSkips && recentSkips.count > 0 && (
              <RecentSkipsHint recentSkips={recentSkips} />
            )}

            {showSparseTip && (
              <div className="mt-3 flex gap-2.5 rounded-[10px] border border-dashed border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
                <span
                  className="whitespace-nowrap pt-[1px] font-mono text-[10px] font-semibold uppercase text-zinc-500"
                  style={{ letterSpacing: "0.2em" }}
                >
                  — TIP
                </span>
                <span className="text-[13px] italic leading-snug text-zinc-600 dark:text-zinc-400">
                  Adding notes will give us more to work with. Otherwise the
                  plan will likely come back unchanged.
                </span>
              </div>
            )}
          </div>

          <div className="mt-5">
            <label
              htmlFor="regen-notes"
              className="m-0 mb-2 block text-sm font-medium leading-snug text-zinc-950 dark:text-zinc-50"
            >
              Anything else to consider?{" "}
              <span className="font-normal text-zinc-400 dark:text-zinc-600">
                (optional)
              </span>
            </label>
            <textarea
              id="regen-notes"
              ref={textareaRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={PLACEHOLDER}
              disabled={isPending}
              className="block w-full rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14.5px] leading-snug text-zinc-950 placeholder:italic placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:placeholder:text-zinc-600 dark:focus:ring-emerald-500/10"
              style={{ minHeight: 96 }}
              rows={4}
            />
            {/* Today-lock heads-up. Regen always preserves today's
                workout — users who want to change today use the
                today-card controls (Skip / Log retrospectively).
                Stated explicitly so a user typing "swap today's run
                for a rest day" doesn't expect that to land. */}
            <p
              className="mt-1.5 font-mono text-[10.5px] uppercase text-zinc-500 dark:text-zinc-500"
              style={{ letterSpacing: "0.18em" }}
            >
              Updates tomorrow onwards · today stays as-is
            </p>
          </div>

          {error && (
            <div className="mt-3 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2 text-[12.5px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-5 pt-2.5 pb-[max(env(safe-area-inset-bottom),18px)] sm:px-6 sm:pb-5 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="bg-transparent text-sm font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || inFlight}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {/* Three button states: submitting this sheet's tap
                ("Regenerating…"), another regen already running
                (server returns already_in_flight; banner is the
                recovery surface), or idle ready-to-submit. */}
            {isPending
              ? "Regenerating…"
              : inFlight
                ? "Generation in progress — see banner"
                : "Regenerate"}
            {!isPending && !inFlight && (
              <ArrowRight color="#052e1f" size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContextRowItem({ label, value }: ContextRow) {
  return (
    <div className="grid grid-cols-[12px_auto_1fr] gap-2 border-t border-zinc-200 py-2 dark:border-zinc-800">
      <span className="font-mono text-[12px] leading-snug text-emerald-500">·</span>
      <span
        className="whitespace-nowrap pt-[2px] font-mono text-[10px] font-semibold uppercase text-zinc-500"
        style={{ letterSpacing: "0.18em" }}
      >
        {label}
      </span>
      <span className="font-mono text-[12px] leading-snug text-zinc-950 dark:text-zinc-50">
        {value}
      </span>
    </div>
  );
}

// Formats a YYYY-MM-DD date string as a short weekday ("MON", "FRI")
// in UTC so it lines up with how the rest of the app renders dates.
function shortWeekday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
    .toUpperCase();
}

/**
 * Tappable RECENT SKIPS hint. Collapsed view shows a one-line
 * summary ("3 since last update · MON · WED · FRI"); expanded view
 * lists the workouts and offers an inline "Add a note about these"
 * link that opens the journal note sheet pre-filled with a
 * multi-line scaffold. Re-uses the existing AddEntrySheets prefill
 * surface so the journal entry lands in the standard feed.
 */
function RecentSkipsHint({ recentSkips }: { recentSkips: RecentSkips }) {
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Cap the inline date list — beyond 4 the row gets cramped.
  const preview = recentSkips.items.slice(0, 4);
  const inlineDates = preview.map((i) => shortWeekday(i.date)).join(" · ");

  // Pre-fill body for "Add a note about these" — multi-line so the
  // athlete can leave one line per session if they want. Same shape
  // as the per-card prefill but aggregated.
  const prefillLines = recentSkips.items.map((i) => {
    const verb = i.status === "skipped" ? "Skipped" : "Missed";
    return `${verb}: ${i.title} on ${i.date} — `;
  });
  const prefillBody = `${prefillLines.join("\n")}\n`;

  return (
    <>
      <div className="mt-3 rounded-[10px] border border-amber-200 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/[0.08]">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-2.5 bg-transparent px-3 py-2.5 text-left"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span
              className="font-mono text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400"
              style={{ letterSpacing: "0.2em" }}
            >
              — RECENT SKIPS
            </span>
            <span className="font-mono text-[12px] leading-snug text-zinc-950 dark:text-zinc-50">
              {recentSkips.count} since last update
              {inlineDates && <span className="text-zinc-500"> · {inlineDates}</span>}
            </span>
          </div>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className={`shrink-0 text-amber-700 transition-transform dark:text-amber-400 ${
              expanded ? "rotate-90" : ""
            }`}
          >
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {expanded && (
          <div className="border-t border-amber-200 px-3 py-2 dark:border-amber-500/40">
            <ul className="m-0 flex flex-col gap-1.5 p-0">
              {recentSkips.items.map((item, i) => (
                <li
                  key={`${item.date}-${i}`}
                  className="flex items-center justify-between gap-2 font-mono text-[12px] text-zinc-950 dark:text-zinc-50"
                >
                  <span>
                    <span className="mr-2 text-zinc-500">
                      {shortWeekday(item.date)}
                    </span>
                    {item.title}
                  </span>
                  <span className="font-mono text-[10px] uppercase text-zinc-500" style={{ letterSpacing: "0.18em" }}>
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="mt-2.5 bg-transparent font-mono text-[10.5px] font-medium uppercase text-emerald-700 transition hover:underline dark:text-emerald-400"
              style={{ letterSpacing: "0.18em" }}
            >
              + ADD A NOTE ABOUT THESE
            </button>
          </div>
        )}
      </div>
      <AddEntrySheets
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        prefill={{ type: "note", body: prefillBody }}
      />
    </>
  );
}
