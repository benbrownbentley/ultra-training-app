import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
