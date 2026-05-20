"use client";

// Labelled input used by the change-email and change-password forms.

export function FormField({
  label,
  type = "text",
  value,
  onChange,
  disabled,
  autoFocus,
}: {
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="font-mono text-[10px] uppercase text-zinc-500"
        style={{ letterSpacing: "0.2em" }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-2.5 text-[14px] text-zinc-950 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
      />
    </div>
  );
}
