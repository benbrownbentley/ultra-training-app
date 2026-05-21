import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { WorkoutKind, WorkoutStatus } from "@/lib/plan"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * True when `e` is a Next.js redirect "error" — the framework throws a
 * sentinel error from `redirect()` to drive navigation. Client-side
 * catch blocks that wrap server actions must re-throw this so the
 * navigation actually fires; otherwise the form swallows the redirect
 * and renders a fake "Failed to save" state on success.
 *
 * Uses the digest-string contract rather than importing
 * `isRedirectError` from a Next internal path so we don't couple to
 * framework internals.
 */
export function isNextRedirectError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/**
 * Returns today's date in the athlete's training timezone (America/Vancouver)
 * as an ISO date string (YYYY-MM-DD). Used everywhere a "today" boundary is
 * needed so plan generation, logging, and rendering all agree on the same day
 * regardless of the server's locale.
 */
export function getTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
  }).format(new Date());
}

// ---------------------------------------------------------------------------
// Date helpers — pure functions, no browser or Next.js APIs.
// These live here so the React Native app can import them unchanged.
// ---------------------------------------------------------------------------

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Parses an ISO date string (YYYY-MM-DD) into a UTC Date object.
 * Using Date.UTC avoids timezone-offset surprises when splitting on "-".
 */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** e.g. "Monday, May 19" */
export function formatLongDate(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** e.g. "Monday, May 19, 2026" */
export function formatLongDateWithYear(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** e.g. "May 19" — used in the weekly strip header */
export function formatWeekLabel(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** 3-letter weekday abbreviation, e.g. "Mon" */
export function shortWeekday(iso: string): string {
  return WEEKDAYS_SHORT[parseISO(iso).getUTCDay()];
}

/** Number of whole days from one ISO date to another. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (parseISO(toIso).getTime() - parseISO(fromIso).getTime()) / 86_400_000,
  );
}

/**
 * Returns the ISO date of the Monday that starts the week containing `iso`.
 * Week starts on Monday so training weeks align with typical coaching convention.
 */
export function weekStart(iso: string): string {
  const d = parseISO(iso);
  const offset = (d.getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

/** Returns the ISO date `n` days after the given date. */
export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Workout display helpers — pure functions, no browser or Next.js APIs.
// ---------------------------------------------------------------------------

/** Emoji icon for each workout kind. */
export function workoutIcon(kind: WorkoutKind): string {
  if (kind === "run") return "🏃";
  if (kind === "gym") return "🏋️";
  if (kind === "hike") return "🥾";
  if (kind === "cross") return "🚴";
  if (kind === "physio") return "🩹";
  return "🧘";
}

/** Human-readable label for a workout status. */
export function statusLabel(status: WorkoutStatus): string {
  if (status === "completed") return "✓ Completed";
  if (status === "skipped") return "⏭ Skipped";
  return "Pending";
}

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

/**
 * Returns null for empty/whitespace strings, otherwise the trimmed value.
 * Used when cleaning optional form fields before storing in the database.
 */
export function blankToNull(s: string): string | null {
  const trimmed = s.trim();
  return trimmed.length === 0 ? null : trimmed;
}
