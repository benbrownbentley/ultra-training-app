import { VertLogo } from "./icons";

// Top chrome on the Today screen. Phase label is intentionally terse on
// mobile (e.g. "BUILD · WK 6/18") so it fits beside the logo without truncating.
export function Header({ phase }: { phase: string }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3.5 sm:px-5 dark:border-zinc-800 dark:bg-zinc-950">
      <VertLogo accent="#10b981" textColor="currentColor" />
      <div className="whitespace-nowrap font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
        — {phase}
      </div>
      <span aria-hidden="true" className="w-[44px]" />
    </div>
  );
}
