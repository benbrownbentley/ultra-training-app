import { VertLogo } from "@/app/_components/today/icons";

// Mirrors the Today / Plan / Profile headers — inner wrapper capped at
// 720px and centred so the wordmark sits at the same horizontal anchor
// on desktop across every top-level tab.
export function JournalHeader() {
  return (
    <div className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-[720px] items-center px-4 py-3.5 sm:px-5">
        <VertLogo accent="#10b981" textColor="currentColor" />
      </div>
    </div>
  );
}
