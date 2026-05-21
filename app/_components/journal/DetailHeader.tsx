import Link from "next/link";

// Top chrome on /journal/* sub-routes. Matches the workout-detail header so
// the back behaviour reads as "consistent with everywhere else in the app".
export function JournalDetailHeader() {
  return (
    <div className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-[720px] items-center justify-between px-4 py-3.5 sm:px-5">
        <Link
          href="/journal"
          className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-medium uppercase text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          style={{ letterSpacing: "0.18em" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M14 6l-6 6 6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          JOURNAL
        </Link>
        <span aria-hidden="true" />
      </div>
    </div>
  );
}
