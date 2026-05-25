"use client";

import { ArrowRight } from "@/app/_components/today/icons";

interface Props {
  step: number;
  totalSteps: number;
  eyebrow: string;
  title: string;
  helper?: string;
  children: React.ReactNode;
  primaryLabel?: string;
  onPrimary: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  // "Looks-and-feels disabled" — visual treatment + aria-disabled, but
  // the click handler still fires so the caller can surface inline
  // validation errors when the user tries to advance. Use `busy` when
  // you need a hard HTML-disabled state (e.g. mid-submit) that
  // prevents the click entirely.
  disabled?: boolean;
  busy?: boolean;
  // Wires `aria-describedby` on the primary button to an inline error
  // span — typically the first failing field's error message — so
  // screen-reader users hear a reason when they land on the disabled
  // Continue button.
  errorDescribedById?: string;
}

// Standard wizard step shell: progress bar + STEP X OF Y row + body +
// sticky action bar with Back / Skip / Primary. Used by all 7 numbered
// steps. Welcome / Generating / Done render their own atmospheric chrome.
export function WizardChrome({
  step,
  totalSteps,
  eyebrow,
  title,
  helper,
  children,
  primaryLabel = "Continue",
  onPrimary,
  onBack,
  onSkip,
  disabled,
  busy,
  errorDescribedById,
}: Props) {
  const pct = (step / totalSteps) * 100;
  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="relative h-[3px] bg-zinc-200 dark:bg-zinc-800">
        <div
          className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mx-auto flex w-full max-w-[640px] items-center justify-between px-4 pt-2.5 pb-1 sm:px-5">
        <span
          className="font-mono text-[10px] font-semibold uppercase text-zinc-500"
          style={{ letterSpacing: "0.2em" }}
        >
          STEP {step} OF {totalSteps}
        </span>
        <button
          type="button"
          onClick={onBack}
          className="bg-transparent font-mono text-[10px] font-medium uppercase text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
          style={{ letterSpacing: "0.16em" }}
        >
          SAVE & EXIT
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 pt-3.5 pb-3 sm:px-5">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
          <div>
            <div
              className="font-mono text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
              style={{ letterSpacing: "0.2em" }}
            >
              — {eyebrow}
            </div>
            <h1
              className="m-0 mt-1 text-[28px] font-medium leading-tight text-zinc-950 dark:text-zinc-50"
              style={{ letterSpacing: "-0.02em" }}
            >
              {title}
            </h1>
            {helper && (
              <p className="m-0 mt-2 text-[13.5px] leading-snug text-zinc-600 dark:text-zinc-400">
                {helper}
              </p>
            )}
          </div>
          {children}
        </div>
      </div>

      <div className="border-t border-zinc-200 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),18px)] sm:px-5 sm:pb-5 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={!onBack || busy}
            className="bg-transparent font-mono text-[11px] font-medium uppercase text-zinc-500 hover:text-zinc-900 disabled:opacity-30 dark:hover:text-zinc-50"
            style={{ letterSpacing: "0.16em" }}
          >
            ← BACK
          </button>
          <div className="flex items-center gap-3.5">
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                disabled={busy}
                className="bg-transparent font-mono text-[11px] font-medium uppercase text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-50"
                style={{ letterSpacing: "0.16em" }}
              >
                SKIP FOR NOW →
              </button>
            )}
            <button
              type="button"
              onClick={onPrimary}
              // `busy` is the only state that hard-disables the button:
              // we want to swallow clicks during submit. When
              // `disabled` is true for a validation reason, the button
              // keeps its visual disabled look (via aria-disabled +
              // matching styles) but the click still fires so the
              // caller can surface inline errors.
              disabled={busy}
              aria-disabled={disabled || busy}
              aria-describedby={errorDescribedById}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:bg-emerald-500"
            >
              {busy ? "Working…" : primaryLabel}
              {!busy && <ArrowRight color="#052e1f" size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
