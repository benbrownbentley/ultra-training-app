"use client";

// Slide-up toast for log/unlog activity on the Today card.
//
// Two variants, discriminated by `kind`:
//   • "logged" — fires after a Log-done tap. Shows "LOGGED · {title}"
//     with an "Add actuals →" link into the drill-down.
//   • "unlogged" — fires after an Unlog tap. Shows "UNLOGGED ·
//     {title}" with an "Undo →" button that flips the status back.
//
// Auto-dismisses after 5 seconds; the user can tap the body or the
// close glyph to dismiss sooner. Owned at the page level via the
// LoggedToastProvider context so any card can fire one with a single
// hook call.

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowRight } from "./icons";

type ToastState =
  | { kind: "logged"; workoutId: number; title: string }
  | {
      kind: "unlogged";
      workoutId: number;
      title: string;
      // Fires when the user taps Undo within the 5-second window.
      // Caller is responsible for re-logging (logWorkout(id,
      // "completed")) — the toast doesn't know about server actions.
      onUndo: () => void;
    };

interface ToastContextShape {
  show: (next: ToastState) => void;
}

const ToastContext = createContext<ToastContextShape | null>(null);

const AUTO_DISMISS_MS = 5000;

export function LoggedToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToastState | null>(null);
  const dismissHandle = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    if (dismissHandle.current != null) {
      window.clearTimeout(dismissHandle.current);
      dismissHandle.current = null;
    }
    setState(null);
  }, []);

  const show = useCallback(
    (next: ToastState) => {
      // Re-arm the dismiss timer so a second toast doesn't disappear in
      // the middle of being read.
      if (dismissHandle.current != null) {
        window.clearTimeout(dismissHandle.current);
      }
      setState(next);
      dismissHandle.current = window.setTimeout(() => {
        setState(null);
        dismissHandle.current = null;
      }, AUTO_DISMISS_MS);
    },
    [],
  );

  // Cleanup on unmount so a stale timer can't fire after the page navigates.
  useEffect(() => {
    return () => {
      if (dismissHandle.current != null) {
        window.clearTimeout(dismissHandle.current);
      }
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {state && (
        <div
          // Sits above the sticky TabBar but below modal sheets. Centred
          // and capped so it doesn't stretch on desktop.
          className="pointer-events-none fixed inset-x-0 bottom-[78px] z-40 flex justify-center px-4 sm:bottom-[88px]"
          role="status"
          aria-live="polite"
        >
          <div
            className={`pointer-events-auto flex max-w-[420px] flex-1 items-center justify-between gap-3 rounded-[12px] border bg-white px-3.5 py-2.5 dark:bg-[#0f0f11] ${
              state.kind === "logged"
                ? "border-emerald-200 shadow-[0_12px_30px_rgba(16,185,129,0.18)] dark:border-emerald-500/35"
                : "border-zinc-200 shadow-[0_12px_30px_rgba(0,0,0,0.12)] dark:border-zinc-700"
            }`}
          >
            <div className="flex flex-col gap-0.5">
              <span
                className={`font-mono text-[10px] font-semibold uppercase ${
                  state.kind === "logged"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
                style={{ letterSpacing: "0.2em" }}
              >
                — {state.kind === "logged" ? "LOGGED" : "UNLOGGED"}
              </span>
              <span className="text-[13px] text-zinc-950 dark:text-zinc-50">
                {state.title}
              </span>
            </div>
            {state.kind === "logged" ? (
              <Link
                href={`/workout/${state.workoutId}`}
                onClick={dismiss}
                className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-medium text-emerald-700 transition active:scale-[0.97] hover:underline dark:text-emerald-400"
              >
                Add actuals
                <ArrowRight color="currentColor" size={13} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  state.onUndo();
                  dismiss();
                }}
                className="inline-flex items-center gap-1 whitespace-nowrap bg-transparent text-[13px] font-medium text-zinc-700 transition active:scale-[0.97] hover:underline dark:text-zinc-300"
              >
                Undo
                <ArrowRight color="currentColor" size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 dark:text-zinc-600 dark:hover:text-zinc-300"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

// Hook callers use inside WorkoutCard. Returns a no-op when the provider
// isn't mounted so the card stays renderable in storybook / tests.
export function useLoggedToast(): ToastContextShape {
  const ctx = useContext(ToastContext);
  return ctx ?? { show: () => {} };
}
