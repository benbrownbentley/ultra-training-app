import Link from "next/link";

// Back-link header shared by /profile/race, /profile/athlete, /profile/account.
export function ProfileDetailHeader({
  backHref = "/profile",
  backLabel = "PROFILE",
}: {
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3.5 sm:px-5 dark:border-zinc-800 dark:bg-zinc-950">
      <Link
        href={backHref}
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
        {backLabel}
      </Link>
      <span aria-hidden="true" />
    </div>
  );
}
