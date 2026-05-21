"use client";

// Shared workout-detail atoms — small presentational blocks composed by the
// per-variant body components. None of these own state; the parent (the
// ActualsForm) passes value + onChange so the entire form's state lives in
// one place and one save round-trip captures everything.

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "@/app/_components/today/icons";

// ─── Zone pill ──────────────────────────────────────────────
// "Z1", "Z3", "Z1–Z2". The "high" emphasis variant gets an emerald border
// to mark the work zone of a segment.
export function ZonePill({
  zone,
  emphasis = "low",
}: {
  zone: string;
  emphasis?: "low" | "high";
}) {
  return (
    <span
      className={`whitespace-nowrap rounded-[4px] border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
        emphasis === "high"
          ? "border-emerald-300 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400"
          : "border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
      }`}
      style={{ letterSpacing: "0.1em" }}
    >
      {zone}
    </span>
  );
}

// ─── Segment row ────────────────────────────────────────────
// One row of the STRUCTURE block — emerald accent stripe on the left for
// the "work" segment, dim grey for warm-up / cool-down.
export function SegmentRow({
  name,
  value,
  zone,
  note,
  emphasis = "low",
}: {
  name: string;
  value: string;
  zone?: string;
  note?: string;
  emphasis?: "low" | "high";
}) {
  return (
    <div
      className="grid items-start gap-3 border-t border-zinc-200 py-3 first:border-t-0 dark:border-zinc-800"
      style={{ gridTemplateColumns: "3px 1fr auto" }}
    >
      <span
        className={`mt-1 h-5 w-[3px] rounded-[2px] ${
          emphasis === "high"
            ? "bg-emerald-500"
            : "bg-zinc-200 dark:bg-zinc-800"
        }`}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[14px] font-medium leading-tight text-zinc-950 dark:text-zinc-50">
          {name}
        </span>
        <div className="font-mono text-[12px] leading-snug text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-950 dark:text-zinc-50">
            {value}
          </span>
          {note && (
            <>
              <span className="mx-1.5 text-zinc-400 dark:text-zinc-600">·</span>
              <span>{note}</span>
            </>
          )}
        </div>
      </div>
      {zone && (
        <div className="mt-0.5">
          <ZonePill zone={zone} emphasis={emphasis} />
        </div>
      )}
    </div>
  );
}

