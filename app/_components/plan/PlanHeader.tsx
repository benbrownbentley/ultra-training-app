import { VertLogo } from "@/app/_components/today/icons";

// Plain brand-logo strip — no phase label here because the body owns that.
export function PlanHeader() {
  return (
    <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3.5 sm:px-5 dark:border-zinc-800 dark:bg-zinc-950">
      <VertLogo accent="#10b981" textColor="currentColor" />
      <span aria-hidden="true" />
    </div>
  );
}
