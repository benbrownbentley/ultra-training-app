"use client";

// Owns the actuals form state for the Workout Detail page. Mounts the
// chosen VariantBody and threads value + onChange handlers down via the
// ActualsBindings prop. Persists with a 1000ms debounce so a user typing
// fluidly across multiple fields doesn't fire a save per keystroke.
//
// Save state surfaces as a small "saved · HH:MM" caption near the LOG
// section header; errors swap that to a red "couldn't save — try again"
// hint so the user can retry by editing again.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActualDetail, WorkoutKind, WorkoutStatus } from "@/lib/plan";
import type { WorkoutContent } from "@/lib/workout-content";
import { logWorkout, saveActuals } from "@/app/actions";
import { VariantBody, type ActualsBindings } from "./VariantBody";

type Variant = "upcoming" | "logged" | "skipped" | "missed" | "future";

interface Props {
  workoutId: number;
  kind: WorkoutKind;
  content: WorkoutContent;
  variant: Variant;
  status: WorkoutStatus;
  loggedAt: string | null;
  isFuture: boolean;
  initial: {
    duration_min: number | null;
    distance_km: number | null;
    elevation_gain_m: number | null;
    hr_avg: number | null;
    rpe: number | null;
    notes: string;
    detail: ActualDetail | null;
  };
}

// Shape of the form's state. Mirrors the saveActuals payload so the save
// path is a one-liner.
interface FormState {
  duration_min: number | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
  hr_avg: number | null;
  rpe: number | null;
  notes: string;
  detail: ActualDetail | null;
}

// Short debounce so a single keystroke doesn't fire a save, but the
// common "type a value then immediately tap back" case still
// persists. The Save button below the form is the explicit-flush
// escape hatch for users who don't trust the debounce.
const SAVE_DEBOUNCE_MS = 300;

