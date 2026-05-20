"use client";

import Link from "next/link";
import { MotifTopo } from "@/app/_components/today/motifs";

interface Props {
  eyebrow: string;
  title: string;
  body: string;
  // Optional primary CTA — usually a Try Again. Omit for routes where
  // resetting doesn't make sense (404-style).
  primaryLabel?: string;
  onPrimary?: () => void;
  // Optional secondary link — usually "Back to Today".
  secondaryHref?: string;
  secondaryLabel?: string;
  // Short, stable-ish identifier (eg. error.digest) for support.
  requestId?: string;
  // Last segment of the failing route, e.g. "regen".
  route: string;
}

// Shared error frame — same atmospheric topo+radial-fade background the
// regen and wizard interstitials use, so error states feel like part of
// the app's "rest day" vocabulary rather than a generic 500 screen.
export function ErrorShell({
  eyebrow,
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryHref,
  secondaryLabel,
  requestId,
  route,
}: Props) {
  return (
    <div className="relative flex min-h-svh w-full flex-col overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-65 dark:opacity-55"
      >
        <MotifTopo color="#a1a1aa" opacity={0.14} />
      </div>
      <div className="relative mx-auto flex w-full max-w-[480px] flex-1 flex-col items-start justify-center px-6 py-10">
        <div
          className="font-mono text-[12px] font-semibold uppercase text-zinc-500"
          style={{ letterSpacing: "0.2em" }}
        >
          — {eyebrow}
        </div>
        <h1
          className="m-0 mt-3 max-w-[360px] text-[26px] font-medium leading-tight text-zinc-950 dark:text-zinc-50"
          style={{ letterSpacing: "-0.02em" }}
        >
          {title}
        </h1>
        <p className="m-0 mt-3 max-w-[360px] text-[14.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          {body}
        </p>

        <div className="mt-7 flex w-full items-center gap-2.5">
          {primaryLabel && onPrimary && (
            <button
              type="button"
              onClick={onPrimary}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400"
            >
              {primaryLabel}
            </button>
          )}
          {secondaryHref && secondaryLabel && (
            <Link
              href={secondaryHref}
              className="inline-flex h-11 items-center justify-center px-3 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>

        <p
          className="mt-7 font-mono text-[10.5px] uppercase text-zinc-400 dark:text-zinc-600"
          style={{ letterSpacing: "0.18em" }}
        >
          ERROR · {route.toUpperCase()}
          {requestId ? ` · REQ #${requestId.slice(0, 8).toUpperCase()}` : ""}
        </p>
      </div>
    </div>
  );
}
