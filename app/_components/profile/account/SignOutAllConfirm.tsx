"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// Keeps the portal off the SSR render without tripping the
// setState-in-effect lint rule.
const noopSubscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function SignOutAllConfirm({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  const isClient = useIsClient();
  if (!isClient) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 font-sans">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-zinc-950/45 dark:bg-black/60"
      />
      <div className="absolute right-0 bottom-0 left-0 rounded-t-[20px] bg-zinc-50 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),22px)] shadow-[0_-16px_48px_rgba(0,0,0,0.35)] sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2 sm:w-[440px] sm:max-w-[92%] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-zinc-200 sm:p-6 dark:bg-zinc-950 dark:sm:border-zinc-800">
        <div className="flex justify-center pb-3.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div
          className="font-mono text-[10.5px] font-semibold uppercase text-red-600 dark:text-red-500"
          style={{ letterSpacing: "0.2em" }}
        >
          — SIGN OUT EVERYWHERE
        </div>
        <h2
          className="m-0 mt-2 mb-2 text-[20px] font-medium text-zinc-950 dark:text-zinc-50"
          style={{ letterSpacing: "-0.015em" }}
        >
          Sign out of all devices?
        </h2>
        <p className="m-0 mb-5 text-sm leading-snug text-zinc-600 dark:text-zinc-400">
          Every active session will be revoked. You&apos;ll need to sign back
          in everywhere.
        </p>
        <div className="flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="text-[14px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-11 items-center justify-center rounded-[10px] border border-red-700 bg-red-600 px-4 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(220,38,38,0.28)] transition hover:bg-red-500"
          >
            Sign out everywhere
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
