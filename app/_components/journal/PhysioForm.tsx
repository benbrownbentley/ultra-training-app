"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { createJournalEntry } from "@/app/actions";
import {
  PHYSIO_RESTRICTIONS,
  type PhysioDetails,
  type PhysioDurationUnit,
  type PhysioExercise,
} from "@/lib/journal";
import { Chip, FormSectionLabel } from "./atoms";
import { TabBar } from "@/app/_components/today/TabBar";
import { JournalDetailHeader } from "./DetailHeader";
import { ArrowRight } from "@/app/_components/today/icons";

const EMPTY_EXERCISE: PhysioExercise = {
  name: "",
  sets_reps: "",
  load: "",
  frequency: "",
};

export function PhysioForm() {
  const [physioName, setPhysioName] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [exercises, setExercises] = useState<PhysioExercise[]>([
    { ...EMPTY_EXERCISE },
  ]);
  const [durationValue, setDurationValue] = useState("4");
  const [durationUnit, setDurationUnit] =
    useState<PhysioDurationUnit>("weeks");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleRestriction(value: string) {
    setRestrictions((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function updateExercise(i: number, partial: Partial<PhysioExercise>) {
    setExercises((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, ...partial } : e)),
    );
  }

  function addExercise() {
    setExercises((prev) => [...prev, { ...EMPTY_EXERCISE }]);
  }

  function removeExercise(i: number) {
    setExercises((prev) => prev.filter((_, idx) => idx !== i));
  }

  const submit = useCallback(
    (regenAfter: boolean) => {
      if (!diagnosis.trim()) {
        setError("Diagnosis is required so the plan knows what to work around.");
        return;
      }
      setError(null);
      const cleanExercises = exercises.filter((e) => e.name.trim().length > 0);
      const details: PhysioDetails = {
        physio_name: physioName.trim() || null,
        visit_date: visitDate || new Date().toISOString().slice(0, 10),
        diagnosis: diagnosis.trim(),
        restrictions,
        exercises: cleanExercises,
        duration_value: durationValue ? Number(durationValue) : null,
        duration_unit: durationUnit,
      };
      startTransition(async () => {
        try {
          await createJournalEntry({
            type: "physio",
            entryDate: visitDate || undefined,
            body: notes,
            details,
            regenAfter,
          });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to save");
        }
      });
    },
    [
      physioName,
      visitDate,
      diagnosis,
      restrictions,
      exercises,
      durationValue,
      durationUnit,
      notes,
    ],
  );

  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <JournalDetailHeader />
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 pt-5 sm:px-5">
          <div>
            <div
              className="font-mono text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
              style={{ letterSpacing: "0.2em" }}
            >
              — ADD PHYSIO NOTES
            </div>
            <h1
              className="mt-1.5 text-[26px] font-medium leading-tight text-zinc-950 dark:text-zinc-50"
              style={{ letterSpacing: "-0.02em" }}
            >
              What did your physio say?
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <FieldBlock label="PHYSIO NAME">
              <input
                type="text"
                value={physioName}
                onChange={(e) => setPhysioName(e.target.value)}
                disabled={isPending}
                placeholder="Optional"
                className="rounded-[10px] border border-zinc-200 bg-white px-3 py-3 text-[14px] text-zinc-950 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
              />
            </FieldBlock>
            <FieldBlock label="VISIT">
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                disabled={isPending}
                className="rounded-[10px] border border-zinc-200 bg-white px-3 py-3 text-[14px] text-zinc-950 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
              />
            </FieldBlock>
          </div>

          <FieldBlock label="DIAGNOSIS" required>
            <input
              type="text"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              disabled={isPending}
              placeholder="e.g. Mild Achilles tendinopathy"
              className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
            />
          </FieldBlock>

          <FieldBlock label="RESTRICTIONS · multi-select">
            <div className="flex flex-wrap gap-1.5">
              {PHYSIO_RESTRICTIONS.map((r) => (
                <Chip
                  key={r}
                  multi
                  active={restrictions.includes(r)}
                  onClick={() => toggleRestriction(r)}
                  disabled={isPending}
                >
                  {r}
                </Chip>
              ))}
            </div>
          </FieldBlock>

          <div className="flex flex-col gap-2">
            <FormSectionLabel>PRESCRIBED EXERCISES</FormSectionLabel>
            <div className="flex flex-col gap-2">
              {exercises.map((ex, i) => (
                <div
                  key={i}
                  className="rounded-[10px] border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-[#0f0f11]"
                >
                  <div className="flex items-baseline justify-between gap-2.5">
                    <input
                      type="text"
                      value={ex.name}
                      onChange={(e) =>
                        updateExercise(i, { name: e.target.value })
                      }
                      disabled={isPending}
                      placeholder="Exercise name…"
                      className="flex-1 bg-transparent text-[14px] font-medium text-zinc-950 placeholder:text-zinc-400 focus:outline-none disabled:opacity-60 dark:text-zinc-50"
                    />
                    {exercises.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeExercise(i)}
                        disabled={isPending}
                        aria-label="Remove exercise"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-600 dark:hover:text-zinc-50"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M6 6l12 12M18 6L6 18"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="mt-2.5 grid grid-cols-[1fr_1fr_1.4fr] gap-2">
                    <ExerciseSubField
                      label="SETS · REPS"
                      value={ex.sets_reps}
                      onChange={(v) => updateExercise(i, { sets_reps: v })}
                      placeholder="3 × 10"
                      disabled={isPending}
                    />
                    <ExerciseSubField
                      label="LOAD"
                      value={ex.load}
                      onChange={(v) => updateExercise(i, { load: v })}
                      placeholder="bw"
                      disabled={isPending}
                    />
                    <ExerciseSubField
                      label="FREQUENCY"
                      value={ex.frequency}
                      onChange={(v) => updateExercise(i, { frequency: v })}
                      placeholder="3× / week"
                      disabled={isPending}
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addExercise}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-dashed border-zinc-200 px-3.5 py-2.5 text-[13px] font-medium text-zinc-950 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-50"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Add another exercise
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-3">
            <FieldBlock label="DURATION">
              <div className="flex items-baseline gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={durationValue}
                  onChange={(e) => setDurationValue(e.target.value)}
                  disabled={isPending || durationUnit === "until_resolved"}
                  className="w-20 rounded-[10px] border border-zinc-200 bg-white px-3 py-3 text-[14px] text-zinc-950 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
                />
                <span className="font-mono text-[11px] uppercase text-zinc-400 dark:text-zinc-600">
                  {durationUnit === "weeks" ? "weeks" : ""}
                </span>
              </div>
            </FieldBlock>
            <FieldBlock label="UNIT">
              <div className="flex flex-wrap gap-1.5">
                <Chip
                  active={durationUnit === "weeks"}
                  onClick={() => setDurationUnit("weeks")}
                  disabled={isPending}
                >
                  weeks
                </Chip>
                <Chip
                  active={durationUnit === "until_resolved"}
                  onClick={() => setDurationUnit("until_resolved")}
                  disabled={isPending}
                >
                  until symptoms resolve
                </Chip>
              </div>
            </FieldBlock>
          </div>

          <FieldBlock label="NOTES">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
              placeholder="Anything else worth noting?"
              rows={3}
              className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
            />
          </FieldBlock>

          {error && (
            <div className="rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2 text-[12.5px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>

      <Footer
        disabled={isPending}
        onSave={() => submit(false)}
        onSaveAndRegen={() => submit(true)}
        saving={isPending}
      />
      <TabBar active="journal" />
    </div>
  );
}

function FieldBlock({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <FormSectionLabel required={required}>{label}</FormSectionLabel>
      {children}
    </div>
  );
}

function ExerciseSubField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="font-mono text-[10px] uppercase text-zinc-500"
        style={{ letterSpacing: "0.18em" }}
      >
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="rounded-[8px] border border-zinc-200 bg-transparent px-2.5 py-2 text-[13px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-50 dark:focus:ring-emerald-500/10"
      />
    </div>
  );
}

function Footer({
  disabled,
  onSave,
  onSaveAndRegen,
  saving,
}: {
  disabled: boolean;
  onSave: () => void;
  onSaveAndRegen: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-zinc-200 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),18px)] sm:px-5 sm:pb-5 dark:border-zinc-800">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onSaveAndRegen}
          disabled={disabled}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save & regenerate plan"}
          {!saving && <ArrowRight color="#052e1f" size={16} />}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={disabled}
          className="inline-flex h-11 items-center justify-center rounded-[10px] border border-zinc-200 px-4 text-sm font-medium text-zinc-950 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-50"
        >
          Save only
        </button>
      </div>
      <div className="flex justify-end">
        <Link
          href="/journal"
          className="text-[13px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
