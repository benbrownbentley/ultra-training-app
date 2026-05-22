// Tiny shared helpers for the Phase 2 PlannedDetail shape. Lives in
// lib/ (no `server-only` import) so both Server Components / actions
// and Client Components can call it. Heavy schema validation belongs
// in lib/plan-validation.ts; this module is just type guards.

import type {
  LegacyPlannedDetail,
  PlannedDetail,
  PlannedDetailStored,
} from "./plan";

/**
 * True when the stored planned_detail is the Phase 2 backfill shape
 * (`{ notes }` only). Discriminated-union members all carry `kind`,
 * so a row without it is legacy. Phase 2 cuts over to full structured
 * data once Ben regenerates post-migration; legacy rows live until
 * then. See PHASE_2_SPEC.md §3.5.
 */
export function isLegacyPlannedDetail(
  pd: PlannedDetailStored,
): pd is LegacyPlannedDetail {
  if (pd == null) return false;
  return (
    !("kind" in (pd as object)) &&
    typeof (pd as { notes?: unknown }).notes === "string"
  );
}

/** Inverse type guard — returns true for fully-structured rows. */
export function isStructuredPlannedDetail(
  pd: PlannedDetailStored,
): pd is PlannedDetail {
  return pd != null && "kind" in (pd as object);
}
