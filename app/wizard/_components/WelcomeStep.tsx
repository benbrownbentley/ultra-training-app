"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { MotifTopo } from "@/app/_components/today/motifs";
import { VertLogo, ArrowRight } from "@/app/_components/today/icons";
import type { WizardPayload } from "./wizard-types";

interface Props {
  unitSystem: WizardPayload["unitSystem"];
  onUnitsChange: (v: WizardPayload["unitSystem"]) => void;
  onContinue: () => void;
}

// Step 0. Atmospheric, no chrome — single CTA + a subtle units toggle
// that opens a bottom sheet for the locale-default override.
export function WelcomeStep({ unitSystem, onUnitsChange, onContinue }: Props) {
  const [unitsOpen, setUnitsOpen] = useState(false);
  return (
    <div className="relative flex min-h-svh w-full flex-col overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="absolute inset-0">
        <MotifTopo color="#10b981" opacity={0.11} />
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

      <div className="absolute inset-0 flex flex-col items-center px-6 py-12 text-center">
        <div className="mt-10 sm:mt-20">
          <VertLogo size="lg" accent="#10b981" textColor="currentColor" />
        </div>
        <div className="flex-1" />
        <div className="max-w-[360px]">
          <h1
            className="m-0 text-[36px] font-medium leading-[1.05] text-zinc-950 dark:text-zinc-50"
            style={{ letterSpacing: "-0.025em" }}
          >
            Let&apos;s build your plan.
          </h1>
          <p className="m-0 mt-3.5 text-[15.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            We&apos;ll ask about your target race, your fitness, and how you
            like to train. About two minutes.
          </p>
        </div>
        <div className="flex-1" />
        <div className="flex w-full max-w-[360px] flex-col items-center gap-3.5">
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400"
          >
            Get started
            <ArrowRight color="#052e1f" size={16} />
          </button>
          <button
            type="button"
            onClick={() => setUnitsOpen(true)}
            className="inline-flex items-center gap-1.5 bg-transparent px-1.5 py-1 font-mono text-[11px] font-medium uppercase text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
            style={{ letterSpacing: "0.14em" }}
          >
            We&apos;ll use{" "}
            <span className="font-semibold text-zinc-950 dark:text-zinc-50">
              {unitSystem === "metric" ? "Metric" : "Imperial"}
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {unitsOpen && (
        <UnitsSheet
          value={unitSystem}
          onChange={onUnitsChange}
          onClose={() => setUnitsOpen(false)}
        />
      )}
    </div>
  );
}

function UnitsSheet({
  value,
  onChange,
  onClose,
}: {
  value: WizardPayload["unitSystem"];
  onChange: (v: WizardPayload["unitSystem"]) => void;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 font-sans">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/40 dark:bg-black/55"
      />
      <div className="absolute right-0 bottom-0 left-0 rounded-t-[20px] bg-zinc-50 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),22px)] shadow-[0_-16px_48px_rgba(0,0,0,0.35)] sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2 sm:w-[440px] sm:max-w-[92%] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-zinc-200 sm:p-6 dark:bg-zinc-950 dark:sm:border-zinc-800">
        <div className="flex justify-center pb-3.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <span
          className="font-mono text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
          style={{ letterSpacing: "0.2em" }}
        >
          — MEASUREMENT SYSTEM
        </span>
        <div className="mt-3.5">
          <div className="grid grid-cols-2 gap-1 rounded-[10px] border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
            {(["metric", "imperial"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={`rounded-md px-3 py-2.5 text-sm font-semibold transition ${
                  value === opt
                    ? "bg-emerald-500 text-emerald-950"
                    : "bg-transparent text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {opt === "metric" ? "Metric" : "Imperial"}
              </button>
            ))}
          </div>
        </div>
        <p className="m-0 mt-3.5 text-[13px] leading-snug text-zinc-600 dark:text-zinc-400">
          Used for distance, elevation, and weight throughout the app. You can
          change this anytime in Profile → Preferences.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400"
        >
          Done
        </button>
      </div>
    </div>,
    document.body,
  );
}
