"use client";

import { useState } from "react";
import { RegenIcon } from "@/app/_components/today/icons";
import { RegenerateSheet } from "@/app/_components/regen/RegenerateSheet";
import type { ContextRow } from "@/lib/regen-context";

interface Props {
  contextRows: ContextRow[];
  showSparseTip?: boolean;
}

// Outline button at the top of the plan tab. Opens the universal regen
// sheet — the sheet itself owns confirmation, context display, and notes
// entry so the destructive write always lands behind a deliberate tap.
export function RegeneratePlanRow({ contextRows, showSparseTip }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-zinc-200 px-4 text-sm font-medium text-zinc-950 transition hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-700"
      >
        <RegenIcon color="currentColor" size={14} />
        Regenerate plan
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
