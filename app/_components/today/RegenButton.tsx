"use client";

import { useState } from "react";
import { RegenIcon } from "./icons";
import { RegenerateSheet } from "@/app/_components/regen/RegenerateSheet";
import type { ContextRow } from "@/lib/regen-context";

interface Props {
  contextRows: ContextRow[];
  showSparseTip?: boolean;
  isPending: boolean;
}

// REGEN chip inside the plan strip. Opens the universal regenerate sheet
// rather than firing the action directly — the sheet owns confirmation,
// context display, and notes entry.
export function RegenButton({ contextRows, showSparseTip, isPending }: Props) {
  const [open, setOpen] = useState(false);

  if (isPending) {
    return (
      <span
        className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
        style={{ letterSpacing: "0.18em" }}
      >
        <RegenIcon color="currentColor" />
        UPDATING…
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Regenerate upcoming workouts"
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-emerald-500 bg-emerald-500 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_4px_12px_rgba(16,185,129,0.25)] transition active:scale-[0.95] hover:bg-emerald-400 dark:border-emerald-400 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
        style={{ letterSpacing: "0.2em" }}
      >
        REGEN
        {/* Lightning bolt — small action glyph that signals
            "this triggers something" and matches the regenerate
            semantics. */}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L5 14h6l-1 8 8-12h-6l1-8z" fill="currentColor" />
        </svg>
      </button>
      <RegenerateSheet
        open={open}
        onClose={() => setOpen(false)}
        contextRows={contextRows}
        showSparseTip={showSparseTip}
      />
    </>
  );
}
