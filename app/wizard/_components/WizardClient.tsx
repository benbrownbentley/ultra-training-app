"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { submitWizard, type WizardPayload } from "@/app/actions";
import type {
  AthleteProfile,
  GymAccess,
  Intent,
  Race,
  Terrain,
  UnitSystem,
} from "@/lib/plan";

interface Props {
  race: Race | null;
  profile: AthleteProfile | null;
}

const STEPS = ["Race", "Athlete", "Constraints"] as const;

const VOLUME_OPTIONS_METRIC = [
  "Under 10 km",
  "10-20 km",
  "20-30 km",
  "30-50 km",
  "50-80 km",
  "80+ km",
];
const VOLUME_OPTIONS_IMPERIAL = [
  "Under 6 mi",
  "6-12 mi",
  "12-20 mi",
  "20-30 mi",
  "30-50 mi",
  "50+ mi",
];

export function WizardClient({ race, profile }: Props) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState<WizardPayload>({
    unitSystem: profile?.unit_system ?? "metric",
    raceName: race?.name ?? "",
    raceDistance: race?.distance ?? "",
    raceDate: race?.date ?? "",
    elevationGain: race?.elevation_gain ?? null,
    terrain: race?.terrain ?? null,
    targetTime: race?.target_time ?? "",
    intent: race?.intent ?? null,
    weeklyVolume: profile?.weekly_volume ?? "",
    longestRunDistance: profile?.longest_run_distance ?? 0,
    easyPace: (profile?.easy_pace ?? "").replace(/\s*\/\s*(km|mi)\s*$/i, ""),
    experience: profile?.experience ?? "",
    injuryNotes: profile?.injury_notes ?? "",
    gymAccess: profile?.gym_access ?? null,
    equipment: profile?.equipment ?? "",
    weeklyHours: profile?.weekly_hours ?? null,
    crossTraining: profile?.cross_training ?? "",
    otherCommitments: profile?.other_commitments ?? "",
    sleepStress: profile?.sleep_stress ?? "",
  });

  const distUnit = data.unitSystem === "metric" ? "km" : "mi";
  const paceUnit = data.unitSystem === "metric" ? "min/km" : "min/mi";
  const elevUnit = data.unitSystem === "metric" ? "m" : "ft";
  const volumeOptions =
    data.unitSystem === "metric"
      ? VOLUME_OPTIONS_METRIC
      : VOLUME_OPTIONS_IMPERIAL;

  function update<K extends keyof WizardPayload>(
    key: K,
    value: WizardPayload[K],
  ) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function canAdvanceFromRace(): string | null {
    if (!data.raceName.trim()) return "Race name is required.";
    if (!data.raceDistance.trim()) return "Distance is required.";
    if (!data.raceDate.trim()) return "Race date is required.";
    return null;
  }

  function canAdvanceFromAthlete(): string | null {
    if (!data.weeklyVolume.trim()) return "Weekly running volume is required.";
    if (!data.longestRunDistance || data.longestRunDistance <= 0)
      return "Longest recent run is required.";
    if (!data.easyPace.trim()) return "Easy pace is required.";
    return null;
  }

  function next() {
    setError(null);
    const validator = [canAdvanceFromRace, canAdvanceFromAthlete, () => null][
      step
    ];
    const err = validator?.();
    if (err) {
      setError(err);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function prev() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function submit() {
    const err = canAdvanceFromRace() ?? canAdvanceFromAthlete();
    if (err) {
      setError(err);
      setStep(canAdvanceFromRace() ? 0 : 1);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await submitWizard(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save setup.");
      }
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 sm:py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          {race ? "Edit setup" : "Set up your plan"}
        </h1>
        <div className="text-[11px] tabular-nums text-zinc-400">
          Step {step + 1} of {STEPS.length}
        </div>
      </header>

      <div className="flex gap-1.5">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`h-1 flex-1 rounded-full transition ${
              i <= step ? "bg-emerald-600" : "bg-zinc-200 dark:bg-zinc-800"
            }`}
            aria-hidden
          />
        ))}
      </div>

      <section className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {STEPS[step]}
        </h2>

        {step === 0 && (
          <div className="flex flex-col gap-4">
            <Field label="Units">
              <RadioGroup
                value={data.unitSystem}
                onValueChange={(v) => update("unitSystem", v as UnitSystem)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="metric" id="unit-metric" />
                  <Label htmlFor="unit-metric">Metric (km)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="imperial" id="unit-imperial" />
                  <Label htmlFor="unit-imperial">Imperial (mi)</Label>
                </div>
              </RadioGroup>
            </Field>

            <Field label="Race name" htmlFor="raceName">
              <Input
                id="raceName"
                value={data.raceName}
                onChange={(e) => update("raceName", e.target.value)}
                placeholder="Squamish 50K"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Distance" htmlFor="raceDistance">
                <Input
                  id="raceDistance"
                  value={data.raceDistance}
                  onChange={(e) => update("raceDistance", e.target.value)}
                  placeholder="50K"
                />
              </Field>

              <Field label="Race date" htmlFor="raceDate">
                <Input
                  id="raceDate"
                  type="date"
                  value={data.raceDate}
                  onChange={(e) => update("raceDate", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`Elevation gain (${elevUnit})`} htmlFor="elevation">
                <Input
                  id="elevation"
                  type="number"
                  min={0}
                  value={data.elevationGain ?? ""}
                  onChange={(e) =>
                    update(
                      "elevationGain",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  placeholder={data.unitSystem === "metric" ? "2400" : "7900"}
                />
              </Field>

              <Field label="Terrain" htmlFor="terrain">
                <Select
                  value={data.terrain ?? ""}
                  onValueChange={(v) => update("terrain", v as Terrain)}
                >
                  <SelectTrigger id="terrain">
                    <SelectValue placeholder="Select terrain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="road">Road</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="trail">Trail</SelectItem>
                    <SelectItem value="technical">Technical trail</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field
              label="Target finish time (optional)"
              htmlFor="targetTime"
              hint="Hours:minutes"
            >
              <Input
                id="targetTime"
                value={data.targetTime}
                onChange={(e) => update("targetTime", e.target.value)}
                placeholder="e.g. 6:30"
              />
            </Field>

            <Field label="Race intent (optional)">
              <RadioGroup
                value={data.intent ?? ""}
                onValueChange={(v) => update("intent", v as Intent)}
                className="flex gap-4"
              >
                {(["competitive", "moderate", "relaxed"] as const).map((v) => (
                  <div key={v} className="flex items-center gap-2">
                    <RadioGroupItem value={v} id={`intent-${v}`} />
                    <Label htmlFor={`intent-${v}`} className="capitalize">
                      {v}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <Field
              label="Current weekly running volume"
              htmlFor="weeklyVolume"
            >
              <Select
                value={data.weeklyVolume}
                onValueChange={(v) => update("weeklyVolume", v)}
              >
                <SelectTrigger id="weeklyVolume">
                  <SelectValue placeholder="Select your weekly range" />
                </SelectTrigger>
                <SelectContent>
                  {volumeOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label={`Longest recent run (${distUnit})`}
                htmlFor="longestRun"
                hint="In the past 4 weeks"
              >
                <Input
                  id="longestRun"
                  type="number"
                  min={1}
                  value={data.longestRunDistance || ""}
                  onChange={(e) =>
                    update("longestRunDistance", Number(e.target.value || 0))
                  }
                  placeholder={data.unitSystem === "metric" ? "22" : "14"}
                />
              </Field>

              <Field
                label={`Comfortable easy pace (${paceUnit})`}
                htmlFor="easyPace"
              >
                <Input
                  id="easyPace"
                  value={data.easyPace}
                  onChange={(e) => update("easyPace", e.target.value)}
                  placeholder={
                    data.unitSystem === "metric" ? "6:00" : "9:30"
                  }
                />
              </Field>
            </div>

            <Field
              label="Endurance experience"
              htmlFor="experience"
              hint="First ultra? Marathons? Years of running?"
            >
              <Textarea
                id="experience"
                rows={3}
                value={data.experience}
                onChange={(e) => update("experience", e.target.value)}
                placeholder="e.g. Run 4 years, 3 half marathons, this is my first ultra."
              />
            </Field>

            <Field
              label="Injury history & current issues"
              htmlFor="injuryNotes"
              hint="Anything Claude should know about so the plan ramps safely"
            >
              <Textarea
                id="injuryNotes"
                rows={3}
                value={data.injuryNotes}
                onChange={(e) => update("injuryNotes", e.target.value)}
                placeholder="e.g. Sprained left ankle, posterior tib tendonitis in the right…"
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <Field label="Gym access">
              <RadioGroup
                value={data.gymAccess ?? ""}
                onValueChange={(v) => update("gymAccess", v as GymAccess)}
                className="flex gap-4"
              >
                {(["full", "limited", "none"] as const).map((v) => (
                  <div key={v} className="flex items-center gap-2">
                    <RadioGroupItem value={v} id={`gym-${v}`} />
                    <Label htmlFor={`gym-${v}`} className="capitalize">
                      {v}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </Field>

            <Field
              label="Equipment available"
              htmlFor="equipment"
              hint="Treadmill, indoor trainer, weights, etc."
            >
              <Textarea
                id="equipment"
                rows={2}
                value={data.equipment}
                onChange={(e) => update("equipment", e.target.value)}
                placeholder="e.g. Full gym, indoor bike trainer at home, no treadmill"
              />
            </Field>

            <Field
              label="Weekly training time (hours)"
              htmlFor="weeklyHours"
              hint="Realistic capacity"
            >
              <Input
                id="weeklyHours"
                type="number"
                min={1}
                max={30}
                value={data.weeklyHours ?? ""}
                onChange={(e) =>
                  update(
                    "weeklyHours",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                placeholder="8"
              />
            </Field>

            <Field
              label="Cross-training preferences"
              htmlFor="crossTraining"
              hint="Optional"
            >
              <Textarea
                id="crossTraining"
                rows={2}
                value={data.crossTraining}
                onChange={(e) => update("crossTraining", e.target.value)}
                placeholder="e.g. Happy on the bike, hate the pool"
              />
            </Field>

            <Field
              label="Other commitments to work around"
              htmlFor="otherCommitments"
              hint="Upcoming trips, races, work travel, life events"
            >
              <Textarea
                id="otherCommitments"
                rows={2}
                value={data.otherCommitments}
                onChange={(e) => update("otherCommitments", e.target.value)}
                placeholder="e.g. Vacation June 15-22 with limited training access"
              />
            </Field>

            <Field
              label="Sleep & stress baseline"
              htmlFor="sleepStress"
              hint="Helps calibrate recovery"
            >
              <Textarea
                id="sleepStress"
                rows={2}
                value={data.sleepStress}
                onChange={(e) => update("sleepStress", e.target.value)}
                placeholder="e.g. 7h average sleep, moderate work stress"
              />
            </Field>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={prev}
          disabled={step === 0 || isPending}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next} disabled={isPending}>
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={isPending}>
            {isPending ? "Generating plan…" : "Save & generate plan"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {children}
      {hint && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</div>
      )}
    </div>
  );
}
