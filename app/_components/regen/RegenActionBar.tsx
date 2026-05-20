import Link from "next/link";
import { ArrowRight } from "@/app/_components/today/icons";

// Sticky bottom of the result + minor states. Primary accepts, outline
// re-runs the regen, ghost link discards. These currently route via plain
// links because the regen flow isn't broken into preview+commit yet; once
// it is, each becomes a server action.
export function RegenActionBar() {
  return (
    <div className="border-t border-zinc-200 bg-zinc-50 px-4 pt-3 pb-3.5 sm:px-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2.5">
        <Link
          href="/regen?state=accepted"
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400"
        >
          Accept new plan
          <ArrowRight color="#052e1f" size={16} />
        </Link>
        <Link
          href="/regen?state=generating"
          className="inline-flex h-11 items-center justify-center rounded-[10px] border border-zinc-200 px-4 text-sm font-medium text-zinc-950 transition hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-700"
        >
          Regenerate again
        </Link>
      </div>
      <div className="mt-2.5 flex justify-end">
        <Link
          href="/"
          className="text-[12.5px] font-medium text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
        >
          Keep current plan
        </Link>
      </div>
    </div>
  );
}
