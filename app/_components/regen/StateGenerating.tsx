import { VertLogo } from "@/app/_components/today/icons";
import { MotifTopo } from "@/app/_components/today/motifs";
import { StatusHeading } from "./atoms";

const STATUS_LINES = [
  "Reading your last 14 days…",
  "Considering your injury history…",
  "Balancing volume and recovery…",
  "Working out your race-week taper…",
];

// Full-bleed loader. Topo motif behind a radial fade; rotating status lines
// in the centre; pulse dots at the bottom. No back link — this state is
// uninterruptible.
export function StateGenerating() {
  return (
    <div className="relative flex min-h-svh w-full flex-col overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="absolute inset-0">
        <MotifTopo color="#10b981" opacity={0.11} />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(250,250,250,0.9) 80%)",
        }}
      />
      <div className="absolute inset-0 hidden dark:block"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(9,9,11,0.9) 80%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="mb-7">
          <VertLogo size="lg" accent="#10b981" textColor="currentColor" />
        </div>

        <StatusHeading label="UPDATING YOUR PLAN" accent />

        <div className="relative mt-[18px] h-[22px] w-full max-w-[320px]">
          {STATUS_LINES.map((line, i) => (
            <div
              key={i}
              className="vert-fade-rotate absolute inset-0 font-mono text-[13px] text-zinc-600 dark:text-zinc-400"
              style={{
                letterSpacing: "0.02em",
                animationDelay: `${i * 2}s`,
              }}
            >
              {line}
            </div>
          ))}
        </div>

        <div className="mt-8 flex gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="vert-pulse-dot inline-block h-2 w-2 rounded-full bg-emerald-500"
              style={{ animationDelay: `${i * 0.25}s` }}
            />
          ))}
        </div>

        <p
          className="absolute bottom-9 font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
          style={{ letterSpacing: "0.18em" }}
        >
          USUALLY 5–15 SECONDS
        </p>
      </div>
    </div>
  );
}
