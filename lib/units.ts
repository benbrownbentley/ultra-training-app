// Unit conversion + formatting helpers. Internal storage is always
// metric (km, m, kg, sec/km) per PROJECT_BRIEF.md "Units handling" —
// this layer only changes presentation. Pure functions, no IO, no
// Next.js or Supabase imports so the React Native build can reuse them.

import type { UnitSystem } from "@/lib/plan";

const KM_PER_MILE = 1.609344;
const M_PER_FOOT = 0.3048;
const KG_PER_LB = 0.45359237;

function toNumber(v: number | string): number {
  if (typeof v === "number") return v;
  const parsed = parseFloat(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Distance display. Storage is always km; we convert to mi when the
 * athlete asked for imperial.
 *
 * Accepts string inputs because the legacy `weekly_volume` column is
 * free text ("65 km", "Under 10 km", etc.). We pull the leading number
 * and trust the caller's `units` arg over the embedded suffix.
 *
 * Returns a fixed-1-decimal value when the underlying number has
 * fractional parts — "8.0 km" for whole km, "7.5 km" for halves.
 */
export function formatDistance(
  km: number | string,
  units: UnitSystem,
): string {
  const value = toNumber(km);
  if (units === "imperial") {
    const mi = value / KM_PER_MILE;
    return `${formatNumber(mi)} mi`;
  }
  return `${formatNumber(value)} km`;
}

/**
 * Elevation gain or loss. Sign is preserved when present.
 */
export function formatElevation(
  m: number,
  units: UnitSystem,
): string {
  const sign = m < 0 ? "-" : m > 0 ? "+" : "";
  const abs = Math.abs(m);
  if (units === "imperial") {
    const ft = Math.round(abs / M_PER_FOOT);
    return `${sign}${ft} ft`;
  }
  return `${sign}${Math.round(abs)} m`;
}

export function formatWeight(kg: number, units: UnitSystem): string {
  if (units === "imperial") {
    const lb = Math.round(kg / KG_PER_LB);
    return `${lb} lb`;
  }
  return `${Math.round(kg)} kg`;
}

/**
 * Pace display. Input is sec/km regardless of the athlete's unit
 * preference — the conversion to /mi multiplies by KM_PER_MILE.
 */
export function formatPace(
  secPerKm: number,
  units: UnitSystem,
): string {
  const sec =
    units === "imperial" ? secPerKm * KM_PER_MILE : secPerKm;
  const minutes = Math.floor(sec / 60);
  const seconds = Math.round(sec - minutes * 60);
  const padded = seconds.toString().padStart(2, "0");
  return `${minutes}:${padded} /${units === "imperial" ? "mi" : "km"}`;
}

/**
 * Form-input → km. Lets the wizard / race form / athlete form accept
 * the user's preferred unit in the input box and store km consistently.
 */
export function parseDistance(input: string, units: UnitSystem): number {
  const value = toNumber(input);
  if (units === "imperial") return value * KM_PER_MILE;
  return value;
}

export function parseElevation(input: string, units: UnitSystem): number {
  const value = toNumber(input);
  if (units === "imperial") return value * M_PER_FOOT;
  return value;
}

export function parseWeight(input: string, units: UnitSystem): number {
  const value = toNumber(input);
  if (units === "imperial") return value * KG_PER_LB;
  return value;
}

// Strips trailing .0 so "8.0 km" reads as "8 km", keeps "7.5 km" intact.
function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(1);
}

// Short suffix only — useful for SuffixInput components on forms.
export function distanceUnitSuffix(units: UnitSystem): string {
  return units === "imperial" ? "mi" : "km";
}

export function elevationUnitSuffix(units: UnitSystem): string {
  return units === "imperial" ? "ft" : "m";
}

export function weightUnitSuffix(units: UnitSystem): string {
  return units === "imperial" ? "lb" : "kg";
}
