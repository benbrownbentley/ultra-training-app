import Link from "next/link";
import { ArrowRight } from "@/app/_components/today/icons";

// Static stub mirroring the live action bars in StateResult / StateMinor
// (sticky bottom, soft upward shadow, safe-area-aware padding, Keep
// ghost-link on the left, Regen outline middle, Accept primary on the
// right). The shipping flow uses the inline ActionBar inside those
// state components — this file is retained as a reference / pattern
// source for future Link-based regen entrypoints.
export function RegenActionBar() {
  return (
    <div className="sticky bottom-0 z-20 border-t border-zinc-200 bg-zinc-50 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),18px)] shadow-[0_-12px_24px_rgba(0,0,0,0.08)] sm:px-5 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_-12px_24px_rgba(0,0,0,0.45)]">
      <div className="flex items-center gap-2.5">
        <Link
          href="/"
          className="text-[12.5px] font-medium text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
        >
          Keep current plan
        </Link>
        <span className="flex-1" />
        <Link
          href="/regen?state=generating"
          className="inline-flex h-11 items-center justify-center rounded-[10px] border border-zinc-200 px-4 text-sm font-medium text-zinc-950 transition hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-700"
        >
          Regenerate again
        </Link>
        <Link
          href="/regen?state=accepted"
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400"
        >
          Accept new plan
          <ArrowRight color="#052e1f" size={16} />
        </Link>
      </div>
    </div>
  );
}
