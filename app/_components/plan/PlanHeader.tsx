import { VertLogo } from "@/app/_components/today/icons";

// Plain brand-logo strip — no phase label here because the body owns
// that. Inner wrapper matches the Today Header's `max-w-[720px]
// mx-auto` so the wordmark sits at the same horizontal anchor across
// every top-level tab on desktop.
export function PlanHeader() {
  return (
    <div className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-[720px] items-center px-4 py-3.5 sm:px-5">
        <VertLogo accent="#10b981" textColor="currentColor" />
      </div>
    </div>
  );
}
