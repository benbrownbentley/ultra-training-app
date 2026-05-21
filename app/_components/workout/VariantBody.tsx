"use client";

// Composes the right Workout Detail variant (Running, Strength, Physio,
// Cross, Mobility, Hike) into the shared page chrome. Each variant is a
// fragment of sections; the page mounts the chosen body inside the shared
// shell. All log fields are now controlled via the ActualsBindings the
// parent ActualsForm provides — variants that don't need a field simply
// don't read it.

import { useState } from "react";
import type { WorkoutContent } from "@/lib/workout-content";
import type { ActualDetail, WorkoutStatus } from "@/lib/plan";
import { Section } from "./Section";
import {
  EffortSlider,
  FieldRow,
  FuelingCallout,
  GlossaryLink,
  NotesField,
  PhysioExerciseRow,
  RoutineRow,
  SegmentRow,
  WarmupCallout,
  WhyParagraph,
  DoneToggle,
} from "./atoms";
import { StrengthExerciseRow } from "./StrengthExerciseRow";
import { AddExerciseInline } from "./AddExerciseInline";
import { TimeInZoneForm } from "./TimeInZoneForm";

type Variant = "upcoming" | "logged" | "skipped" | "missed" | "future";

// One shape for every variant. The parent ActualsForm passes the same
// bindings object down; variants destructure only what they render. Keeps
// the prop surface boring and additive — new fields go in once.
export interface ActualsBindings {
  duration_min: number | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
  hr_avg: number | null;
  rpe: number | null;
  notes: string;
  detail: ActualDetail | null;
  onChangeDuration: (next: number | null) => void;
  onChangeDistance: (next: number | null) => void;
  onChangeElevation: (next: number | null) => void;
  onChangeHr: (next: number | null) => void;
  onChangeRpe: (next: number) => void;
  onChangeNotes: (next: string) => void;
  // Running: minutes-per-zone breakdown, captured by the TimeInZoneForm
  // and persisted into actual_detail.zones.
  onChangeZones: (next: { label: string; minutes: number }[]) => void;
  // Mobility's "Mark this whole routine done" toggle. Page wires this to
  // logWorkout(id, completed/pending) — distinct from saveActuals.
  onChangeDone: (next: boolean) => void;
  // Physio: array of per-exercise actuals. ActualsForm derives the shape
  // from content.physioExercises on mount so the indices line up.
  onChangePhysioExercise: (
    index: number,
    patch: { done?: boolean; pain?: number; note?: string },
  ) => void;
  // Strength: per-exercise mutations keyed by exerciseName. The form
  // owns the actual_detail.sets array; these patches splice it without
  // the caller having to know the full shape.
  onAddSet: (exerciseName: string, unit: string) => void;
  onChangeSet: (
    exerciseName: string,
    index: number,
    patch: { reps?: number; weight?: number },
  ) => void;
  onRemoveSet: (exerciseName: string, index: number) => void;
  onToggleSkipExercise: (exerciseName: string) => void;
  // Bulk-marks every set done at planned reps + weight. Replaces any
  // existing actual sets for the named exercise.
  onMarkDoneAtPlanned: (
    exerciseName: string,
    planned: { sets: number; reps: number; weight: number; unit: string },
  ) => void;
  // Appends a user-defined exercise with the planned defaults; seeds
  // sets[] so the row reads as DONE AT PLANNED immediately.
  onAddCustomExercise: (input: {
    name: string;
    sets: number;
    reps: number;
    weight: number;
    unit: string;
  }) => void;
}

interface CommonProps {
  content: WorkoutContent;
  variant: Variant;
  status: WorkoutStatus;
  loggedAt: string | null;
  isFuture: boolean;
  bindings: ActualsBindings;
}

