import * as React from "react";

import { ElevationProfile } from "./elevation-profile";
import { TopoBackground } from "./topo-background";
import { VertLogo } from "./vert-logo";

// Race context for the left panel. Lifted to a constant so it's trivial to
// move to props or a CMS once we have more than one target race.
const RACE = {
  block: "18-WEEK BUILD · UTMB 2026",
  stats: [
    ["DISTANCE", "171.5", "km"],
    ["VERT GAIN", "10 040", "m"],
    ["CUTOFF", "46:30", "hrs"],
  ] as const,
};

/**
 * Shared chrome for every auth screen — the two-column grid, the dark trail
 * panel on the left, and the centred right-pane content slot. Sign-in/sign-up
 * (AuthSplit) and the password-reset routes all compose this so the layout
 * stays pixel-identical across the flow. Only the right-pane content differs.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen w-full bg-zinc-50 text-zinc-950 lg:grid-cols-[1.05fr_1fr] dark:bg-zinc-950 dark:text-zinc-50">
      {/* LEFT — trail panel (always dark green, hidden below lg) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-b from-[#052e1f] via-[#064e3b] to-[#065f46] p-9 text-emerald-50 lg:flex dark:from-[#020a07] dark:via-[#052e1f] dark:to-[#064e3b]">
        <TopoBackground color="#34d399" opacity={0.22} dense />

        <div className="relative">
          <VertLogo size="lg" className="text-emerald-50" />
        </div>

        <div className="relative">
          <div className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-300">
            {RACE.block}
          </div>
          <h2 className="max-w-[360px] text-[42px] font-medium leading-[1.05] tracking-[-0.02em]">
            Train for the
            <br />
            distance that
            <br />
            scares you.
          </h2>
        </div>

        <div className="relative border-t border-emerald-300/25 pt-4.5">
          <ElevationProfile
            stroke="#6ee7b7"
            fill="rgba(110,231,183,0.18)"
            height={70}
            width={360}
          />
          <div className="mt-3.5 grid grid-cols-3 gap-4.5">
            {RACE.stats.map(([label, value, unit]) => (
              <div key={label}>
                <div className="font-mono text-[10px] tracking-[0.18em] text-emerald-300">
                  {label}
                </div>
                <div className="mt-1 font-mono text-[22px] font-medium tracking-[-0.01em]">
                  {value}
                  <span className="ml-1 text-[11px] text-emerald-200">{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* RIGHT — page-specific content */}
      <main className="flex flex-col justify-center px-6 py-12 sm:px-14 sm:py-14">
        <div className="mx-auto w-full max-w-[360px]">
          {/* Mobile-only logo above the content (the trail panel is hidden) */}
          <div className="mb-8 lg:hidden">
            <VertLogo size="md" />
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
