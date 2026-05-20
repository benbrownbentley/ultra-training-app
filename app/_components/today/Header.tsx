import { VertLogo } from "./icons";

// Top chrome on the Today screen. The phase label is absolutely centered so it
// reads as a balanced, centred title regardless of logo width; the logo sits
// flush-left on its own layer.
export function Header({ phase }: { phase: string }) {
  return (
    <div className="relative flex items-center border-b border-zinc-200 bg-zinc-50 px-4 py-3.5 sm:px-5 dark:border-zinc-800 dark:bg-zinc-950">
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
  );
}
