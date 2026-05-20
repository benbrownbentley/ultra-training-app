// Shared workout-detail atoms — small presentational blocks composed by the
// per-variant body components. None of these own state; the parent decides
// what data they render.

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
// Static read-only display of a planned vs actual value. Editing comes in a
// later milestone — for v1 we surface the design's layout so users see what
// the log will look like when it fills in.
export function FieldRow({
  label,
  value,
  unit,
  target,
  required,
  disabled,
}: {
  label: string;
  value: string;
  unit?: string;
  target?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={`grid items-center gap-4 rounded-[10px] border border-zinc-200 px-3.5 py-3 dark:border-zinc-800 ${
        disabled
          ? "opacity-55"
          : "bg-white dark:bg-[#0f0f11]"
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
        <span
          className="font-mono text-[18px] font-medium text-zinc-950 dark:text-zinc-50"
          style={{ letterSpacing: "-0.01em" }}
        >
          {value}
        </span>
        {unit && (
          <span className="font-mono text-[12px] text-zinc-500">{unit}</span>
        )}
      </div>
    </div>
  );
}

// ─── Disclosure row ─────────────────────────────────────────
// Dashed-border "+ Add …" affordance. Non-interactive placeholder for v1 —
// surfaces the option without wiring up the editing flow yet.
export function DisclosureRow({
  label,
  disabled,
}: {
  label: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex w-full items-center gap-2 rounded-[10px] border border-dashed border-zinc-200 px-3.5 py-2.5 text-left text-[13px] font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 ${
        disabled ? "opacity-55" : ""
      }`}
    >
      <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 5v14M5 12h14"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {label}
    </div>
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
// Read-only display in v1: surfaces the user's previously-saved note when
// the workout is logged, or an empty dashed placeholder otherwise.
export function NotesField({
  value,
  disabled,
}: {
  value?: string;
  disabled?: boolean;
}) {
  const hasContent = (value ?? "").length > 0;
  return (
    <div
      className={`rounded-[10px] border px-3.5 py-3 text-[13px] leading-relaxed ${
        hasContent
          ? "border-zinc-200 bg-white text-zinc-950 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50"
          : "border-dashed border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
      } ${disabled ? "opacity-55" : ""}`}
    >
      {hasContent
        ? value
        : "Add a note about how the session felt, weather, route, anything Claude should weigh into the next plan update."}
    </div>
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

// ─── Effort slider (read-only display) ──────────────────────
// 1–10 perceived effort. Renders as a horizontal bar with an emerald fill
// up to the current value. v1 is display-only; editing comes later.
export function EffortSlider({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(10, value)) * 10;
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
          {value || "—"}
          <span className="ml-1 text-zinc-400 dark:text-zinc-600">/ 10</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <span
          className="block h-full rounded-full bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Pain slider (Physio) ───────────────────────────────────
// 1–10 pain rating. The bar shifts from emerald → amber → red as the value
// climbs, so a glance reveals which exercises are flagging.
export function PainSlider({ value }: { value: number | null }) {
  const v = value ?? 0;
  const pct = Math.max(0, Math.min(10, v)) * 10;
  const colour =
    v <= 3
      ? "#10b981"
      : v <= 6
        ? "#d97706"
        : "#dc2626";
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
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <span
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, background: colour }}
        />
      </div>
    </div>
  );
}

// ─── DoneToggle (Mobility) ──────────────────────────────────
// Big tap target that flips the whole routine from pending → done.
// Wraps a server-action call upstream; v1 renders it static.
export function DoneToggle({
  done,
  label,
}: {
  done: boolean;
  label?: string;
}) {
  return (
    <div
      className={`flex w-full items-center justify-between gap-3 rounded-[12px] border px-4 py-4 transition active:scale-[0.99] ${
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
    </div>
  );
}

// ─── Routine row (Mobility) ─────────────────────────────────
export function RoutineRow({
  name,
  spec,
  done,
}: {
  name: string;
  spec?: string;
  done?: boolean;
}) {
  return (
    <div
      className="grid items-center gap-3 rounded-[10px] border border-zinc-200 bg-white px-3.5 py-2.5 dark:border-zinc-800 dark:bg-[#0f0f11]"
      style={{ gridTemplateColumns: "auto 1fr auto" }}
    >
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
    </div>
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
export function PhysioExerciseRow({
  name,
  spec,
  pain,
  notes,
  done,
}: {
  name: string;
  spec?: string;
  pain: number | null;
  notes?: string;
  done?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 dark:border-zinc-800 dark:bg-[#0f0f11]">
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 inline-flex h-[22px] w-[22px] items-center justify-center rounded-md border-[1.5px] ${
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
        </span>
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
      <PainSlider value={pain} />
      <div
        className={`min-h-[28px] rounded-md border border-dashed px-2.5 py-1.5 text-[12.5px] leading-snug ${
          notes
            ? "border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
            : "border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
        }`}
      >
        {notes ?? "note (optional)"}
      </div>
    </div>
  );
}
