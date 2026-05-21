"use client";

// Expandable sub-form for capturing minutes-per-zone on a logged run.
// Two visible states:
//   • Collapsed empty — dashed "+ Add time-in-zone breakdown" affordance.
//   • Expanded form — 5 mini-number inputs (Z1..Z5) with a "Done" button.
// Once any zone has minutes > 0, the row swaps to the existing
// TimeInZoneBar bar visualisation, with an "Edit" link to re-open the form.

import { useMemo, useState } from "react";
import { TimeInZoneBar } from "./atoms";

interface ZoneEntry {
  label: string;
  minutes: number;
}

interface Props {
  zones: ZoneEntry[] | null;
  onChange: (next: ZoneEntry[]) => void;
  disabled?: boolean;
}

const ZONE_LABELS = ["Z1", "Z2", "Z3", "Z4", "Z5"] as const;

// Seed the local form state from whatever's already saved so the inputs
// don't appear empty after the user reloads the page. Missing zones default
// to 0 — the save path filters those out so the bar isn't cluttered.
function seedFromZones(zones: ZoneEntry[] | null): Record<string, number> {
  const map: Record<string, number> = {};
  for (const label of ZONE_LABELS) map[label] = 0;
  if (!zones) return map;
  for (const z of zones) {
    if (map[z.label] != null) map[z.label] = z.minutes;
  }
  return map;
}

export function TimeInZoneForm({ zones, onChange, disabled }: Props) {
  const hasZones = (zones?.length ?? 0) > 0;
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>(() =>
    seedFromZones(zones),
  );

  // When the user re-opens the form (Edit), reseed from props so the
  // latest saved values land. Memoised so we don't fight controlled inputs.
  const seeded = useMemo(() => seedFromZones(zones), [zones]);

  function open() {
    if (disabled) return;
    setDraft(seeded);
    setExpanded(true);
  }

  function commit() {
    const next: ZoneEntry[] = ZONE_LABELS.flatMap((label) => {
      const minutes = Math.max(0, Math.round(draft[label] ?? 0));
      return minutes > 0 ? [{ label, minutes }] : [];
    });
    onChange(next);
    setExpanded(false);
  }

  // ─── Collapsed: bar view (with Edit) ────────────────────────
  if (hasZones && !expanded) {
    return (
      <div className="flex flex-col gap-1.5">
        <TimeInZoneBar zones={zones!} />
        <button
          type="button"
          onClick={open}
          disabled={disabled}
          className="self-end font-mono text-[10.5px] uppercase text-emerald-700 transition active:scale-[0.97] hover:underline disabled:opacity-50 dark:text-emerald-400"
          style={{ letterSpacing: "0.18em" }}
        >
          Edit
        </button>
      </div>
    );
  }

  // ─── Collapsed: empty (Add) ─────────────────────────────────
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={open}
        disabled={disabled}
        className={`flex w-full items-center gap-2 rounded-[10px] border border-dashed border-zinc-200 px-3.5 py-2.5 text-left text-[13px] font-medium text-zinc-600 transition active:scale-[0.99] hover:border-emerald-300 disabled:opacity-55 dark:border-zinc-800 dark:text-zinc-400`}
      >
        <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 5v14M5 12h14"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        Add time-in-zone breakdown
      </button>
    );
  }

  // ─── Expanded form ──────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 dark:border-zinc-800 dark:bg-[#0f0f11]">
      <div className="flex items-baseline justify-between">
        <span
          className="font-mono text-[10px] uppercase text-zinc-500"
          style={{ letterSpacing: "0.2em" }}
        >
          TIME IN ZONE
        </span>
        <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-600">
          enter minutes per zone
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {ZONE_LABELS.map((label) => (
          <label key={label} className="flex flex-col items-center gap-1">
            <span
              className="font-mono text-[10px] font-semibold text-zinc-500"
              style={{ letterSpacing: "0.16em" }}
            >
              {label}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={draft[label] || ""}
              placeholder="0"
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  [label]: e.target.value === "" ? 0 : Number(e.target.value),
                }))
              }
              disabled={disabled}
              aria-label={`${label} minutes`}
              className="h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 px-1 text-center font-mono text-[13.5px] font-medium text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-55 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-600"
            />
            <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
              min
            </span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          disabled={disabled}
          className="text-[12.5px] font-medium text-zinc-500 hover:text-zinc-950 disabled:opacity-50 dark:hover:text-zinc-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={commit}
          disabled={disabled}
          className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-600 bg-emerald-500 px-3 text-[12.5px] font-semibold text-emerald-950 transition active:scale-[0.97] hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Done
        </button>
      </div>
    </div>
  );
}