function formatSavedAt(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function ActualsForm({
  workoutId,
  kind,
  content,
  variant,
  status,
  loggedAt,
  isFuture,
  initial,
}: Props) {
  const [state, setState] = useState<FormState>(initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Mirror status locally for the Mobility DoneToggle. logWorkout still
  // runs against the server; this just keeps the toggle responsive while
  // the revalidation lands.
  const [localStatus, setLocalStatus] = useState<WorkoutStatus>(status);

  // Track whether the user has actually touched anything since mount.
  // Without this guard, the first useEffect tick after mount would
  // immediately fire a save with the unchanged initial values.
  const dirtyRef = useRef(false);

  // Explicit save — bound to the visible Save button + reused by the
  // debounced auto-save below. Marks the form clean on success so a
  // user who taps Save then immediately taps back doesn't trigger
  // another redundant write.
  const flushSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveActuals(workoutId, state);
      setSavedAt(Date.now());
      setError(null);
      dirtyRef.current = false;
    } catch (e) {
      console.error("Failed to save actuals", e);
      setError("Couldn't save — try again.");
    } finally {
      setIsSaving(false);
    }
  }, [workoutId, state]);

  // Debounced auto-save. Cleared on each state change so the latest
  // value is what eventually persists.
  useEffect(() => {
    if (!dirtyRef.current) return;
    const handle = window.setTimeout(() => {
      void flushSave();
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [state, flushSave]);

  const patch = useCallback(<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    dirtyRef.current = true;
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  // Running: zones array lives directly under actual_detail.zones.
  const onChangeZones = useCallback(
    (next: { label: string; minutes: number }[]) => {
      dirtyRef.current = true;
      setState((s) => ({
        ...s,
        detail: { ...(s.detail ?? {}), zones: next },
      }));
    },
    [],
  );

  const onChangePhysioExercise = useCallback(
    (
      index: number,
      patch: { done?: boolean; pain?: number; note?: string },
    ) => {
      dirtyRef.current = true;
      setState((s) => {
        const list = (
          s.detail?.exercises ??
          content.physioExercises.map((ex) => ({
            name: ex.name,
            done: false,
            pain: null as number | null,
            note: null as string | null,
          }))
        ).slice();
        const cur = list[index] ?? {
          name: content.physioExercises[index]?.name ?? "Exercise",
          done: false,
          pain: null,
          note: null,
        };
        list[index] = {
          ...cur,
          done: patch.done ?? cur.done,
          pain: patch.pain ?? cur.pain ?? null,
          note: patch.note ?? cur.note ?? null,
        };
        return { ...s, detail: { ...(s.detail ?? {}), exercises: list } };
      });
    },
    [content.physioExercises],
  );

  // Mobility per-routine-item done/note. Same index-keyed shape as
  // physio above; seeds the array from content.routine on first edit.
  const onChangeMobilityExercise = useCallback(
    (index: number, patch: { done?: boolean; note?: string }) => {
      dirtyRef.current = true;
      setState((s) => {
        const list = (
          s.detail?.exercises ??
          content.routine.map((r) => ({
            name: r.name,
            done: false,
            pain: null as number | null,
            note: null as string | null,
          }))
        ).slice();
        const cur = list[index] ?? {
          name: content.routine[index]?.name ?? "Exercise",
          done: false,
          pain: null,
          note: null,
        };
        list[index] = {
          ...cur,
          done: patch.done ?? cur.done,
          note: patch.note ?? cur.note ?? null,
        };
        return { ...s, detail: { ...(s.detail ?? {}), exercises: list } };
      });
    },
    [content.routine],
  );

  // ─── Strength handlers ─────────────────────────────────────
  // All splice actual_detail.sets / skipped_exercises / added_exercises
  // in place; the debounced save effect fires once the user stops
  // tapping. Keys are exerciseName because the same exercise can move
  // between collapsed planned + expanded user-added without re-keying.

  const onAddSet = useCallback(
    (exerciseName: string, unit: string) => {
      dirtyRef.current = true;
      setState((s) => {
        const sets = (s.detail?.sets ?? []).slice();
        // Seed the new set from the most recent set for this exercise,
        // or zeros if none exist yet. Lets the user log a streak of
        // identical sets with one tap each.
        const last = [...sets]
          .reverse()
          .find((x) => x.exerciseName === exerciseName);
        sets.push({
          exerciseName,
          reps: last?.reps ?? 0,
          weight: last?.weight ?? 0,
          unit: last?.unit ?? unit,
        });
        return { ...s, detail: { ...(s.detail ?? {}), sets } };
      });
    },
    [],
  );

  const onChangeSet = useCallback(
    (
      exerciseName: string,
      index: number,
      patch: { reps?: number; weight?: number },
    ) => {
      dirtyRef.current = true;
      setState((s) => {
        const sets = (s.detail?.sets ?? []).slice();
        // index is the position within this exercise's sets (not the
        // global array), so we walk to find it.
        let seen = 0;
        for (let i = 0; i < sets.length; i++) {
          if (sets[i].exerciseName !== exerciseName) continue;
          if (seen === index) {
            sets[i] = {
              ...sets[i],
              reps: patch.reps ?? sets[i].reps,
              weight: patch.weight ?? sets[i].weight,
            };
            break;
          }
          seen++;
        }
        return { ...s, detail: { ...(s.detail ?? {}), sets } };
      });
    },
    [],
  );

  const onRemoveSet = useCallback(
    (exerciseName: string, index: number) => {
      dirtyRef.current = true;
      setState((s) => {
        const sets = (s.detail?.sets ?? []).slice();
        let seen = 0;
        for (let i = 0; i < sets.length; i++) {
          if (sets[i].exerciseName !== exerciseName) continue;
          if (seen === index) {
            sets.splice(i, 1);
            break;
          }
          seen++;
        }
        return { ...s, detail: { ...(s.detail ?? {}), sets } };
      });
    },
    [],
  );

  const onToggleSkipExercise = useCallback((exerciseName: string) => {
    dirtyRef.current = true;
    setState((s) => {
      const cur = s.detail?.skipped_exercises ?? [];
      const next = cur.includes(exerciseName)
        ? cur.filter((n) => n !== exerciseName)
        : [...cur, exerciseName];
      return {
        ...s,
        detail: { ...(s.detail ?? {}), skipped_exercises: next },
      };
    });
  }, []);

  const onMarkDoneAtPlanned = useCallback(
    (
      exerciseName: string,
      planned: { sets: number; reps: number; weight: number; unit: string },
    ) => {
      dirtyRef.current = true;
      setState((s) => {
        const sets = (s.detail?.sets ?? []).filter(
          (x) => x.exerciseName !== exerciseName,
        );
        for (let i = 0; i < planned.sets; i++) {
          sets.push({
            exerciseName,
            reps: planned.reps,
            weight: planned.weight,
            unit: planned.unit,
          });
        }
        return { ...s, detail: { ...(s.detail ?? {}), sets } };
      });
    },
    [],
  );

  // Strength checkbox "uncheck" — drops every logged set for the named
  // exercise so the row reverts to its unchecked (no-actuals) state.
  const onClearSets = useCallback((exerciseName: string) => {
    dirtyRef.current = true;
    setState((s) => {
      const sets = (s.detail?.sets ?? []).filter(
        (x) => x.exerciseName !== exerciseName,
      );
      return { ...s, detail: { ...(s.detail ?? {}), sets } };
    });
  }, []);

  // Seeds sets[] with `count` zero-entries for the named exercise. Fires
  // on the first edit of a placeholder set row (StrengthExerciseRow) so
  // the subsequent same-tick onChangeSet patch has somewhere to land —
  // React's functional setState updaters compose in order, so the seed
  // is visible to the patch updater that runs next. Filters existing
  // entries first to stay idempotent on the off-chance two placeholder
  // inputs fire onChange in the same handler.
  const onSeedSets = useCallback(
    (exerciseName: string, count: number, unit: string) => {
      dirtyRef.current = true;
      setState((s) => {
        const others = (s.detail?.sets ?? []).filter(
          (x) => x.exerciseName !== exerciseName,
        );
        const seeded = [...others];
        for (let i = 0; i < count; i++) {
          seeded.push({ exerciseName, reps: 0, weight: 0, unit });
        }
        return { ...s, detail: { ...(s.detail ?? {}), sets: seeded } };
      });
    },
    [],
  );

  const onAddCustomExercise = useCallback(
    (input: {
      name: string;
      sets: number;
      reps: number;
      weight: number;
      unit: string;
    }) => {
      dirtyRef.current = true;
      setState((s) => {
        const addedList = s.detail?.added_exercises ?? [];
        const added = [
          ...addedList,
          {
            name: input.name,
            plannedSets: input.sets,
            plannedReps: input.reps,
            plannedWeight: input.weight,
            plannedUnit: input.unit,
          },
        ];
        // Seed sets[] at planned defaults so the row reads as DONE AT
        // PLANNED immediately. User can edit/remove sets afterwards.
        const sets = (s.detail?.sets ?? []).slice();
        for (let i = 0; i < input.sets; i++) {
          sets.push({
            exerciseName: input.name,
            reps: input.reps,
            weight: input.weight,
            unit: input.unit,
          });
        }
        return {
          ...s,
          detail: { ...(s.detail ?? {}), added_exercises: added, sets },
        };
      });
    },
    [],
  );

  // Mobility's DoneToggle drives status AND — for mobility — seeds every
  // routine item's done flag so the per-item checkmarks stay in sync
  // with the group toggle. Status flips via logWorkout; the item
  // checkmarks ride the debounced saveActuals path.
  const onChangeDone = useCallback(
    (next: boolean) => {
      const nextStatus: WorkoutStatus = next ? "completed" : "pending";
      setLocalStatus(nextStatus);
      if (kind === "mobility" && content.routine.length > 0) {
        dirtyRef.current = true;
        setState((s) => ({
          ...s,
          detail: {
            ...(s.detail ?? {}),
            exercises: content.routine.map((r) => ({
              name: r.name,
              done: next,
              pain: null,
              note: null,
            })),
          },
        }));
      }
      void logWorkout(workoutId, nextStatus).catch((e) => {
        console.error("Failed to set status", e);
        setLocalStatus(status);
        setError("Couldn't save status — try again.");
      });
    },
    [workoutId, status, kind, content.routine],
  );

  // Bind the form state into the ActualsBindings the variant body wants.
  // Memoised so the variant components don't see a new object every keystroke.
  const bindings: ActualsBindings = useMemo(
    () => ({
      duration_min: state.duration_min,
      distance_km: state.distance_km,
      elevation_gain_m: state.elevation_gain_m,
      hr_avg: state.hr_avg,
      rpe: state.rpe,
      notes: state.notes,
      detail: state.detail,
      onChangeDuration: (next) => patch("duration_min", next),
      onChangeDistance: (next) => patch("distance_km", next),
      onChangeElevation: (next) => patch("elevation_gain_m", next),
      onChangeHr: (next) => patch("hr_avg", next),
      onChangeRpe: (next) => patch("rpe", next),
      onChangeNotes: (next) => patch("notes", next),
      onChangeZones,
      onChangeDone,
      onChangePhysioExercise,
      onChangeMobilityExercise,
      onAddSet,
      onChangeSet,
      onRemoveSet,
      onToggleSkipExercise,
      onMarkDoneAtPlanned,
      onClearSets,
      onSeedSets,
      onAddCustomExercise,
    }),
    [
      state,
      patch,
      onChangeZones,
      onChangeDone,
      onChangePhysioExercise,
      onChangeMobilityExercise,
      onAddSet,
      onChangeSet,
      onRemoveSet,
      onToggleSkipExercise,
      onMarkDoneAtPlanned,
      onClearSets,
      onSeedSets,
      onAddCustomExercise,
    ],
  );

  // Kind is part of the props contract but only the variant body
  // reads it. Surface here in case future logic needs to branch.
  void kind;

  return (
    <>
      <div className="px-4 pt-1 sm:px-5">
        {error ? (
          <div className="flex justify-end">
            <span
              className="font-mono text-[10.5px] uppercase text-red-600 dark:text-red-500"
              style={{ letterSpacing: "0.18em" }}
            >
              · {error}
            </span>
          </div>
        ) : savedAt ? (
          <div className="flex justify-end">
            <span
              className="font-mono text-[10.5px] uppercase text-emerald-700 dark:text-emerald-400"
              style={{ letterSpacing: "0.18em" }}
            >
              · saved · {formatSavedAt(savedAt)}
            </span>
          </div>
        ) : null}
      </div>
      <VariantBody
        content={content}
        variant={variant}
        status={localStatus}
        loggedAt={loggedAt}
        isFuture={isFuture}
        bindings={bindings}
      />
      {/* Explicit Save — auto-save runs on a 300ms debounce, but the
          button is the user-visible escape hatch for "I typed a value
          and want it to stick before I navigate away." Hidden on
          future workouts where the LOG fields are disabled. */}
      {!isFuture && (
        <div className="flex justify-end px-4 pt-1 pb-2 sm:px-5">
          <button
            type="button"
            onClick={() => void flushSave()}
            disabled={isSaving}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-emerald-600 bg-emerald-500 px-3.5 text-[12.5px] font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_4px_12px_rgba(16,185,129,0.25)] transition active:scale-[0.97] hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </>
  );
}
