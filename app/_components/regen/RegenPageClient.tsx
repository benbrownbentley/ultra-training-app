"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { commitPlan, discardPreview, previewPlan } from "@/app/actions";
import type { WeekDiff } from "@/lib/preview";
import type { ContextRow } from "@/lib/regen-context";
import type { GenerationSummary } from "@/lib/claude";
import { StateAccepted } from "./StateAccepted";
import { StateError } from "./StateError";
import { StateGenerating } from "./StateGenerating";
import { StateMinor } from "./StateMinor";
import { StateResult } from "./StateResult";
import { RegenerateSheet } from "./RegenerateSheet";

interface Props {
  previewId: number;
  isMinor: boolean;
  summary: GenerationSummary;
  changedWeeks: WeekDiff[];
  unchangedTrailing: number;
  contextRows: ContextRow[];
  regenSparseTip: boolean;
  // Notes the user typed for THIS preview. Pre-populates the textarea
  // when they tap "Regenerate again" so they don't have to retype.
  previousNotes: string;
}

// Orchestrates the four transient states (result/minor → generating →
// accepted | error) on top of the server-rendered preview data. The page
// server component hands us the diff + summary; we own the action
// transitions and the regenerate-again sheet trigger.
export function RegenPageClient({
  previewId,
  isMinor,
  summary,
  changedWeeks,
  unchangedTrailing,
  contextRows,
  regenSparseTip,
  previousNotes,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"diff" | "accepted" | "error" | "generating">(
    "diff",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "accept" | "discard" | "regenerate" | null
  >(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // StateMinor's diff is collapsed by default — this toggles the
  // per-week view inline without changing the URL.
  const [diffExpanded, setDiffExpanded] = useState(false);
  // True from the moment Accept is clicked until the commit either
  // completes (→ accepted screen + router push) or fails (→ error).
  // Render-guarded at the top so the diff doesn't briefly flash back
  // through any intermediate state during the commit transition.
  const [accepting, setAccepting] = useState(false);
  // Flips true once discard fires or the user explicitly keeps the
  // current plan — used by the beforeunload guard to know the user
  // already chose a clean exit (no warning needed).
  const [exiting, setExiting] = useState(false);
  const [, startTransition] = useTransition();

  const handleAccept = useCallback(() => {
    // Flash the success/accepted screen immediately — the commit
    // happens in the background. If it fails, we drop into the error
    // state, which also clears `accepting` so the user can retry.
    setAccepting(true);
    setPendingAction("accept");
    startTransition(async () => {
      try {
        await commitPlan(previewId);
        setPhase("accepted");
      } catch (e) {
        setAccepting(false);
        setErrorMessage(
          e instanceof Error ? e.message : "Failed to accept plan",
        );
        setPhase("error");
      } finally {
        setPendingAction(null);
      }
    });
  }, [previewId]);

  const handleDiscard = useCallback(() => {
    setExiting(true);
    setPendingAction("discard");
    startTransition(async () => {
      try {
        await discardPreview(previewId);
        router.push("/");
      } catch (e) {
        setExiting(false);
        setErrorMessage(
          e instanceof Error ? e.message : "Failed to discard preview",
        );
        setPhase("error");
      } finally {
        setPendingAction(null);
      }
    });
  }, [previewId, router]);

  const handleRegenerateAgain = useCallback(() => {
    // Open the same sheet the user already knows — gives them a chance to
    // tweak notes before firing a new preview. The sheet's own submit will
    // discard the current pending preview automatically (previewPlan's
    // first step) and route to /regen?preview=<newId>.
    setSheetOpen(true);
  }, []);

  const handleTryAgain = useCallback(() => {
    // From the error state, fire a fresh previewPlan with no notes.
    // Chunked path returns a jobId → route to the progress page;
    // legacy path returns a previewId → route to the diff view.
    // Thrown errors come from network-level issues (504 HTML, dropped
    // connection) and fall through to the same branded error UX.
    setPhase("generating");
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const r = await previewPlan();
        if (!r.ok) {
          router.push(`/regen?error=${r.code}&req=${r.requestId}`);
          return;
        }
        if (r.jobId !== null) {
          router.push(`/regen?job=${r.jobId}`);
        } else {
          router.push(`/regen?preview=${r.previewId}`);
        }
      } catch (e) {
        console.error("[RegenPageClient] previewPlan threw", e);
        router.push(`/regen?error=generation_timeout`);
      }
    });
  }, [router]);

  // Browser-level guard against discarding an unsaved preview. Only
  // arms while the user is on the diff and hasn't already picked a
  // clean exit (accept, discard, or regenerate-from-scratch).
  // In-app router-driven navigation does NOT fire `beforeunload`;
  // intercepting Next.js App-Router pushes would require either a
  // custom history-stack dance or wrapping every tab Link in a guard
  // component. Pragmatic scope: ship `beforeunload` only this batch —
  // real-world the back button hits a full-page nav anyway.
  useEffect(() => {
    const armed = phase === "diff" && !accepting && !exiting;
    if (!armed) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase, accepting, exiting]);

  // Accept render-guards have to win over phase === "diff" so the
  // diff never briefly re-renders during the commit transition.
  if (accepting || phase === "accepted") {
    return <StateAccepted />;
  }
  if (phase === "generating") {
    return <StateGenerating />;
  }
  if (phase === "error") {
    return (
      <StateError
        onTryAgain={handleTryAgain}
        message={errorMessage ?? undefined}
      />
    );
  }

  const stateProps = {
    summary: summary.summary,
    changes: summary.changes,
    changedWeeks,
    contextRows,
    onAccept: handleAccept,
    onRegenerateAgain: handleRegenerateAgain,
    onDiscard: handleDiscard,
    isPending: pendingAction !== null,
    pendingAction,
  };

  return (
    <>
      {isMinor ? (
        <StateMinor
          {...stateProps}
          expanded={diffExpanded}
          onExpandDiff={() => setDiffExpanded(true)}
        />
      ) : (
        <StateResult {...stateProps} unchangedTrailing={unchangedTrailing} />
      )}
      <RegenerateSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        contextRows={contextRows}
        showSparseTip={regenSparseTip}
        initialNotes={previousNotes}
      />
    </>
  );
}