// ─── Field row ──────────────────────────────────────────────
// Controlled numeric input. `value` is the parsed number (or null when
// empty); `onChange` fires on every keystroke. Visually identical to the
// prior read-only version when no value is present — placeholder "—" reads
// as the target glyph the design used.
export function FieldRow({
  label,
  value,
  onChange,
  unit,
  target,
  required,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange?: (next: number | null) => void;
  unit?: string;
  target?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const readOnly = !onChange;
  return (
    <label
      className={`grid items-center gap-4 rounded-[10px] border border-zinc-200 px-3.5 py-3 dark:border-zinc-800 ${
        disabled ? "opacity-55" : "bg-white dark:bg-[#0f0f11]"
      }`}
      style={{ gridTemplateColumns: "1fr auto" }}
    >
      <div className="flex flex-col gap-1">
        <span
          className="whitespace-nowrap font-mono text-[10px] uppercase text-zinc-500"
          style={{ letterSpacing: "0.2em" }}
        >
          {label}
          {required && (
            <span className="ml-1 text-emerald-600 dark:text-emerald-400">
              *
            </span>
          )}
        </span>
        {target && (
          <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-600">
            target {target}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          value={value ?? ""}
          readOnly={readOnly}
          onChange={(e) => {
            if (!onChange) return;
            const v = e.target.value;
            onChange(v === "" ? null : Number(v));
          }}
          disabled={disabled}
          placeholder="—"
          className="w-20 rounded bg-transparent pr-1.5 text-right font-mono text-[18px] font-medium text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:placeholder:text-transparent disabled:cursor-not-allowed dark:text-zinc-50 dark:placeholder:text-zinc-600 [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
          style={{ letterSpacing: "-0.01em" }}
        />
        {unit && (
          // Fixed-width suffix so the input's right edge — and therefore
          // the em-dash placeholder — sits at the same x position across
          // every row regardless of which unit text ("min"/"km"/"bpm")
          // fills the suffix slot. w-8 fits the widest ("bpm") with breathing
          // room; text-left keeps the unit hugging the input's edge.
          <span className="inline-block w-8 text-left font-mono text-[12px] text-zinc-500">
            {unit}
          </span>
        )}
      </div>
    </label>
  );
}

// ─── Time-in-zone bar ───────────────────────────────────────
// Stacked emerald-saturation segments. Driven by `zones`, an array of
// `{ label: 'Z3', minutes: 42 }`. Total minutes are summed for the right-
// aligned caption.
const ZONE_COLOURS: Record<string, string> = {
  Z1: "#a7f3d0",
  Z2: "#6ee7b7",
  Z3: "#34d399",
  Z4: "#10b981",
  Z5: "#047857",
};

export function TimeInZoneBar({
  zones,
}: {
  zones: { label: string; minutes: number }[];
}) {
  const total = zones.reduce((acc, z) => acc + z.minutes, 0);
  if (total === 0) return null;
  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 dark:border-zinc-800 dark:bg-[#0f0f11]">
      <div className="flex items-baseline justify-between">
        <span
          className="font-mono text-[10px] uppercase text-zinc-500"
          style={{ letterSpacing: "0.2em" }}
        >
          TIME IN ZONE
        </span>
        <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-600">
          {total} min total
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        {zones.map((z) => (
          <span
            key={z.label}
            style={{
              width: `${(z.minutes / total) * 100}%`,
              background: ZONE_COLOURS[z.label] ?? "#10b981",
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2.5">
        {zones.map((z) => (
          <span
            key={z.label}
            className="inline-flex items-baseline gap-1 font-mono text-[11px] text-zinc-600 dark:text-zinc-400"
          >
            <span
              className="inline-block h-[7px] w-[7px] rounded-full"
              style={{ background: ZONE_COLOURS[z.label] ?? "#10b981" }}
            />
            {z.label}
            <span className="font-medium text-zinc-950 dark:text-zinc-50">
              {z.minutes}
            </span>
            min
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Notes field ────────────────────────────────────────────
// Controlled textarea. The dashed placeholder treatment is reproduced via
// CSS placeholder styling so the visual matches the prior read-only state
// before the user types.
export function NotesField({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange?: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const readOnly = !onChange;
  return (
    <textarea
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      readOnly={readOnly}
      disabled={disabled}
      placeholder={
        placeholder ??
        "Add a note about how the session felt, weather, route, anything Claude should weigh into the next plan update."
      }
      className={`min-h-[80px] w-full resize-y rounded-[10px] border bg-white px-3.5 py-3 text-[13px] leading-relaxed text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-55 dark:bg-[#0f0f11] dark:text-zinc-50 dark:placeholder:text-zinc-600 ${
        value.length === 0
          ? "border-dashed border-zinc-200 dark:border-zinc-800"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    />
  );
}

// ─── Why paragraph + glossary link ─────────────────────────
export function WhyParagraph({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-[14.5px] leading-relaxed text-zinc-950 dark:text-zinc-50">
      {children}
    </p>
  );
}

export function GlossaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="mt-2.5 inline-flex items-center gap-1 text-[13.5px] font-medium text-emerald-700 transition active:scale-[0.97] hover:underline dark:text-emerald-400"
    >
      {children}
      <ArrowRight color="currentColor" size={13} />
    </Link>
  );
}

// ─── Warm-up callout (Strength) ─────────────────────────────
export function WarmupCallout({
  duration,
  note,
  items,
}: {
  duration: string;
  note: string;
  items: string[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3.5 py-3 dark:border-emerald-500/35 dark:bg-emerald-500/[0.08]">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="font-mono text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
          style={{ letterSpacing: "0.2em" }}
        >
          — WARM UP FIRST
        </span>
        <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
          {duration}
        </span>
      </div>
      <p className="m-0 text-[13.5px] leading-snug text-zinc-950 dark:text-zinc-50">
        {note}
      </p>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex gap-1.5 font-mono text-[11.5px] text-zinc-600 dark:text-zinc-400"
          >
            <span className="text-emerald-500">›</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Fueling callout (Hike) ─────────────────────────────────
export function FuelingCallout({ body }: { body: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 dark:border-emerald-500/35 dark:bg-emerald-500/[0.08]">
      <span
        className="whitespace-nowrap font-mono text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
        style={{ letterSpacing: "0.2em" }}
      >
        — FUEL
      </span>
      <span className="font-mono text-[12.5px] leading-snug text-zinc-950 dark:text-zinc-50">
        {body}
      </span>
    </div>
  );
}

// ─── Effort slider ──────────────────────────────────────────
// 1–10 perceived effort. Native <input type="range"> for tap-and-drag —
// `accent-emerald-500` skins the thumb so the visual still reads as the
// app's primary accent on both iOS and Android browsers.
export function EffortSlider({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange?: (next: number) => void;
  disabled?: boolean;
}) {
  const v = value ?? 0;
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 dark:border-zinc-800 dark:bg-[#0f0f11]">
      <div className="flex items-baseline justify-between">
        <span
          className="font-mono text-[10px] uppercase text-zinc-500"
          style={{ letterSpacing: "0.2em" }}
        >
          PERCEIVED EFFORT
        </span>
        <span className="font-mono text-[12px] font-medium text-zinc-950 dark:text-zinc-50">
          {value ?? "—"}
          <span className="ml-1 text-zinc-400 dark:text-zinc-600">/ 10</span>
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={v || 1}
        onChange={(e) => onChange?.(Number(e.target.value))}
        disabled={disabled || !onChange}
        className="w-full accent-emerald-500 disabled:opacity-55"
        aria-label="Perceived effort, 1 to 10"
      />
    </div>
  );
}

// ─── Pain slider (Physio) ───────────────────────────────────
// 1–10 pain rating. Colour shifts from emerald → amber → red as the value
// climbs so a glance reveals which exercises are flagging. The native range
// input drives interaction; the coloured bar underneath keeps the design
// language.
export function PainSlider({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange?: (next: number) => void;
  disabled?: boolean;
}) {
  const v = value ?? 0;
  const pct = Math.max(0, Math.min(10, v)) * 10;
  const colour =
    v <= 3 ? "#10b981" : v <= 6 ? "#d97706" : "#dc2626";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span
          className="font-mono text-[10px] uppercase text-zinc-500"
          style={{ letterSpacing: "0.2em" }}
        >
          PAIN
        </span>
        <span className="font-mono text-[12px] font-medium text-zinc-950 dark:text-zinc-50">
          {value ?? "—"}
          <span className="ml-1 text-zinc-400 dark:text-zinc-600">/ 10</span>
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <span
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, background: colour }}
        />
      </div>
      {onChange && (
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full disabled:opacity-55"
          style={{ accentColor: colour }}
          aria-label="Pain, 0 to 10"
        />
      )}
    </div>
  );
}

// ─── DoneToggle (Mobility) ──────────────────────────────────
// Big tap target that flips the whole routine from pending → done. Wires
// to logWorkout upstream via onChange; the page passes its current status
// in via `done` so this stays a controlled, presentational atom.
export function DoneToggle({
  done,
  onChange,
  label,
  disabled,
}: {
  done: boolean;
  onChange?: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange?.(!done)}
      disabled={disabled || !onChange}
      className={`flex w-full items-center justify-between gap-3 rounded-[12px] border px-4 py-4 transition active:scale-[0.99] disabled:cursor-not-allowed ${
        done
          ? "border-emerald-500 bg-emerald-500 text-emerald-950 shadow-[0_8px_22px_rgba(16,185,129,0.28)]"
          : "border-zinc-200 bg-white text-zinc-950 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50"
      }`}
    >
      <span className="flex items-center gap-3">
        <span
          className={`inline-flex h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] ${
            done
              ? "border-emerald-900 bg-emerald-900"
              : "border-zinc-200 dark:border-zinc-800"
          }`}
        >
          {done && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12l5 5L20 7"
                stroke="#10b981"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span className="text-[16px] font-semibold">
          {label ?? (done ? "Marked done" : "Mark this whole routine done")}
        </span>
      </span>
      <span
        className={`whitespace-nowrap font-mono text-[10px] uppercase opacity-75 ${
          done ? "text-emerald-950" : "text-zinc-400 dark:text-zinc-600"
        }`}
        style={{ letterSpacing: "0.2em" }}
      >
        TAP
      </span>
    </button>
  );
}

// ─── Routine row (Mobility) ─────────────────────────────────
// Per-exercise checkbox. Wrapped in a button when `onChange` is provided
// so the whole row is tap-target; reverts to a static div for read-only.
export function RoutineRow({
  name,
  spec,
  done = false,
  onChange,
  disabled,
}: {
  name: string;
  spec?: string;
  done?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <span
        className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border-[1.5px] ${
          done
            ? "border-emerald-500 bg-emerald-500"
            : "border-zinc-200 dark:border-zinc-800"
        }`}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12l5 5L20 7"
              stroke="#052e1f"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="text-[14px] font-medium text-zinc-950 dark:text-zinc-50">
        {name}
      </span>
      {spec && (
        <span className="whitespace-nowrap font-mono text-[11.5px] text-zinc-600 dark:text-zinc-400">
          {spec}
        </span>
      )}
    </>
  );
  const gridStyle = { gridTemplateColumns: "auto 1fr auto" };
  if (!onChange) {
    return (
      <div
        className="grid items-center gap-3 rounded-[10px] border border-zinc-200 bg-white px-3.5 py-2.5 dark:border-zinc-800 dark:bg-[#0f0f11]"
        style={gridStyle}
      >
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onChange(!done)}
      disabled={disabled}
      className="grid items-center gap-3 rounded-[10px] border border-zinc-200 bg-white px-3.5 py-2.5 text-left transition active:scale-[0.99] disabled:opacity-55 dark:border-zinc-800 dark:bg-[#0f0f11]"
      style={gridStyle}
    >
      {inner}
    </button>
  );
}

// ─── Exercise row (Strength, collapsed) ─────────────────────
export function ExerciseRow({
  name,
  sets,
  reps,
  weight,
  unit,
  equip,
  note,
  isTime,
}: {
  name: string;
  sets: number;
  reps: number;
  weight?: string;
  unit?: string;
  equip?: string;
  note?: string;
  isTime?: boolean;
}) {
  const setsLabel = isTime ? `${sets} × ${reps}s` : `${sets} × ${reps}`;
  return (
    <div className="grid items-center gap-2.5 rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 dark:border-zinc-800 dark:bg-[#0f0f11]">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[14.5px] font-medium text-zinc-950 dark:text-zinc-50">
            {name}
          </span>
          {equip && (
            <span
              className="whitespace-nowrap rounded-[4px] border border-zinc-200 px-1.5 py-0.5 font-mono text-[10px] uppercase text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
              style={{ letterSpacing: "0.12em" }}
            >
              {equip}
            </span>
          )}
        </div>
        <span className="font-mono text-[11.5px] text-zinc-600 dark:text-zinc-400">
          {setsLabel}
          {weight && (
            <>
              {" · "}
              {weight}
              {unit && ` ${unit}`}
            </>
          )}
          {note && ` · ${note}`}
        </span>
      </div>
    </div>
  );
}

// ─── Physio exercise row ────────────────────────────────────
// Controlled. `done`, `pain`, `note` come from the parent's actuals state;
// each field has its own onChange so a single typed character doesn't have
// to round-trip the whole exercise row through the parent.
export function PhysioExerciseRow({
  name,
  spec,
  pain,
  notes,
  done = false,
  onChangeDone,
  onChangePain,
  onChangeNote,
  disabled,
}: {
  name: string;
  spec?: string;
  pain: number | null;
  notes?: string;
  done?: boolean;
  onChangeDone?: (next: boolean) => void;
  onChangePain?: (next: number) => void;
  onChangeNote?: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 dark:border-zinc-800 dark:bg-[#0f0f11]">
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => onChangeDone?.(!done)}
          disabled={disabled || !onChangeDone}
          aria-label={done ? "Mark not done" : "Mark done"}
          className={`mt-0.5 inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-[1.5px] transition active:scale-[0.94] ${
            done
              ? "border-emerald-500 bg-emerald-500"
              : "border-zinc-200 dark:border-zinc-800"
          }`}
        >
          {done && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12l5 5L20 7"
                stroke="#052e1f"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <div className="flex flex-1 flex-wrap items-baseline justify-between gap-2.5">
          <span className="text-[14px] font-medium text-zinc-950 dark:text-zinc-50">
            {name}
          </span>
          {spec && (
            <span className="font-mono text-[11.5px] text-zinc-600 dark:text-zinc-400">
              {spec}
            </span>
          )}
        </div>
      </div>
      <PainSlider value={pain} onChange={onChangePain} disabled={disabled} />
      <input
        type="text"
        value={notes ?? ""}
        onChange={(e) => onChangeNote?.(e.target.value)}
        readOnly={!onChangeNote}
        disabled={disabled}
        placeholder="note (optional)"
        className="min-h-[28px] rounded-md border border-dashed border-zinc-200 bg-transparent px-2.5 py-1.5 text-[12.5px] leading-snug text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-600"
      />
    </div>
  );
}
