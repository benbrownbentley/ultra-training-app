"use client";

import { useCallback, useState, useTransition } from "react";
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
  const [, startTransition] = useTransition();

  const handleAccept = useCallback(() => {
    setPendingAction("accept");
    startTransition(async () => {
      try {
        await commitPlan(previewId);
        setPhase("accepted");
      } catch (e) {
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
    setPendingAction("discard");
    startTransition(async () => {
      try {
        await discardPreview(previewId);
        router.push("/");
      } catch (e) {
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

  if (phase === "accepted") {
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
