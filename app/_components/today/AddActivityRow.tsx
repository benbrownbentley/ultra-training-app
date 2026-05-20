// Quiet dashed CTA below the day's cards. Visual placeholder for now — the
// "add a custom activity" flow ships in a later iteration. Disabled while
// regeneration is in flight so the user can't queue a write against stale data.
export function AddActivityRow({ disabled }: { disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      title="Add custom activity — coming soon"
      className="flex w-full items-center gap-2.5 rounded-[12px] border border-dashed border-zinc-200 bg-transparent px-3.5 py-3 text-left transition disabled:opacity-50 dark:border-zinc-800"
    >
      <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-zinc-200 text-emerald-500 dark:border-zinc-800">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 5v14M5 12h14"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="text-[13.5px] font-medium text-zinc-950 dark:text-zinc-50">
        Add activity
      </span>
      <span
        className="ml-auto font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
        style={{ letterSpacing: "0.18em" }}
      >
        — DID SOMETHING ELSE?
      </span>
    </button>
  );
}
