"use client";

// Shared profile-tab UI atoms: grouped settings list, segmented control,
// toggle row, action row, header. Reused across profile landing + sub-routes.

import Link from "next/link";

// Grouped section frame — title above, single bordered card containing
// the rows. Mirrors the iOS Settings list convention.
export function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className="font-mono text-[10px] uppercase text-zinc-500"
        style={{ letterSpacing: "0.2em" }}
      >
        — {label}
      </span>
      <div className="overflow-hidden rounded-[14px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0f0f11]">
        {children}
      </div>
    </div>
  );
}

export function RowDivider() {
  return <div className="border-t border-zinc-200 dark:border-zinc-800" />;
}

// Tappable row routing to a sub-page (Settings → detail screen).
export function SettingsRow({
  label,
  sub,
  hint,
  href,
}: {
  label: string;
  sub?: string;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14.5px] font-medium text-zinc-950 dark:text-zinc-50">
          {label}
        </span>
        {sub && (
          <span className="text-[12.5px] leading-snug text-zinc-600 dark:text-zinc-400">
            {sub}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        {hint && (
          <span className="font-mono text-[11.5px] text-zinc-500 dark:text-zinc-400">
            {hint}
          </span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-zinc-400 dark:text-zinc-600"
          />
        </svg>
      </div>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      {inner}
    </div>
  );
}

type ActionTone = "default" | "accent" | "destructive";

// Single-tap row (sign out, export, delete). Optionally posts a form via
// `formAction` so destructive actions can be wired to server actions.
export function ActionRow({
  label,
  tone = "default",
  onClick,
  href,
}: {
  label: string;
  tone?: ActionTone;
  onClick?: () => void;
  href?: string;
}) {
  const colour =
    tone === "destructive"
      ? "text-red-600 dark:text-red-500"
      : tone === "accent"
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-zinc-950 dark:text-zinc-50";

  if (href) {
    return (
      <Link
        href={href}
        className={`flex w-full items-center justify-between px-4 py-3.5 text-left text-[14.5px] font-medium ${colour}`}
      >
        {label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between px-4 py-3.5 text-left text-[14.5px] font-medium ${colour}`}
    >
      {label}
    </button>
  );
}

export function DisplayRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className="font-mono text-[10px] uppercase text-zinc-500"
          style={{ letterSpacing: "0.2em" }}
        >
          {label}
        </span>
        <span className="text-[14px] text-zinc-950 dark:text-zinc-50">
          {value}
        </span>
      </div>
      {hint && (
        <span className="font-mono text-[12px] text-zinc-500">{hint}</span>
      )}
    </div>
  );
}

// Visual-only segmented control. Wired up to a real value via `value` +
// `onChange`; renders as a horizontal pill group with the active option
// emerald-filled.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  disabled,
}: {
  options: readonly T[];
  value: T | null;
  onChange?: (v: T) => void;
  size?: "md" | "sm";
  disabled?: boolean;
}) {
  const padding = size === "sm" ? "px-3 py-1.5" : "px-4 py-2";
  return (
    <div className="inline-flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={onChange ? () => onChange(opt) : undefined}
            disabled={disabled}
            aria-pressed={active}
            className={`rounded-full border ${padding} text-[13px] font-medium transition disabled:opacity-50 ${
              active
                ? "border-emerald-500 bg-emerald-500 text-emerald-950"
                : "border-zinc-200 bg-transparent text-zinc-950 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-50"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// Settings row with a right-aligned segmented control. Both `onChange`
// and `disabled` are wired through to the underlying SegmentedControl
// so callers can drive a server action via useTransition.
export function SegmentedRow<T extends string>({
  label,
  helper,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  helper?: string;
  options: readonly T[];
  value: T | null;
  onChange?: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14.5px] font-medium text-zinc-950 dark:text-zinc-50">
          {label}
        </span>
        <SegmentedControl
          options={options}
          value={value}
          onChange={onChange}
          disabled={disabled}
          size="sm"
        />
      </div>
      {helper && (
        <span className="text-[12px] leading-snug text-zinc-500 dark:text-zinc-400">
          {helper}
        </span>
      )}
    </div>
  );
}

// Toggle row backed by a controlled bool. Caller drives the value + flip
// callback (typically through useTransition + a server action).
export function ToggleRow({
  label,
  sub,
  value,
  onChange,
  disabled,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14.5px] font-medium text-zinc-950 dark:text-zinc-50">
          {label}
        </span>
        {sub && (
          <span className="text-[12.5px] leading-snug text-zinc-600 dark:text-zinc-400">
            {sub}
          </span>
        )}
      </div>
      <Toggle value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={onChange ? () => onChange(!value) : undefined}
      className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full transition disabled:opacity-50 ${
        value
          ? "bg-emerald-500"
          : "bg-zinc-200 dark:bg-zinc-800"
      }`}
    >
      <span
        className={`absolute top-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transition ${
          value ? "left-4" : "left-0.5"
        }`}
      />
    </button>
  );
}
