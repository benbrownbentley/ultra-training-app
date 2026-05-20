import { MotifTopo } from "@/app/_components/today/motifs";
import { StatusHeading } from "./atoms";

// Confirmation interstitial. The design says it auto-routes back to Today
// after ~1.5s; we leave that opt-in for now (client-side redirect would
// require a "use client" boundary just for setTimeout) — the page renders
// the visual state and any nav lands you on Today via the bottom button.
export function StateAccepted() {
  return (
    <div className="relative flex min-h-svh w-full flex-col overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="absolute inset-0">
        <MotifTopo color="#10b981" opacity={0.09} />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(250,250,250,0.85) 80%)",
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(9,9,11,0.85) 80%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 py-10 text-center">
        <div
          className="mb-6 inline-flex h-[88px] w-[88px] items-center justify-center rounded-full border border-emerald-500 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/[0.08]"
          style={{ boxShadow: "0 12px 36px rgba(16,185,129,0.20)" }}
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5l4.5 4.5L19 7"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <StatusHeading label="PLAN UPDATED · YOU'RE ALL SET" accent />

        <p className="mt-3.5 max-w-[280px] text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Heading back to today. We&apos;ll surface a small heads-up there so
          you can scan what&apos;s new.
        </p>

        <p
          className="absolute bottom-9 font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
          style={{ letterSpacing: "0.18em" }}
        >
          RETURNING TO TODAY…
        </p>
      </div>
    </div>
  );
}
