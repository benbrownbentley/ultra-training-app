"use client";

// Shared inline form-status messages — extracted from AccountClient
// so the split-out form files don't each redefine them.

export function InlineError({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2 text-[12.5px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
      {children}
    </div>
  );
}

export function InlineSuccess({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-[12.5px] text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/[0.08] dark:text-emerald-300">
      {children}
    </div>
  );
}
