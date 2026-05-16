/**
 * Skeleton shown while the home Server Component is fetching the plan from
 * Supabase. Mirrors the real page sections (goal card, today card, week strip)
 * so the layout doesn't jump when the data resolves.
 */
export default function HomeLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8 sm:py-12">
      <div className="h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />

      <div className="h-24 animate-pulse rounded-2xl bg-emerald-600/30 dark:bg-emerald-500/20" />

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-3 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-2 h-6 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-4 flex flex-col gap-3">
          <div className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800/60" />
          <div className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800/60" />
        </div>
      </div>

      <div>
        <div className="mb-3 h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800/60"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
