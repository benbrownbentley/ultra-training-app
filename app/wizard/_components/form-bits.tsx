"use client";

// Tiny shared form primitives — kept here so the step files only worry
// about composition. All visual styling matches the rest of the app.

import { Chip, FormSectionLabel } from "@/app/_components/journal/atoms";
export { Chip, FormSectionLabel };

interface FieldStackProps {
  children: React.ReactNode;
  gap?: number;
}

export function FieldStack({ children, gap = 16 }: FieldStackProps) {
  return (
    <div className="flex flex-col" style={{ gap }}>
      {children}
    </div>
  );
}

export function FieldBlock({
  label,
  required,
  error,
  errorId,
  children,
}: {
  label: string;
  required?: boolean;
  // Inline validation message shown under the field. When set, the
  // field is treated as invalid for accessibility purposes. Only
  // surfaced once the user has "touched" the field — see
  // `useTouched` in WizardClient.
  error?: string;
  // Stable id for the error span so callers can wire aria-describedby
  // from a related control (e.g. the disabled Continue button).
  errorId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FormSectionLabel required={required}>{label}</FormSectionLabel>
      {children}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

export function HelperText({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono text-[10.5px] leading-snug text-zinc-400 dark:text-zinc-600"
      style={{ letterSpacing: "0.04em" }}
    >
      {children}
    </span>
  );
}

// Inline validation message. Visually distinct from the bottom-of-step
// API error banner: smaller, no surrounding chrome, sits directly under
// the offending input. Tone matches the banner so users recognise it
// as the same family of feedback.
export function FieldError({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      id={id}
      role="alert"
      className="font-mono text-[11px] leading-snug text-red-700 dark:text-red-300"
      style={{ letterSpacing: "0.04em" }}
    >
      {children}
    </span>
  );
}

export function TextField({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      placeholder={placeholder}
      className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
    />
  );
}

export function DateField({
  value,
  onChange,
  onBlur,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      className="rounded-[10px] border border-zinc-200 bg-white px-3 py-3 text-[14px] text-zinc-950 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
    />
  );
}

export function SuffixField({
  value,
  onChange,
  onBlur,
  suffix,
  placeholder,
  disabled,
  numeric,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  suffix: string;
  placeholder?: string;
  disabled?: boolean;
  numeric?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 rounded-[10px] border border-zinc-200 bg-white px-3 py-3 focus-within:border-emerald-500 focus-within:ring-[3px] focus-within:ring-emerald-50 dark:border-zinc-800 dark:bg-[#0f0f11]">
      <input
        type={numeric ? "number" : "text"}
        inputMode={numeric ? "numeric" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:outline-none disabled:opacity-60 dark:text-zinc-50"
      />
      <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
        {suffix}
      </span>
    </div>
  );
}

export function TextareaField({
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50"
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly { value: T; label: string }[] | readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const items = (options as readonly unknown[]).map((o) =>
    typeof o === "string"
      ? ({ value: o as T, label: o as string })
      : (o as { value: T; label: string }),
  );
  return (
    <div className="inline-flex flex-wrap gap-1.5">
      {items.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            disabled={disabled}
            aria-pressed={active}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition disabled:opacity-50 ${
              active
                ? "border-emerald-500 bg-emerald-500 text-emerald-950"
                : "border-zinc-200 bg-transparent text-zinc-950 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-50"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function RangeField({
  value,
  onChange,
  min = 1,
  max = 5,
  disabled,
  thumbColour = "#10b981",
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  thumbColour?: string;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full"
      style={{ accentColor: thumbColour }}
    />
  );
}

/**
 * High-prominence variant of RangeField. Used for fields that critically
 * inform the generated plan (currently just SELF-RATED FITNESS — Stress
 * Baseline and other scales stay on the default RangeField). Renders a
 * thicker track, a 24px emerald thumb, and — on screens wide enough —
 * the step labels under each notch with the active one bolded. Mobile
 * relies on the larger readout below the slider instead, since five
 * stacked captions get cramped at phone widths.
 *
 * The cross-browser slider styling lives in globals.css under
 * `.vert-range-prominent`. Tailwind's arbitrary-variant syntax would
 * have worked too, but the rule set is large enough that a named CSS
 * class reads more cleanly and lets us swap the colour for any future
 * prominent slider without duplicating the block.
 */
export function ProminentRangeField({
  value,
  onChange,
  min = 1,
  max = 5,
  disabled,
  labels,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  labels: readonly string[];
  ariaLabel?: string;
}) {
  const currentLabel = labels[value - min] ?? "";
  return (
    <div className="flex flex-col gap-2.5">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-valuetext={`${value} — ${currentLabel}`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="vert-range-prominent w-full"
      />
      {/* Desktop-only caption row — one caption per notch, current
          bolded. Hidden on mobile in favour of the readout the caller
          renders below. */}
      <div className="hidden gap-1 sm:flex">
        {labels.map((lbl, i) => {
          const idx = i + min;
          const active = idx === value;
          return (
            <span
              key={lbl}
              className={`flex-1 text-center font-mono text-[10px] leading-tight ${
                active
                  ? "font-semibold text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-400 dark:text-zinc-600"
              }`}
              style={{ letterSpacing: "0.04em" }}
            >
              {lbl}
            </span>
          );
        })}
      </div>
    </div>
  );
}
