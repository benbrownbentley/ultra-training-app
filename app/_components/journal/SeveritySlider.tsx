"use client";

// Simple emerald-to-amber-to-red severity slider. Renders as a native
// <input type="range"> so platform accessibility (keyboard + screen reader)
// works out of the box; the gradient is purely visual.

interface Props {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
}

function colourFor(value: number): string {
  if (value <= 3) return "#10b981";
  if (value <= 6) return "#d97706";
  return "#dc2626";
}

export function SeveritySlider({
  value,
  onChange,
  disabled,
  min = 1,
  max = 10,
}: Props) {
  const thumbColour = colourFor(value);
  return (
    <div className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 dark:border-zinc-800 dark:bg-[#0f0f11]">
      <div className="flex items-baseline justify-between">
        <span
          className="font-mono text-[10px] uppercase text-zinc-500"
          style={{ letterSpacing: "0.2em" }}
        >
          SEVERITY · 1 NONE — 10 SEVERE
        </span>
        <span
          className="font-mono text-[12px] font-medium"
          style={{ color: thumbColour }}
        >
          {value} / 10
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="mt-2 block w-full cursor-pointer disabled:cursor-not-allowed"
        style={{
          accentColor: thumbColour,
        }}
      />
      <div className="mt-1 flex items-center justify-between">
        <span
          className="font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
          style={{ letterSpacing: "0.14em" }}
        >
          MILD
        </span>
        <span
          className="font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
          style={{ letterSpacing: "0.14em" }}
        >
          SEVERE
        </span>
      </div>
    </div>
  );
}
