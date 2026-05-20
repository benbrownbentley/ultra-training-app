import { MotifStretch } from "./motifs";

export function RestCard() {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-zinc-200 bg-white px-5 py-7 dark:border-zinc-800 dark:bg-[#0f0f11]">
      <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-50">
        <MotifStretch color="#10b981" opacity={0.12} />
      </div>
      <div className="relative">
        <div
          className="mb-2.5 whitespace-nowrap font-mono text-[11px] uppercase text-emerald-700 dark:text-emerald-400"
          style={{ letterSpacing: "0.2em" }}
        >
          — REST
        </div>
        <div
          className="max-w-[280px] text-[22px] font-medium leading-tight text-zinc-950 dark:text-zinc-50"
          style={{ letterSpacing: "-0.015em" }}
        >
          Recovery is the work.
          <br />
          <span className="text-zinc-600 dark:text-zinc-400">See you tomorrow.</span>
        </div>
      </div>
    </div>
  );
}

// Compact preview chip rendered next to the rest card so the user can see
// what they're recovering for without leaving the screen.
export function TomorrowPreview({ summary }: { summary: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-dashed border-zinc-200 px-3.5 py-3 dark:border-zinc-800">
      <div
        className="whitespace-nowrap font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
        style={{ letterSpacing: "0.2em" }}
      >
        — TMW
      </div>
      <div className="text-[13px] leading-snug text-zinc-950 dark:text-zinc-50">
        {summary}
      </div>
    </div>
  );
}
