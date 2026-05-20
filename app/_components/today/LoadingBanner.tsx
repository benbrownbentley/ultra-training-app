// Shown at the top of the Today section while a plan regeneration is in
// flight. The three dots pulse staggered (keyframe defined in globals.css).
export function LoadingBanner({
  label = "UPDATING YOUR PLAN",
  body = "Reading your last 14 days…",
}: {
  label?: string;
  body?: string;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-3 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 dark:border-emerald-500/35 dark:bg-emerald-500/10">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="vert-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
            style={{ animationDelay: `${i * 0.25}s` }}
          />
        ))}
      </div>
      <div className="text-[12.5px] leading-snug text-zinc-900 dark:text-zinc-50">
        <span className="mr-2 font-mono text-[10.5px] uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
          — {label}
        </span>
        {body && <span className="text-zinc-600 dark:text-zinc-400">{body}</span>}
      </div>
    </div>
  );
}
