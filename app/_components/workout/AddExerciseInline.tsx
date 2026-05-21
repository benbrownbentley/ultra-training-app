"use client";

// Inline form for adding a user-defined strength exercise on top of the
// planned list (PDF pages 29, 31). Fields collapse onto two rows: name
// at full width, sets/reps/weight/unit on row two. Save bubbles up to
// ActualsForm which mutates actual_detail.added_exercises +
// actual_detail.sets in one transaction.

import { useState } from "react";

interface Props {
  defaultUnit: "kg" | "lb";
  onSave: (input: {
    name: string;
    sets: number;
    reps: number;
    weight: number;
    unit: string;
  }) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function AddExerciseInline({ defaultUnit, onSave, onCancel, disabled }: Props) {
  const [name, setName] = useState("");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(8);
  const [weight, setWeight] = useState(0);
  const [unit, setUnit] = useState<"kg" | "lb">(defaultUnit);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!name.trim()) {
      setError("Name the exercise.");
      return;
    }
    if (sets <= 0 || reps <= 0) {
      setError("Sets and reps need to be positive.");
      return;
    }
    setError(null);
    onSave({ name: name.trim(), sets, reps, weight, unit });
  }

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-500/35 dark:bg-emerald-500/[0.06]">
      <span
        className="font-mono text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
        style={{ letterSpacing: "0.2em" }}
      >
        — ADD EXERCISE
      </span>
      <label className="flex flex-col gap-1">
        <span
          className="font-mono text-[10px] uppercase text-zinc-500"
          style={{ letterSpacing: "0.18em" }}
        >
          NAME
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hip Thrust"
          disabled={disabled}
          autoFocus
          className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[13.5px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:placeholder:text-zinc-600"
        />
      </label>

      <div className="grid grid-cols-4 gap-2">
        <NumField label="SETS" value={sets} onChange={setSets} disabled={disabled} />
        <NumField label="REPS" value={reps} onChange={setReps} disabled={disabled} />
        <NumField label="WEIGHT" value={weight} onChange={setWeight} disabled={disabled} />
        <label className="flex flex-col gap-1">
          <span
            className="font-mono text-[10px] uppercase text-zinc-500"
            style={{ letterSpacing: "0.18em" }}
          >
            UNIT
          </span>
          <div className="flex h-[34px] overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0f0f11]">
            {(["kg", "lb"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                disabled={disabled}
                className={`flex-1 font-mono text-[11px] uppercase transition ${
                  unit === u
                    ? "bg-emerald-500 text-emerald-950"
                    : "text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50"
                }`}
                style={{ letterSpacing: "0.14em" }}
              >
                {u}
              </button>
            ))}
          </div>
        </label>
      </div>

      {error && (
        <div className="font-mono text-[11px] text-red-600 dark:text-red-500">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="text-[12.5px] font-medium text-zinc-500 hover:text-zinc-950 disabled:opacity-50 dark:hover:text-zinc-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-600 bg-emerald-500 px-3 text-[12.5px] font-semibold text-emerald-950 transition active:scale-[0.97] hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="font-mono text-[10px] uppercase text-zinc-500"
        style={{ letterSpacing: "0.18em" }}
      >
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        disabled={disabled}
        className="h-[34px] rounded-md border border-zinc-200 bg-white px-2 text-right font-mono text-[13.5px] font-medium text-zinc-950 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50"
      />
    </label>
  );
}