// Helper: "Logged Tue 17 May · 6:42 PM" caption shown beside the LOG label.
function loggedCaption(iso: string): string {
  const d = new Date(iso);
  const date = d
    .toLocaleDateString("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    })
    .toUpperCase();
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `LOGGED ${date} · ${time}`;
}

function logSectionLabel(variant: Variant): string {
  if (variant === "future") return "LOG · AVAILABLE ON THE DAY";
  return "LOG";
}

function rightCaption(variant: Variant, loggedAt: string | null) {
  if (variant !== "logged" || !loggedAt) return undefined;
  return (
    <span
      className="font-mono text-[10px] uppercase text-zinc-400 dark:text-zinc-600"
      style={{ letterSpacing: "0.18em" }}
    >
      {loggedCaption(loggedAt)}
    </span>
  );
}

// ─── Running ────────────────────────────────────────────────
export function RunningBody({
  content,
  variant,
  loggedAt,
  isFuture,
  bindings: b,
}: CommonProps) {
  const logHidden = variant === "skipped";
  const zones = b.detail?.zones ?? [];

  return (
    <>
      {content.segments.length > 0 && (
        <Section label="STRUCTURE">
          <div>
            {content.segments.map((s, i) => (
              <SegmentRow key={i} {...s} />
            ))}
          </div>
        </Section>
      )}

      <Section label="WHY">
        <WhyParagraph>{content.why}</WhyParagraph>
        {content.glossarySlug && (
          <GlossaryLink href={`/profile/glossary/${content.glossarySlug}`}>
            {content.glossaryLabel}
          </GlossaryLink>
        )}
      </Section>

      {!logHidden && (
        <Section
          label={logSectionLabel(variant)}
          right={rightCaption(variant, loggedAt)}
        >
          <div className="flex flex-col gap-2">
            <FieldRow
              label="Duration"
              value={b.duration_min}
              onChange={b.onChangeDuration}
              unit="min"
              disabled={isFuture}
            />
            <FieldRow
              label="Distance"
              value={b.distance_km}
              onChange={b.onChangeDistance}
              unit="km"
              disabled={isFuture}
            />
            <FieldRow
              label="Vert"
              value={b.elevation_gain_m}
              onChange={b.onChangeElevation}
              unit="m"
              disabled={isFuture}
            />
            <FieldRow
              label="Avg HR"
              value={b.hr_avg}
              onChange={b.onChangeHr}
              unit="bpm"
              disabled={isFuture}
            />
            <TimeInZoneForm
              zones={zones.length > 0 ? zones : null}
              onChange={b.onChangeZones}
              disabled={isFuture}
            />
          </div>
        </Section>
      )}

      {!logHidden && (
        <Section label="NOTES">
          <NotesField
            value={b.notes}
            onChange={b.onChangeNotes}
            disabled={isFuture}
          />
        </Section>
      )}
    </>
  );
}

// ─── Strength ───────────────────────────────────────────────
export function StrengthBody({
  content,
  variant,
  loggedAt,
  isFuture,
  bindings: b,
}: CommonProps) {
  const isLogged = variant === "logged";
  const detail = b.detail ?? null;
  const allSets = detail?.sets ?? [];
  const skippedNames = new Set(detail?.skipped_exercises ?? []);
  const addedExercises = detail?.added_exercises ?? [];
  const [adding, setAdding] = useState(false);
  // Pick a sensible unit default for the inline form. Fall back to kg
  // when no parsed exercise has one — most ultra-strength plans are
  // metric, and the user can flip per-exercise.
  const defaultUnit: "kg" | "lb" =
    content.exercises.find((e) => e.unit === "lb")?.unit === "lb" ? "lb" : "kg";

  return (
    <>
      <Section label="WHY">
        <WhyParagraph>{content.why}</WhyParagraph>
        {content.glossarySlug && (
          <GlossaryLink href={`/profile/glossary/${content.glossarySlug}`}>
            {content.glossaryLabel}
          </GlossaryLink>
        )}
      </Section>

      <Section
        label={isLogged ? "LOG" : "EXERCISES · TAP TO EXPAND"}
        right={rightCaption(variant, loggedAt)}
      >
        <div className="flex flex-col gap-2">
          {content.warmup && (
            <WarmupCallout
              duration={content.warmup.duration}
              note={content.warmup.note}
              items={content.warmup.items}
            />
          )}
          {content.exercises.length === 0 && addedExercises.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-zinc-200 px-3.5 py-3 text-[13px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
              Exercise list will appear here once your plan stores structured
              sets and reps. For now, follow the prescription above and use
              &ldquo;+ Add exercise&rdquo; to log what you did.
            </div>
          ) : (
            <>
              {content.exercises.map((ex, i) => {
                const setsForEx = allSets.filter(
                  (s) => s.exerciseName === ex.name,
                );
                return (
                  <StrengthExerciseRow
                    key={`planned-${i}`}
                    planned={ex}
                    sets={setsForEx}
                    skipped={skippedNames.has(ex.name)}
                    isCustom={false}
                    onAddSet={() =>
                      b.onAddSet(ex.name, ex.unit ?? defaultUnit)
                    }
                    onChangeSet={(idx, patch) =>
                      b.onChangeSet(ex.name, idx, patch)
                    }
                    onRemoveSet={(idx) => b.onRemoveSet(ex.name, idx)}
                    onToggleSkip={() => b.onToggleSkipExercise(ex.name)}
                    onMarkDoneAtPlanned={() =>
                      b.onMarkDoneAtPlanned(ex.name, {
                        sets: ex.sets,
                        reps: ex.reps,
                        weight: Number(ex.weight ?? 0),
                        unit: ex.unit ?? defaultUnit,
                      })
                    }
                    disabled={isFuture}
                  />
                );
              })}
              {addedExercises.map((ex, i) => {
                const setsForEx = allSets.filter(
                  (s) => s.exerciseName === ex.name,
                );
                return (
                  <StrengthExerciseRow
                    key={`custom-${i}`}
                    planned={{
                      name: ex.name,
                      sets: ex.plannedSets,
                      reps: ex.plannedReps,
                      weight: String(ex.plannedWeight),
                      unit: ex.plannedUnit,
                    }}
                    sets={setsForEx}
                    skipped={skippedNames.has(ex.name)}
                    isCustom
                    onAddSet={() => b.onAddSet(ex.name, ex.plannedUnit)}
                    onChangeSet={(idx, patch) =>
                      b.onChangeSet(ex.name, idx, patch)
                    }
                    onRemoveSet={(idx) => b.onRemoveSet(ex.name, idx)}
                    onToggleSkip={() => b.onToggleSkipExercise(ex.name)}
                    onMarkDoneAtPlanned={() =>
                      b.onMarkDoneAtPlanned(ex.name, {
                        sets: ex.plannedSets,
                        reps: ex.plannedReps,
                        weight: ex.plannedWeight,
                        unit: ex.plannedUnit,
                      })
                    }
                    disabled={isFuture}
                  />
                );
              })}
            </>
          )}

          {adding ? (
            <AddExerciseInline
              defaultUnit={defaultUnit}
              onSave={(input) => {
                b.onAddCustomExercise(input);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
              disabled={isFuture}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={isFuture}
              className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-zinc-200 px-3.5 py-2.5 text-[13px] font-medium text-emerald-700 transition active:scale-[0.97] hover:border-emerald-300 disabled:opacity-50 dark:border-zinc-800 dark:text-emerald-400"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Add exercise
            </button>
          )}
        </div>
      </Section>

      <Section label="NOTES">
        <NotesField
          value={b.notes}
          onChange={b.onChangeNotes}
          disabled={isFuture}
        />
      </Section>
    </>
  );
}

// ─── Physio ─────────────────────────────────────────────────
export function PhysioBody({ content, isFuture, bindings: b }: CommonProps) {
  const exercises = b.detail?.exercises ?? [];
  return (
    <>
      <Section label="WHY">
        <WhyParagraph>{content.why}</WhyParagraph>
        {content.glossarySlug && (
          <GlossaryLink href={`/profile/glossary/${content.glossarySlug}`}>
            {content.glossaryLabel}
          </GlossaryLink>
        )}
      </Section>

      <Section label="EXERCISES">
        <div className="flex flex-col gap-2">
          {content.physioExercises.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-zinc-200 px-3.5 py-3 text-[13px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
              Per-exercise pain logging will appear here as the plan emits
              structured physio routines.
            </div>
          ) : (
            content.physioExercises.map((ex, i) => {
              const captured = exercises[i];
              return (
                <PhysioExerciseRow
                  key={i}
                  name={ex.name}
                  spec={ex.spec}
                  pain={captured?.pain ?? null}
                  notes={captured?.note ?? ""}
                  done={captured?.done ?? false}
                  onChangeDone={(next) =>
                    b.onChangePhysioExercise(i, { done: next })
                  }
                  onChangePain={(next) =>
                    b.onChangePhysioExercise(i, { pain: next })
                  }
                  onChangeNote={(next) =>
                    b.onChangePhysioExercise(i, { note: next })
                  }
                  disabled={isFuture}
                />
              );
            })
          )}
        </div>
      </Section>

      <Section label="NOTES">
        <NotesField
          value={b.notes}
          onChange={b.onChangeNotes}
          disabled={isFuture}
        />
      </Section>
    </>
  );
}

// ─── Cross-training (cycling / swim) ────────────────────────
export function CrossBody({
  content,
  variant,
  loggedAt,
  isFuture,
  bindings: b,
}: CommonProps) {
  return (
    <>
      {content.segments.length > 0 && (
        <Section label="STRUCTURE">
          <div>
            {content.segments.map((s, i) => (
              <SegmentRow key={i} {...s} />
            ))}
          </div>
        </Section>
      )}

      <Section label="WHY">
        <WhyParagraph>{content.why}</WhyParagraph>
        {content.glossarySlug && (
          <GlossaryLink href={`/profile/glossary/${content.glossarySlug}`}>
            {content.glossaryLabel}
          </GlossaryLink>
        )}
      </Section>

      <Section label={logSectionLabel(variant)} right={rightCaption(variant, loggedAt)}>
        <div className="flex flex-col gap-2">
          <FieldRow
            label="Duration"
            value={b.duration_min}
            onChange={b.onChangeDuration}
            unit="min"
            disabled={isFuture}
          />
          <EffortSlider
            value={b.rpe}
            onChange={b.onChangeRpe}
            disabled={isFuture}
          />
          <FieldRow
            label="Avg HR"
            value={b.hr_avg}
            onChange={b.onChangeHr}
            unit="bpm"
            disabled={isFuture}
          />
        </div>
      </Section>

      <Section label="NOTES">
        <NotesField
          value={b.notes}
          onChange={b.onChangeNotes}
          disabled={isFuture}
        />
      </Section>
    </>
  );
}

// ─── Mobility ───────────────────────────────────────────────
export function MobilityBody({
  content,
  variant,
  loggedAt,
  status,
  isFuture,
  bindings: b,
}: CommonProps) {
  return (
    <>
      {content.routine.length > 0 && (
        <Section label="ROUTINE">
          <div className="flex flex-col gap-1.5">
            {content.routine.map((r, i) => (
              <RoutineRow key={i} name={r.name} spec={r.spec} />
            ))}
          </div>
        </Section>
      )}

      <Section label="WHY">
        <WhyParagraph>{content.why}</WhyParagraph>
        {content.glossarySlug && (
          <GlossaryLink href={`/profile/glossary/${content.glossarySlug}`}>
            {content.glossaryLabel}
          </GlossaryLink>
        )}
      </Section>

      <Section label={logSectionLabel(variant)} right={rightCaption(variant, loggedAt)}>
        <div className="flex flex-col gap-2">
          <DoneToggle
            done={status === "completed"}
            onChange={b.onChangeDone}
            disabled={isFuture}
          />
          <FieldRow
            label="Actual duration"
            value={b.duration_min}
            onChange={b.onChangeDuration}
            unit="min"
            disabled={isFuture}
          />
        </div>
      </Section>

      <Section label="NOTES">
        <NotesField
          value={b.notes}
          onChange={b.onChangeNotes}
          disabled={isFuture}
        />
      </Section>
    </>
  );
}

// ─── Hike ───────────────────────────────────────────────────
export function HikeBody({
  content,
  variant,
  loggedAt,
  isFuture,
  bindings: b,
}: CommonProps) {
  return (
    <>
      {content.fueling && (
        <div className="px-4 pt-2 sm:px-5">
          <FuelingCallout body={content.fueling} />
        </div>
      )}

      {content.segments.length > 0 && (
        <Section label="STRUCTURE">
          <div>
            {content.segments.map((s, i) => (
              <SegmentRow key={i} {...s} />
            ))}
          </div>
        </Section>
      )}

      <Section label="WHY">
        <WhyParagraph>{content.why}</WhyParagraph>
        {content.glossarySlug && (
          <GlossaryLink href={`/profile/glossary/${content.glossarySlug}`}>
            {content.glossaryLabel}
          </GlossaryLink>
        )}
      </Section>

      <Section label={logSectionLabel(variant)} right={rightCaption(variant, loggedAt)}>
        <div className="flex flex-col gap-2">
          <FieldRow
            label="Time on feet"
            value={b.duration_min}
            onChange={b.onChangeDuration}
            unit="min"
            disabled={isFuture}
          />
          <FieldRow
            label="Vert"
            value={b.elevation_gain_m}
            onChange={b.onChangeElevation}
            unit="m"
            disabled={isFuture}
          />
          <FieldRow
            label="Distance"
            value={b.distance_km}
            onChange={b.onChangeDistance}
            unit="km"
            disabled={isFuture}
          />
          <FieldRow
            label="Avg HR"
            value={b.hr_avg}
            onChange={b.onChangeHr}
            unit="bpm"
            disabled={isFuture}
          />
          <EffortSlider
            value={b.rpe}
            onChange={b.onChangeRpe}
            disabled={isFuture}
          />
        </div>
      </Section>

      <Section label="NOTES">
        <NotesField
          value={b.notes}
          onChange={b.onChangeNotes}
          disabled={isFuture}
        />
      </Section>
    </>
  );
}

// ─── Dispatcher ─────────────────────────────────────────────
export function VariantBody(props: CommonProps) {
  const { content } = props;
  switch (content.subtype) {
    case "running":
      return <RunningBody {...props} />;
    case "strength":
      return <StrengthBody {...props} />;
    case "physio":
      return <PhysioBody {...props} />;
    case "cross":
      return <CrossBody {...props} />;
    case "mobility":
      return <MobilityBody {...props} />;
    case "hike":
      return <HikeBody {...props} />;
  }
}
