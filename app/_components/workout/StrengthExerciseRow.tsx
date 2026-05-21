"use client";

// Per-exercise row for the Strength variant. Renders collapsed by default
// with a "Done?" pill; tap to expand into per-set inputs (PDF pages 25,
// 27). Skipped state strikethroughs the name with an UNDO link; user-
// added exercises wear a USER badge.
//
// Status badges (DONE AT PLANNED / DONE WITH OVERRIDES / "n SHORT") are
// derived at render time by comparing actual sets against the planned
// targets — no extra schema fields needed.

import { useState } from "react";
import type { ActualDetail } from "@/lib/plan";

interface PlannedExercise {
  name: string;
  sets: number;
  reps: number;
  weight?: string;
  unit?: string;
  equip?: string;
  note?: string;
  isTime?: boolean;
}

type ActualSet = NonNullable<ActualDetail["sets"]>[number];

interface Props {
  planned: PlannedExercise;
  // Subset of actual_detail.sets filtered to this exerciseName. Empty
  // when the user hasn't logged anything for this exercise yet.
  sets: ActualSet[];
  skipped: boolean;
  isCustom: boolean;
  onAddSet: () => void;
  onChangeSet: (index: number, patch: { reps?: number; weight?: number }) => void;
  onRemoveSet: (index: number) => void;
  onToggleSkip: () => void;
  // Marks every set done at planned reps + weight in one tap. Replaces
  // the existing sets[] for this exercise — pass the full new array up.
  onMarkDoneAtPlanned: () => void;
  disabled?: boolean;
}

// Returns the status badge tone + label for the collapsed view, or null
// when the user hasn't logged anything yet.
function deriveStatus(
  planned: PlannedExercise,
  sets: ActualSet[],
): { tone: "success" | "warn"; label: string } | null {
  if (sets.length === 0) return null;
  const plannedReps = planned.reps;
  const plannedWeight = Number(planned.weight ?? 0);

  // Did the user override either reps or weight on any set?
  const hasOverride = sets.some(
    (s) => s.reps !== plannedReps || s.weight !== plannedWeight,
  );

  // Last set short of planned reps — surfaces explicitly because it's
  // the signal that the lift fatigued the athlete before target.
  const last = sets[sets.length - 1];
  if (last && last.reps < plannedReps) {
    const short = plannedReps - last.reps;
    return { tone: "warn", label: `${short} SHORT` };
  }
  if (hasOverride) return { tone: "warn", label: "DONE WITH OVERRIDES" };
  return { tone: "success", label: "DONE AT PLANNED" };
}

function MiniNumInput({
  value,
  suffix,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: number;
  suffix?: string;
  onChange: (next: number) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-950">
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? 0 : Number(v));
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        className="w-12 bg-transparent text-right font-mono text-[13.5px] font-medium text-zinc-950 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-55 dark:text-zinc-50"
      />
      {suffix && (
        <span className="font-mono text-[10.5px] text-zinc-500 dark:text-zinc-400">
          {suffix}
        </span>
      )}
    </span>
  );
}

