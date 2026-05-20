"use client";

import type { Terrain } from "@/lib/plan";
import {
  Chip,
  DateField,
  FieldBlock,
  FieldStack,
  FormSectionLabel,
  HelperText,
  RangeField,
  Segmented,
  SuffixField,
  TextField,
  TextareaField,
} from "./form-bits";
import {
  CROSS_OPTS,
  EQUIP_OPTS,
  FITNESS_LABELS,
  GYM_LABELS,
  GYM_OPTS,
  INTENT_LABELS,
  LONG_DAY_OPTS,
  QUALITY_DAY_OPTS,
  SEX_OPTS,
  SLEEP_OPTS,
  STRENGTH_FREQ_OPTS,
  TERRAIN_ACCESS_OPTS,
  TERRAIN_OPTS,
  TRAIN_DAYS,
  ULTRA_COUNT_OPTS,
  type WizardPayload,
  type WizardRaceInput,
} from "./wizard-types";

// Single-race form (A race). The B/C inline-add and saved-card flow live
// just below to keep the family in one file.
export function RaceFieldGroup({
  race,
  onChange,
  eyebrow = "A RACE",
  disabled,
}: {
  race: WizardRaceInput;
  onChange: (race: WizardRaceInput) => void;
  eyebrow?: string;
  disabled?: boolean;
}) {
  function set<K extends keyof WizardRaceInput>(
    key: K,
    value: WizardRaceInput[K],
  ) {
    onChange({ ...race, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3.5">
      <span
        className="font-mono text-[10px] uppercase text-emerald-700 dark:text-emerald-400"
        style={{ letterSpacing: "0.2em" }}
      >
        — {eyebrow}
      </span>
      <FieldBlock label="RACE NAME" required>
        <TextField
          value={race.name}
          onChange={(v) => set("name", v)}
          placeholder="e.g. Ultra-Trail du Mont-Blanc"
          disabled={disabled}
        />
      </FieldBlock>
      <FieldBlock label="RACE DATE" required>
        <DateField
          value={race.date}
          onChange={(v) => set("date", v)}
          disabled={disabled}
        />
      </FieldBlock>
      <FieldBlock label="DISTANCE" required>
        <SuffixField
          value={race.distance}
          onChange={(v) => set("distance", v)}
          suffix="km"
          placeholder="—"
          numeric
          disabled={disabled}
        />
      </FieldBlock>
      <FieldBlock label="ELEVATION GAIN · OPTIONAL">
        <SuffixField
          value={race.elevationGain != null ? String(race.elevationGain) : ""}
          onChange={(v) => set("elevationGain", v ? Number(v) : null)}
          suffix="m"
          placeholder="—"
          numeric
          disabled={disabled}
        />
      </FieldBlock>
      <FieldBlock label="TERRAIN">
        <div className="flex flex-wrap gap-1.5">
          {TERRAIN_OPTS.map((opt) => (
            <Chip
              key={opt.value}
              active={race.terrain === opt.value}
              onClick={() =>
                set(
                  "terrain",
                  race.terrain === opt.value ? null : (opt.value as Terrain),
                )
              }
              disabled={disabled}
            >
              {opt.label}
            </Chip>
          ))}
        </div>
      </FieldBlock>
    </div>
  );
}

// GOAL group (target time + effort intent). A-race form embeds this; B
// races also; C races skip it (effort locked to training-grade).
export function GoalFieldGroup({
  race,
  onChange,
  disabled,
}: {
  race: WizardRaceInput;
  onChange: (race: WizardRaceInput) => void;
  disabled?: boolean;
}) {
  const intent = INTENT_LABELS.find((i) => i.value === race.intent);
  return (
    <div className="flex flex-col gap-3.5">
      <span
        className="font-mono text-[10px] uppercase text-emerald-700 dark:text-emerald-400"
        style={{ letterSpacing: "0.2em" }}
      >
        — GOAL
      </span>
      <FieldBlock label="TARGET FINISH TIME · OPTIONAL">
        <SuffixField
          value={race.targetTime}
          onChange={(v) => onChange({ ...race, targetTime: v })}
          suffix="hh:mm"
          placeholder="—"
          disabled={disabled}
        />
        <HelperText>
          Optional — courses vary too much for tight predictions.
        </HelperText>
      </FieldBlock>
      <FieldBlock label="EFFORT INTENT">
        <Segmented
          options={INTENT_LABELS.map((i) => ({ value: i.value, label: i.label }))}
          value={race.intent}
          onChange={(v) => onChange({ ...race, intent: v })}
          disabled={disabled}
        />
        {intent && (
          <HelperText>
            <span className="mr-1.5 font-semibold text-emerald-500">
              {intent.label} —
            </span>
            {intent.help}
          </HelperText>
        )}
      </FieldBlock>
    </div>
  );
}

// Saved B/C race card shown after a sub-race has been added. Edit/remove
// hooks live on the parent.
export function SavedRaceCard({
  race,
  onEdit,
  onRemove,
  disabled,
}: {
  race: WizardRaceInput;
  onEdit: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const colour =
    race.priority === "B"
      ? "border-emerald-200 dark:border-emerald-500/40"
      : "border-zinc-200 dark:border-zinc-800 opacity-90";
  const badgeColour =
    race.priority === "B"
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-zinc-500";
  return (
    <div
      className={`flex items-center justify-between gap-2.5 rounded-[10px] border bg-transparent px-3.5 py-3 ${colour}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`inline-flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md border font-mono text-[11px] font-bold ${colour} ${badgeColour}`}
        >
          {race.priority}
        </span>
        <div className="flex min-w-0 flex-col">
          <span
            className="text-[14px] font-medium text-zinc-950 dark:text-zinc-50"
            style={{ letterSpacing: "-0.005em" }}
          >
            {race.name || "Unnamed race"}
          </span>
          <span className="font-mono text-[11px] text-zinc-500">
            {race.date || "—"} · {race.distance || "—"} km
            {race.elevationGain ? ` · +${race.elevationGain} m` : ""}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="bg-transparent px-2 py-1 text-[13px] font-medium text-emerald-700 dark:text-emerald-400"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label="Remove race"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-transparent text-zinc-400 hover:text-zinc-900 dark:text-zinc-600 dark:hover:text-zinc-50"
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
      </div>
    </div>
  );
}

// Inline B/C race add form. Switches between B/C priority; C hides goal
// fields and locks intent to "relaxed" (training-grade).
export function InlineRaceForm({
  race,
  onChange,
  onSave,
  onCancel,
  disabled,
}: {
  race: WizardRaceInput;
  onChange: (race: WizardRaceInput) => void;
  onSave: () => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const isB = race.priority === "B";
  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-emerald-200 bg-white p-3.5 dark:border-emerald-500/35 dark:bg-[#0f0f11]">
      <span
        className="font-mono text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
        style={{ letterSpacing: "0.2em" }}
      >
        — ADD RACE
      </span>
      <FieldBlock label="PRIORITY">
        <Segmented
          options={["B", "C"] as const}
          value={race.priority as "B" | "C"}
          onChange={(v) => onChange({ ...race, priority: v })}
          disabled={disabled}
        />
        <HelperText>
          <span className="mr-1.5 font-semibold text-emerald-500">
            {race.priority} —
          </span>
          {isB
            ? "Tune-up race. Raced hard, not peaked for."
            : "Training-grade — used as a workout, no taper."}
        </HelperText>
        <HelperText>
          Only one A race per plan. You can change it later in Profile.
        </HelperText>
      </FieldBlock>

      <RaceFieldGroup
        race={race}
        onChange={onChange}
        eyebrow={isB ? "B RACE" : "C RACE"}
        disabled={disabled}
      />

      {isB && <GoalFieldGroup race={race} onChange={onChange} disabled={disabled} />}

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="bg-transparent text-[13px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={disabled || !race.name.trim() || !race.date}
          className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-transparent px-3.5 text-[13px] font-medium text-zinc-950 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-50"
        >
          Save race
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── Step bodies ─────────────────────────

export function FitnessStepBody({
  data,
  set,
  disabled,
}: {
  data: WizardPayload;
  set: <K extends keyof WizardPayload>(k: K, v: WizardPayload[K]) => void;
  disabled?: boolean;
}) {
  return (
    <FieldStack>
      <FieldBlock label="SELF-RATED FITNESS · 1 STARTING — 5 COMPETITIVE">
        <RangeField
          value={data.fitnessRating}
          onChange={(v) => set("fitnessRating", v)}
          disabled={disabled}
        />
        <span className="font-mono text-[12px] text-emerald-700 dark:text-emerald-400">
          {data.fitnessRating} · {FITNESS_LABELS[data.fitnessRating - 1]}
        </span>
      </FieldBlock>
      <FieldBlock label="CURRENT WEEKLY VOLUME">
        <SuffixField
          value={data.weeklyVolumeKm != null ? String(data.weeklyVolumeKm) : ""}
          onChange={(v) => set("weeklyVolumeKm", v ? Number(v) : null)}
          suffix={data.unitSystem === "metric" ? "km" : "mi"}
          numeric
          disabled={disabled}
        />
      </FieldBlock>
      <FieldBlock label="CURRENT WEEKLY TIME">
        <SuffixField
          value={data.weeklyHours != null ? String(data.weeklyHours) : ""}
          onChange={(v) => set("weeklyHours", v ? Number(v) : null)}
          suffix="hrs"
          numeric
          disabled={disabled}
        />
      </FieldBlock>
      <FieldBlock label="LONGEST RUN · LAST MONTH">
        <SuffixField
          value={
            data.longestRunDistance != null
              ? String(data.longestRunDistance)
              : ""
          }
          onChange={(v) =>
            set("longestRunDistance", v ? Number(v) : null)
          }
          suffix={data.unitSystem === "metric" ? "km" : "mi"}
          numeric
          disabled={disabled}
        />
      </FieldBlock>
      <FieldBlock label="WHEN · OPTIONAL">
        <DateField
          value={data.longestRunDate ?? ""}
          onChange={(v) => set("longestRunDate", v || null)}
          disabled={disabled}
        />
      </FieldBlock>
    </FieldStack>
  );
}

export function ExperienceStepBody({
  data,
  set,
  disabled,
}: {
  data: WizardPayload;
  set: <K extends keyof WizardPayload>(k: K, v: WizardPayload[K]) => void;
  disabled?: boolean;
}) {
  return (
    <FieldStack>
      <FieldBlock label="YEARS OF RUNNING">
        <SuffixField
          value={data.yearsRunning != null ? String(data.yearsRunning) : ""}
          onChange={(v) => set("yearsRunning", v ? Number(v) : null)}
          suffix="yrs"
          numeric
          disabled={disabled}
        />
      </FieldBlock>
      <FieldBlock label="YEARS OF ULTRAS">
        <SuffixField
          value={data.yearsUltras != null ? String(data.yearsUltras) : ""}
          onChange={(v) => set("yearsUltras", v ? Number(v) : null)}
          suffix="yrs"
          numeric
          disabled={disabled}
        />
      </FieldBlock>
      <FieldBlock label="ULTRAS COMPLETED">
        <div className="flex flex-wrap gap-1.5">
          {ULTRA_COUNT_OPTS.map((o) => (
            <Chip
              key={o}
              active={data.ultrasCompleted === o}
              onClick={() => set("ultrasCompleted", o)}
              disabled={disabled}
            >
              {o}
            </Chip>
          ))}
        </div>
      </FieldBlock>
      <FieldBlock label="LONGEST RACE EVER COMPLETED">
        <SuffixField
          value={
            data.longestRaceDistance != null
              ? String(data.longestRaceDistance)
              : ""
          }
          onChange={(v) =>
            set("longestRaceDistance", v ? Number(v) : null)
          }
          suffix={data.unitSystem === "metric" ? "km" : "mi"}
          numeric
          disabled={disabled}
        />
      </FieldBlock>
      <FieldBlock label="RACE NAME · OPTIONAL">
        <TextField
          value={data.longestRaceName}
          onChange={(v) => set("longestRaceName", v)}
          placeholder="For your reference"
          disabled={disabled}
        />
      </FieldBlock>
      <FieldBlock label="DATE · OPTIONAL">
        <DateField
          value={data.longestRaceDate}
          onChange={(v) => set("longestRaceDate", v)}
          disabled={disabled}
        />
      </FieldBlock>
    </FieldStack>
  );
}

export function AboutYouStepBody({
  data,
  set,
  disabled,
}: {
  data: WizardPayload;
  set: <K extends keyof WizardPayload>(k: K, v: WizardPayload[K]) => void;
  disabled?: boolean;
}) {
  return (
    <FieldStack>
      <FieldBlock label="AGE" required>
        <SuffixField
          value={data.age != null ? String(data.age) : ""}
          onChange={(v) => set("age", v ? Number(v) : null)}
          suffix="yrs"
          numeric
          disabled={disabled}
        />
      </FieldBlock>
      <FieldBlock label="BIOLOGICAL SEX · OPTIONAL">
        <Segmented
          options={SEX_OPTS}
          value={data.sex || null}
          onChange={(v) => set("sex", v)}
          disabled={disabled}
        />
      </FieldBlock>
      <FieldBlock label="BODY WEIGHT · OPTIONAL">
        <SuffixField
          value={data.bodyWeight != null ? String(data.bodyWeight) : ""}
          onChange={(v) => set("bodyWeight", v ? Number(v) : null)}
          suffix={data.unitSystem === "metric" ? "kg" : "lb"}
          numeric
          disabled={disabled}
        />
        <HelperText>Used for fueling recommendations.</HelperText>
      </FieldBlock>
    </FieldStack>
  );
}

export function HealthStepBody({
  data,
  set,
  disabled,
}: {
  data: WizardPayload;
  set: <K extends keyof WizardPayload>(k: K, v: WizardPayload[K]) => void;
  disabled?: boolean;
}) {
  return (
    <FieldStack>
      <FieldBlock label="PAST INJURIES">
        <TextareaField
          value={data.injuryNotes}
          onChange={(v) => set("injuryNotes", v)}
          placeholder="e.g. Right Achilles tendinopathy 2024, recovered with PT."
          rows={4}
          disabled={disabled}
        />
        <HelperText>
          Brief notes on past injuries so we know what areas have been
          vulnerable.
        </HelperText>
      </FieldBlock>
      <FieldBlock label="CHRONIC CONDITIONS · OPTIONAL">
        <TextareaField
          value={data.chronicConditions}
          onChange={(v) => set("chronicConditions", v)}
          placeholder="asthma, diabetes, heart conditions, etc."
          rows={2}
          disabled={disabled}
        />
        <HelperText>Used for safety, not optimization.</HelperText>
      </FieldBlock>
      <FieldBlock label="AVERAGE SLEEP · HOURS">
        <div className="flex flex-wrap gap-1.5">
          {SLEEP_OPTS.map((o) => (
            <Chip
              key={o}
              active={data.sleepHours === Number(o)}
              onClick={() => set("sleepHours", Number(o))}
              disabled={disabled}
            >
              {o}
            </Chip>
          ))}
        </div>
      </FieldBlock>
      <FieldBlock label="STRESS BASELINE · 1 LOW — 5 HIGH">
        <RangeField
          value={data.stressBaseline}
          onChange={(v) => set("stressBaseline", v)}
          disabled={disabled}
        />
        <span className="font-mono text-[12px] text-emerald-700 dark:text-emerald-400">
          {data.stressBaseline} / 5
        </span>
      </FieldBlock>
    </FieldStack>
  );
}

export function ScheduleStepBody({
  data,
  set,
  disabled,
}: {
  data: WizardPayload;
  set: <K extends keyof WizardPayload>(k: K, v: WizardPayload[K]) => void;
  disabled?: boolean;
}) {
  function toggleDay(d: string) {
    const next = data.trainingDays.includes(d)
      ? data.trainingDays.filter((x) => x !== d)
      : [...data.trainingDays, d];
    set("trainingDays", next);
  }
  return (
    <FieldStack>
      <FieldBlock label="WEEKLY HOURS AVAILABLE">
        <SuffixField
          value={data.weeklyHours != null ? String(data.weeklyHours) : ""}
          onChange={(v) => set("weeklyHours", v ? Number(v) : null)}
          suffix="hrs"
          numeric
          disabled={disabled}
        />
      </FieldBlock>
      <FieldBlock label="TYPICAL TRAINING DAYS · multi-select">
        <div className="flex flex-wrap gap-1.5">
          {TRAIN_DAYS.map((d) => (
            <Chip
              key={d}
              multi
              active={data.trainingDays.includes(d)}
              onClick={() => toggleDay(d)}
              disabled={disabled}
            >
              {d}
            </Chip>
          ))}
        </div>
      </FieldBlock>
      <FieldBlock label="LONG RUN DAY">
        <Segmented
          options={LONG_DAY_OPTS}
          value={data.longRunDay || null}
          onChange={(v) => set("longRunDay", v)}
          disabled={disabled}
        />
      </FieldBlock>
      <FieldBlock label="QUALITY DAY">
        <Segmented
          options={QUALITY_DAY_OPTS}
          value={data.qualityDay || null}
          onChange={(v) => set("qualityDay", v)}
          disabled={disabled}
        />
        <HelperText>
          Your hardest workout of the week — tempo, threshold, intervals, or
          hills.
        </HelperText>
      </FieldBlock>
      <FieldBlock label="STRENGTH PER WEEK">
        <Segmented
          options={STRENGTH_FREQ_OPTS}
          value={data.strengthFreq || null}
          onChange={(v) => set("strengthFreq", v)}
          disabled={disabled}
        />
      </FieldBlock>
    </FieldStack>
  );
}

export function EquipmentStepBody({
  data,
  set,
  disabled,
}: {
  data: WizardPayload;
  set: <K extends keyof WizardPayload>(k: K, v: WizardPayload[K]) => void;
  disabled?: boolean;
}) {
  function toggle(list: keyof WizardPayload, value: string) {
    const current = (data[list] as string[]) ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    set(list, next as WizardPayload[typeof list]);
  }
  return (
    <FieldStack>
      <FieldBlock label="GYM ACCESS">
        <div className="flex flex-wrap gap-1.5">
          {GYM_OPTS.map((g) => (
            <Chip
              key={g}
              active={data.gymAccess === g}
              onClick={() => set("gymAccess", g)}
              disabled={disabled}
            >
              {GYM_LABELS[g]}
            </Chip>
          ))}
        </div>
      </FieldBlock>
      <FieldBlock label="EQUIPMENT · multi-select">
        <div className="flex flex-wrap gap-1.5">
          {EQUIP_OPTS.map((o) => (
            <Chip
              key={o}
              multi
              active={data.equipment.includes(o)}
              onClick={() => toggle("equipment", o)}
              disabled={disabled}
            >
              {o}
            </Chip>
          ))}
        </div>
      </FieldBlock>
      <FieldBlock label="OUTDOOR TERRAIN · multi-select">
        <div className="flex flex-wrap gap-1.5">
          {TERRAIN_ACCESS_OPTS.map((o) => (
            <Chip
              key={o}
              multi
              active={data.outdoorTerrain.includes(o)}
              onClick={() => toggle("outdoorTerrain", o)}
              disabled={disabled}
            >
              {o}
            </Chip>
          ))}
        </div>
      </FieldBlock>
      <FieldBlock label="CROSS-TRAINING · multi-select">
        <div className="flex flex-wrap gap-1.5">
          {CROSS_OPTS.map((o) => (
            <Chip
              key={o}
              multi
              active={data.crossTrainingEnjoys.includes(o)}
              onClick={() => toggle("crossTrainingEnjoys", o)}
              disabled={disabled}
            >
              {o}
            </Chip>
          ))}
        </div>
      </FieldBlock>
      <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-3.5 py-3 dark:border-emerald-500/35 dark:bg-emerald-500/[0.08]">
        <span
          className="font-mono text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
          style={{ letterSpacing: "0.2em" }}
        >
          — TIP
        </span>
        <p className="m-0 mt-1.5 text-[13px] leading-snug text-zinc-950 dark:text-zinc-50">
          After your plan is generated, you can add more detail (HR
          thresholds, recent race results, training preferences) in your
          Profile for a more personalized plan.
        </p>
      </div>
    </FieldStack>
  );
}

// Re-export for the races step.
export { FormSectionLabel };
