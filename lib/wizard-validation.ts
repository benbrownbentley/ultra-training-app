// Pure-TypeScript wizard validation. Lives in lib/ rather than alongside
// the components so the same rules can be reused by future entrypoints
// (server-side intake API, native mobile client) without dragging
// component dependencies along — see AGENTS.md "Keep business logic out
// of the UI" and "No Next.js-specific imports in lib/".

import type { WizardPayload, WizardRaceInput } from "@/app/actions";

/** Map of field-key → friendly inline error message. */
export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type RaceFieldKey = "name" | "date" | "distance";
export type AboutFieldKey = "age";

/**
 * Validates the A-race fields that gate the races-step Continue button.
 * Returns a map of field-key → user-facing error. An empty map means
 * the step is ready to advance.
 *
 * Mirrors the canAdvance rules the wizard has always enforced (name,
 * date, distance required) and adds the 2026-05-21 smoke-test rule
 * that race date must be in the future — training for a past race is
 * nonsense and the validator is the right place to catch it.
 */
export function validateRaceStep(
  race: WizardRaceInput,
): FieldErrors<RaceFieldKey> {
  const errors: FieldErrors<RaceFieldKey> = {};
  if (!race.name.trim()) {
    errors.name = "We need a name to refer to this race.";
  }
  if (!race.date) {
    errors.date = "Pick a race date.";
  } else if (!isFutureDate(race.date)) {
    errors.date = "Race date must be in the future.";
  }
  if (!race.distance.trim()) {
    errors.distance = "Add the race distance.";
  }
  return errors;
}

/**
 * Validates the about-you step. Only age is required; the other About
 * fields are optional (per the `*` = required convention).
 */
export function validateAboutStep(
  data: WizardPayload,
): FieldErrors<AboutFieldKey> {
  const errors: FieldErrors<AboutFieldKey> = {};
  if (data.age == null || data.age <= 0) {
    errors.age = "Age is required so the plan can scale appropriately.";
  }
  return errors;
}

// Compares a YYYY-MM-DD date string against today's local calendar
// date. Same-day races are excluded — the plan needs at least one
// training day to do anything useful. Using a string compare with a
// locally-formatted today avoids the UTC vs local-day off-by-one that
// `new Date(yyyyMmDd) > new Date()` would introduce in timezones
// behind UTC.
function isFutureDate(yyyyMmDd: string): boolean {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const today = `${year}-${month}-${day}`;
  return yyyyMmDd > today;
}