export function StrengthExerciseRow({
  planned,
  sets,
  skipped,
  isCustom,
  onAddSet,
  onChangeSet,
  onRemoveSet,
  onToggleSkip,
  onMarkDoneAtPlanned,
  disabled,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const status = deriveStatus(planned, sets);
  const setsLabel = planned.isTime
    ? `${planned.sets} × ${planned.reps}s`
    : `${planned.sets} × ${planned.reps}`;
  const plannedSummary = `${setsLabel}${
    planned.weight ? ` · ${planned.weight}${planned.unit ? ` ${planned.unit}` : ""}` : ""
  }${planned.note ? ` · ${planned.note}` : ""}`;

  return (
    <div
      className={`overflow-hidden rounded-[10px] border bg-white transition dark:bg-[#0f0f11] ${
        isCustom
          ? "border-emerald-300 dark:border-emerald-500/35"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      {/* Collapsed header — always visible. */}
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        {/* Tap header to toggle expansion. The "Done?" / "UNDO" actions
            and the skip "×" sit outside this button so they don't fire
            an expand at the same time. */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          disabled={disabled}
          className="flex flex-1 flex-col gap-1 text-left disabled:cursor-not-allowed"
        >
          <div className="flex flex-wrap items-baseline gap-2">
            <span
              className={`text-[14.5px] font-medium text-zinc-950 dark:text-zinc-50 ${
                skipped ? "line-through" : ""
              }`}
            >
              {planned.name}
            </span>
            {planned.equip && (
              <span
                className="whitespace-nowrap rounded-[4px] border border-zinc-200 px-1.5 py-0.5 font-mono text-[10px] uppercase text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
                style={{ letterSpacing: "0.12em" }}
              >
                {planned.equip}
              </span>
            )}
            {isCustom && (
              <span
                className="whitespace-nowrap rounded-[4px] border border-emerald-300 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400"
                style={{ letterSpacing: "0.18em" }}
              >
                USER
              </span>
            )}
            {expanded && (
              <span
                className="ml-auto font-mono text-[9.5px] uppercase text-zinc-400 dark:text-zinc-600"
                style={{ letterSpacing: "0.18em" }}
              >
                EXPANDED
              </span>
            )}
          </div>
          <span className="font-mono text-[11.5px] text-zinc-600 dark:text-zinc-400">
            {plannedSummary}
          </span>
          {status && (
            <span
              className={`mt-0.5 font-mono text-[10.5px] font-semibold uppercase ${
                status.tone === "success"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-500"
              }`}
              style={{ letterSpacing: "0.16em" }}
            >
              {status.label}
            </span>
          )}
        </button>

        {/* Right column: Done? / UNDO + skip × */}
        <div className="flex shrink-0 items-center gap-2">
          {skipped ? (
            <button
              type="button"
              onClick={onToggleSkip}
              disabled={disabled}
              className="font-mono text-[11px] font-semibold uppercase text-emerald-700 transition active:scale-[0.97] hover:underline disabled:opacity-50 dark:text-emerald-400"
              style={{ letterSpacing: "0.18em" }}
            >
              UNDO
            </button>
          ) : (
            <>
              {sets.length === 0 && (
                <button
                  type="button"
                  onClick={onMarkDoneAtPlanned}
                  disabled={disabled}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-emerald-300 bg-transparent px-3 text-[12px] font-medium text-emerald-700 transition active:scale-[0.97] hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                >
                  Done?
                </button>
              )}
              <button
                type="button"
                onClick={onToggleSkip}
                disabled={disabled}
                aria-label="Skip exercise"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition active:scale-[0.94] hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-600 dark:hover:text-zinc-300"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded — per-set inputs. */}
      {expanded && !skipped && (
        <div className="border-t border-zinc-200 px-3.5 pb-3 pt-1 dark:border-zinc-800">
          {sets.length === 0 ? (
            <div className="py-3 font-mono text-[11.5px] text-zinc-500 dark:text-zinc-500">
              No sets logged yet. Tap &ldquo;Done?&rdquo; above to fill in the
              plan, or &ldquo;+ Add set&rdquo; below to log them one at a time.
            </div>
          ) : (
            <div className="flex flex-col">
              {sets.map((s, i) => {
                const short = s.reps < planned.reps;
                return (
                  <div
                    key={i}
                    className="grid items-center gap-2 border-t border-zinc-200 py-2 first:border-t-0 dark:border-zinc-800"
                    style={{ gridTemplateColumns: "44px 1fr auto" }}
                  >
                    <span
                      className="font-mono text-[10px] font-semibold uppercase text-zinc-500 dark:text-zinc-400"
                      style={{ letterSpacing: "0.14em" }}
                    >
                      SET {i + 1}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <MiniNumInput
                        value={s.reps}
                        suffix="reps"
                        onChange={(reps) => onChangeSet(i, { reps })}
                        disabled={disabled}
                        ariaLabel={`Set ${i + 1} reps`}
                      />
                      <MiniNumInput
                        value={s.weight}
                        suffix={s.unit || planned.unit || ""}
                        onChange={(weight) => onChangeSet(i, { weight })}
                        disabled={disabled}
                        ariaLabel={`Set ${i + 1} weight`}
                      />
                      {short && (
                        <span
                          className="font-mono text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-500"
                          style={{ letterSpacing: "0.16em" }}
                        >
                          {planned.reps - s.reps} SHORT
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveSet(i)}
                      disabled={disabled}
                      aria-label={`Remove set ${i + 1}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M6 6l12 12M18 6L6 18"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={onAddSet}
            disabled={disabled}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-zinc-200 px-2.5 py-1 text-[12px] font-medium text-emerald-700 transition active:scale-[0.97] hover:border-emerald-300 disabled:opacity-50 dark:border-zinc-800 dark:text-emerald-400"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Add set
          </button>
        </div>
      )}
    </div>
  );
}
