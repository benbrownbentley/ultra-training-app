import { VertLogo } from "./icons";

// Top chrome on the Today screen. Inner container is capped at 720px and
// centred so the logo + absolutely-centred phase label cluster together
// on wide desktop viewports rather than spreading edge-to-edge.
export function Header({ phase }: { phase: string }) {
  return (
    <div className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="relative mx-auto flex max-w-[720px] items-center px-4 py-3.5 sm:px-5">
        <VertLogo accent="#10b981" textColor="currentColor" />
        <div
          className="pointer-events-none absolute inset-x-0 flex justify-center"
          aria-hidden={false}
        >
          <span className="whitespace-nowrap font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
            — {phase}
          </span>
        </div>
      </div>
    </div>
  );
}
