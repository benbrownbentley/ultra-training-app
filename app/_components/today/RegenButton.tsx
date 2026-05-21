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
        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50/60 px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase text-emerald-700 transition active:scale-[0.97] hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/[0.08] dark:text-emerald-400 dark:hover:bg-emerald-500/[0.16]"
        style={{ letterSpacing: "0.18em" }}
      >
        <RegenIcon color="currentColor" />
        REGEN
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
