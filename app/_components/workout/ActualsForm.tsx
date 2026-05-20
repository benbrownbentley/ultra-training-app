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

const SAVE_DEBOUNCE_MS = 1000;

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
  // Mirror status locally for the Mobility DoneToggle. logWorkout still
  // runs against the server; this just keeps the toggle responsive while
  // the revalidation lands.
  const [localStatus, setLocalStatus] = useState<WorkoutStatus>(status);

  // Track whether the user has actually touched anything since mount.
  // Without this guard, the first useEffect tick after mount would
  // immediately fire a save with the unchanged initial values.
  const dirtyRef = useRef(false);

  // Debounced save. Cleared on each state change so the latest value is
  // what eventually persists.
  useEffect(() => {
    if (!dirtyRef.current) return;
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          await saveActuals(workoutId, state);
          setSavedAt(Date.now());
          setError(null);
        } catch (e) {
          console.error("Failed to save actuals", e);
          setError("Couldn't save — try again.");
        }
      })();
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [state, workoutId]);

  const patch = useCallback(<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    dirtyRef.current = true;
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  // Pre-seed the physio-exercise actual_detail array on first edit so
  // index-based patches don't have to deal with sparse undefineds.
  const seedExercises = useCallback(() => {
    if (state.detail?.exercises) return state.detail.exercises;
    return content.physioExercises.map((ex) => ({
      name: ex.name,
      done: false,
      pain: null,
      note: null,
    }));
  }, [content.physioExercises, state.detail]);

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

  // Mobility's DoneToggle drives status, not actuals. Skip the actuals
  // debounce path — flip status via logWorkout and update local state for
  // the toggle to reflect immediately.
  const onChangeDone = useCallback(
    (next: boolean) => {
      const nextStatus: WorkoutStatus = next ? "completed" : "pending";
      setLocalStatus(nextStatus);
      void logWorkout(workoutId, nextStatus).catch((e) => {
        console.error("Failed to set status", e);
        setLocalStatus(status);
        setError("Couldn't save status — try again.");
      });
    },
    [workoutId, status],
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
      onChangeDone,
      onChangePhysioExercise,
    }),
    [state, patch, onChangeDone, onChangePhysioExercise],
  );

  // Avoid an "unused" warning while leaving seedExercises ready for the
  // strength per-set work below.
  void seedExercises;
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
    </>
  );
}
