"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { saveAthleteProfile, type AthleteFormPayload } from "@/app/actions";
import type { AthleteProfile, GymAccess, UnitSystem } from "@/lib/plan";
import { Group, SegmentedControl } from "./atoms";
import { ProfileDetailHeader } from "./DetailHeader";
import { Chip, FormSectionLabel } from "@/app/_components/journal/atoms";
import { TabBar } from "@/app/_components/today/TabBar";
import { ArrowRight } from "@/app/_components/today/icons";

const EXPERIENCE_OPTS = [
  "First ultra",
  "Multiple ultras",
  "Marathon experience",
  "Triathlon",
  "Other endurance",
];
const ULTRA_COUNT_OPTS = ["0", "1-3", "4-10", "10+"];
const SEX_OPTS = ["Male", "Female", "Other", "Prefer not to say"];
const SLEEP_OPTS = ["5", "6", "7", "8", "9+"];
const TRAIN_DAYS = ["M", "Tu", "W", "Th", "F", "Sa", "Su"];
// Long-run + quality day sets are the full week now so the user can
// mark any day they're flexible about. Multi-select.
const LONG_DAY_OPTS = TRAIN_DAYS;
const QUALITY_DAY_OPTS = TRAIN_DAYS;
const STRENGTH_FREQ_OPTS = ["None", "1×", "2×", "3×"];
const TIME_OF_DAY_OPTS = ["Morning", "Lunch", "Evening", "No preference"];
const JOB_OPTS = ["Sedentary office", "Standing", "Physical", "Shift work"];
const GYM_OPTS: GymAccess[] = ["full", "limited", "none"];
const GYM_LABELS: Record<GymAccess, string> = {
  full: "Full",
  limited: "Limited",
  none: "None",
};
const EQUIP_OPTS = [
  "Treadmill",
  "Indoor bike trainer",
  "Weights",
  "Pool",
  "None",
];
const TERRAIN_ACCESS_OPTS = [
  "Trails nearby",
  "Hills nearby",
  "Mountains nearby",
  "Flat only",
];
const CROSS_OPTS = ["Cycling", "Swimming", "Hiking", "Rowing", "None"];

const FITNESS_LABELS = [
  "Just starting out",
  "Building base fitness",
  "Consistent training",
  "Trained · racing regularly",
  "Highly trained · competitive",
];

interface Props {
  profile: AthleteProfile | null;
}

export function AthleteForm({ profile }: Props) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(
    profile?.unit_system ?? "metric",
  );
  // Fitness
  const [fitnessRating, setFitnessRating] = useState(
    profile?.fitness_rating ?? 3,
  );
  const [weeklyVolumeKm, setWeeklyVolumeKm] = useState(
    profile?.weekly_volume_km != null
      ? String(profile.weekly_volume_km)
      : profile?.weekly_volume ?? "",
  );
  // Two distinct fields: how much the athlete *currently* trains vs how
  // much they're *available* to train. Previously a single weeklyHours.
  const [weeklyHoursCurrent, setWeeklyHoursCurrent] = useState(
    profile?.weekly_hours_current != null
      ? String(profile.weekly_hours_current)
      : "",
  );
  const [weeklyHoursAvailable, setWeeklyHoursAvailable] = useState(
    profile?.weekly_hours != null ? String(profile.weekly_hours) : "",
  );
  const [longestRunDistance, setLongestRunDistance] = useState(
    profile?.longest_run_distance != null
      ? String(profile.longest_run_distance)
      : "",
  );
  const [longestRunDate, setLongestRunDate] = useState(
    profile?.longest_run_date ?? "",
  );
  // Experience
  const [yearsRunning, setYearsRunning] = useState(
    profile?.years_running != null ? String(profile.years_running) : "",
  );
  const [yearsUltras, setYearsUltras] = useState(
    profile?.years_ultras != null ? String(profile.years_ultras) : "",
  );
  const [ultrasCompleted, setUltrasCompleted] = useState(
    profile?.ultras_completed ?? "",
  );
  const [longestRaceDistance, setLongestRaceDistance] = useState(
    profile?.longest_race_distance != null
      ? String(profile.longest_race_distance)
      : "",
  );
  const [longestRaceName, setLongestRaceName] = useState(
    profile?.longest_race_name ?? "",
  );
  const [longestRaceDate, setLongestRaceDate] = useState(
    profile?.longest_race_date ?? "",
  );
  const [previousEndurance, setPreviousEndurance] = useState<string[]>(
    profile?.previous_endurance ?? [],
  );
  // Body
  const [age, setAge] = useState(profile?.age != null ? String(profile.age) : "");
  const [bodyWeight, setBodyWeight] = useState(
    profile?.body_weight != null ? String(profile.body_weight) : "",
  );
  const [sex, setSex] = useState(profile?.sex ?? "");
  // Health
  const [injuryNotes, setInjuryNotes] = useState(profile?.injury_notes ?? "");
  const [chronicConditions, setChronicConditions] = useState(
    profile?.chronic_conditions ?? "",
  );
  const [sleepHours, setSleepHours] = useState(
    profile?.sleep_hours != null ? String(profile.sleep_hours) : "",
  );
  const [stressBaseline, setStressBaseline] = useState(
    profile?.stress_baseline ?? 3,
  );
  // Schedule
  const [trainingDays, setTrainingDays] = useState<string[]>(
    profile?.training_days ?? [],
  );
  // Multi-select arrays. Seed from the array column when present, else
  // fall back to the legacy single-value column wrapped in a 1-element
  // array so older profiles still surface a selection.
  const [longRunDays, setLongRunDays] = useState<string[]>(
    profile?.long_run_days && profile.long_run_days.length > 0
      ? profile.long_run_days
      : profile?.long_run_day
        ? [profile.long_run_day]
        : [],
  );
  const [qualityDays, setQualityDays] = useState<string[]>(
    profile?.quality_days && profile.quality_days.length > 0
      ? profile.quality_days
      : profile?.quality_day
        ? [profile.quality_day]
        : [],
  );
  const [strengthFreq, setStrengthFreq] = useState(
    profile?.strength_freq ?? "",
  );
  const [timeOfDay, setTimeOfDay] = useState(profile?.time_of_day ?? "");
  const [jobType, setJobType] = useState(profile?.job_type ?? "");
  // Equipment
  const [gymAccess, setGymAccess] = useState<GymAccess | null>(
    profile?.gym_access ?? null,
  );
  const [equipment, setEquipment] = useState<string[]>(
    profile?.equipment ? profile.equipment.split(",").map((s) => s.trim()) : [],
  );
  const [outdoorTerrain, setOutdoorTerrain] = useState<string[]>(
    profile?.outdoor_terrain ?? [],
  );
  // Cross-training
  const [crossTrainingEnjoys, setCrossTrainingEnjoys] = useState<string[]>(
    profile?.cross_training_enjoys ?? [],
  );
  // Additional
  const [additionalExpanded, setAdditionalExpanded] = useState(false);
  const [maxHr, setMaxHr] = useState(profile?.max_hr != null ? String(profile.max_hr) : "");
  const [restingHr, setRestingHr] = useState(
    profile?.resting_hr != null ? String(profile.resting_hr) : "",
  );
  const [lactateThresholdHr, setLactateThresholdHr] = useState(
    profile?.lactate_threshold_hr != null
      ? String(profile.lactate_threshold_hr)
      : "",
  );
  const [vo2Max, setVo2Max] = useState(
    profile?.vo2_max != null ? String(profile.vo2_max) : "",
  );
  const [trainingPreferences, setTrainingPreferences] = useState(
    profile?.training_preferences ?? "",
  );

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(value: string, list: string[], setter: (n: string[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  const submit = useCallback(() => {
    setError(null);
    const payload: AthleteFormPayload = {
      unitSystem,
      fitnessRating,
      weeklyVolumeKm: weeklyVolumeKm ? Number(weeklyVolumeKm) : null,
      weeklyHoursCurrent: weeklyHoursCurrent
        ? Number(weeklyHoursCurrent)
        : null,
      weeklyHoursAvailable: weeklyHoursAvailable
        ? Number(weeklyHoursAvailable)
        : null,
      longestRunDistance: longestRunDistance ? Number(longestRunDistance) : null,
      longestRunDate: longestRunDate || null,
      yearsRunning: yearsRunning ? Number(yearsRunning) : null,
      yearsUltras: yearsUltras ? Number(yearsUltras) : null,
      ultrasCompleted,
      longestRaceDistance: longestRaceDistance ? Number(longestRaceDistance) : null,
      longestRaceName,
      longestRaceDate,
      previousEndurance,
      age: age ? Number(age) : null,
      bodyWeight: bodyWeight ? Number(bodyWeight) : null,
      sex,
      injuryNotes,
      chronicConditions,
      sleepHours: sleepHours ? Number(sleepHours.replace("+", "")) : null,
      stressBaseline,
      trainingDays,
      longRunDays,
      qualityDays,
      strengthFreq,
      timeOfDay,
      jobType,
      gymAccess,
      equipment: equipment.join(", "),
      outdoorTerrain,
      crossTrainingEnjoys,
      maxHr: maxHr ? Number(maxHr) : null,
      restingHr: restingHr ? Number(restingHr) : null,
      lactateThresholdHr: lactateThresholdHr ? Number(lactateThresholdHr) : null,
      vo2Max: vo2Max ? Number(vo2Max) : null,
      trainingPreferences,
      // Legacy fields preserved verbatim
      experience: profile?.experience ?? "",
      easyPace: profile?.easy_pace ?? "",
      weeklyVolume: weeklyVolumeKm,
      crossTraining: profile?.cross_training ?? crossTrainingEnjoys.join(", "),
      otherCommitments: profile?.other_commitments ?? "",
      sleepStress: profile?.sleep_stress ?? "",
    };
    startTransition(async () => {
      try {
        await saveAthleteProfile(payload);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }, [
    unitSystem,
    fitnessRating,
    weeklyVolumeKm,
    weeklyHoursCurrent,
    weeklyHoursAvailable,
    longestRunDistance,
    longestRunDate,
    yearsRunning,
    yearsUltras,
    ultrasCompleted,
    longestRaceDistance,
    longestRaceName,
    longestRaceDate,
    previousEndurance,
    age,
    bodyWeight,
    sex,
    injuryNotes,
    chronicConditions,
    sleepHours,
    stressBaseline,
    trainingDays,
    longRunDays,
    qualityDays,
    strengthFreq,
    timeOfDay,
    jobType,
    gymAccess,
    equipment,
    outdoorTerrain,
    crossTrainingEnjoys,
    maxHr,
    restingHr,
    lactateThresholdHr,
    vo2Max,
    trainingPreferences,
    profile?.experience,
    profile?.easy_pace,
    profile?.cross_training,
    profile?.other_commitments,
    profile?.sleep_stress,
  ]);

  const distanceUnit = unitSystem === "metric" ? "km" : "mi";
  const weightUnit = unitSystem === "metric" ? "kg" : "lb";

  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <ProfileDetailHeader />
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 pt-5 sm:px-5">
          <div>
            <div
              className="font-mono text-[11px] uppercase text-zinc-500"
              style={{ letterSpacing: "0.2em" }}
            >
              — ATHLETE PROFILE
            </div>
            <h1
              className="m-0 mt-1.5 text-[26px] font-medium leading-tight text-zinc-950 dark:text-zinc-50"
              style={{ letterSpacing: "-0.02em" }}
            >
              Your training context
            </h1>
          </div>

          <Group label="UNITS">
            <div className="px-4 py-3.5">
              <SegmentedControl
                options={["metric", "imperial"] as const}
                value={unitSystem}
                onChange={(v) => setUnitSystem(v)}
              />
            </div>
          </Group>

          <Group label="FITNESS BASELINE">
            <div className="flex flex-col gap-4 px-4 py-3.5">
              <FieldBlock label="SELF-RATED FITNESS · 1 STARTING — 5 COMPETITIVE">
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={fitnessRating}
                  onChange={(e) => setFitnessRating(Number(e.target.value))}
                  disabled={isPending}
                  className="w-full"
                  style={{ accentColor: "#10b981" }}
                />
                <span className="font-mono text-[12px] text-emerald-700 dark:text-emerald-400">
                  {fitnessRating} · {FITNESS_LABELS[fitnessRating - 1]}
                </span>
              </FieldBlock>
              <div className="grid grid-cols-2 gap-2.5">
                <FieldBlock label="WEEKLY VOLUME">
                  <SuffixInput
                    value={weeklyVolumeKm}
                    onChange={setWeeklyVolumeKm}
                    suffix={distanceUnit}
                    numeric
                    disabled={isPending}
                  />
                </FieldBlock>
                <FieldBlock label="CURRENT WEEKLY TIME">
                  <SuffixInput
                    value={weeklyHoursCurrent}
                    onChange={setWeeklyHoursCurrent}
                    suffix="hrs"
                    numeric
                    disabled={isPending}
                  />
                </FieldBlock>
              </div>
              <FieldBlock label="WEEKLY HOURS AVAILABLE">
                <SuffixInput
                  value={weeklyHoursAvailable}
                  onChange={setWeeklyHoursAvailable}
                  suffix="hrs"
                  numeric
                  disabled={isPending}
                />
              </FieldBlock>
              <div className="grid grid-cols-2 gap-2.5">
                <FieldBlock label="LONGEST RUN · LAST MONTH">
                  <SuffixInput
                    value={longestRunDistance}
                    onChange={setLongestRunDistance}
                    suffix={distanceUnit}
                    numeric
                    disabled={isPending}
                  />
                </FieldBlock>
                <FieldBlock label="WHEN">
                  <DateInput
                    value={longestRunDate}
                    onChange={setLongestRunDate}
                    disabled={isPending}
                  />
                </FieldBlock>
              </div>
            </div>
          </Group>

          <Group label="EXPERIENCE">
            <div className="flex flex-col gap-3 px-4 py-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <FieldBlock label="YEARS RUNNING">
                  <SuffixInput
                    value={yearsRunning}
                    onChange={setYearsRunning}
                    suffix="yrs"
                    numeric
                    disabled={isPending}
                  />
                </FieldBlock>
                <FieldBlock label="YEARS ULTRAS">
                  <SuffixInput
                    value={yearsUltras}
                    onChange={setYearsUltras}
                    suffix="yrs"
                    numeric
                    disabled={isPending}
                  />
                </FieldBlock>
              </div>
              <FieldBlock label="ULTRAS COMPLETED">
                <div className="flex flex-wrap gap-1.5">
                  {ULTRA_COUNT_OPTS.map((o) => (
                    <Chip
                      key={o}
                      active={ultrasCompleted === o}
                      onClick={() => setUltrasCompleted(o)}
                      disabled={isPending}
                    >
                      {o}
                    </Chip>
                  ))}
                </div>
              </FieldBlock>
              <FieldBlock label="LONGEST RACE COMPLETED">
                <SuffixInput
                  value={longestRaceDistance}
                  onChange={setLongestRaceDistance}
                  suffix={distanceUnit}
                  numeric
                  disabled={isPending}
                />
              </FieldBlock>
              <div className="grid grid-cols-2 gap-2.5">
                <FieldBlock label="RACE NAME · OPTIONAL">
                  <TextInput
                    value={longestRaceName}
                    onChange={setLongestRaceName}
                    placeholder="For reference"
                    disabled={isPending}
                  />
                </FieldBlock>
                <FieldBlock label="DATE · OPTIONAL">
                  <DateInput
                    value={longestRaceDate}
                    onChange={setLongestRaceDate}
                    disabled={isPending}
                  />
                </FieldBlock>
              </div>
              <FieldBlock label="PREVIOUS ENDURANCE · multi-select">
                <div className="flex flex-wrap gap-1.5">
                  {EXPERIENCE_OPTS.map((o) => (
                    <Chip
                      key={o}
                      multi
                      active={previousEndurance.includes(o)}
                      onClick={() =>
                        toggle(o, previousEndurance, setPreviousEndurance)
                      }
                      disabled={isPending}
                    >
                      {o}
                    </Chip>
                  ))}
                </div>
              </FieldBlock>
            </div>
          </Group>

          <Group label="BODY">
            <div className="flex flex-col gap-3 px-4 py-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <FieldBlock label="AGE">
                  <SuffixInput value={age} onChange={setAge} suffix="yrs" numeric disabled={isPending} />
                </FieldBlock>
                <FieldBlock label="BODY WEIGHT">
                  <SuffixInput
                    value={bodyWeight}
                    onChange={setBodyWeight}
                    suffix={weightUnit}
                    numeric
                    disabled={isPending}
                  />
                </FieldBlock>
              </div>
              <span className="font-mono text-[10.5px] text-zinc-400 dark:text-zinc-600">
                Weight is optional. Used for fueling recommendations.
              </span>
              <FieldBlock label="BIOLOGICAL SEX · OPTIONAL">
                <SegmentedControl
                  options={SEX_OPTS}
                  value={sex || null}
                  onChange={(v) => setSex(v)}
                  size="sm"
                  disabled={isPending}
                />
              </FieldBlock>
            </div>
          </Group>

          <Group label="HEALTH">
            <div className="flex flex-col gap-3 px-4 py-3.5">
              <FieldBlock label="PAST INJURIES">
                <textarea
                  value={injuryNotes}
                  onChange={(e) => setInjuryNotes(e.target.value)}
                  disabled={isPending}
                  placeholder="Recovered injuries Claude should know about."
                  rows={3}
                  className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50"
                />
              </FieldBlock>
              <span className="font-mono text-[10.5px] text-zinc-400 dark:text-zinc-600">
                Current injuries live in the{" "}
                <Link
                  href="/journal"
                  className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  Journal
                </Link>
                .
              </span>
              <FieldBlock label="CHRONIC CONDITIONS · OPTIONAL">
                <textarea
                  value={chronicConditions}
                  onChange={(e) => setChronicConditions(e.target.value)}
                  disabled={isPending}
                  placeholder="asthma, diabetes, heart conditions, etc."
                  rows={2}
                  className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50"
                />
              </FieldBlock>
              <FieldBlock label="AVERAGE SLEEP · HOURS">
                <div className="flex flex-wrap gap-1.5">
                  {SLEEP_OPTS.map((o) => (
                    <Chip
                      key={o}
                      active={sleepHours === o.replace("+", "")}
                      onClick={() => setSleepHours(o.replace("+", ""))}
                      disabled={isPending}
                    >
                      {o}
                    </Chip>
                  ))}
                </div>
              </FieldBlock>
              <FieldBlock label="STRESS BASELINE · 1 LOW — 5 HIGH">
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={stressBaseline}
                  onChange={(e) => setStressBaseline(Number(e.target.value))}
                  disabled={isPending}
                  className="w-full"
                  style={{ accentColor: "#10b981" }}
                />
                <span className="font-mono text-[12px] text-emerald-700 dark:text-emerald-400">
                  {stressBaseline} / 5
                </span>
              </FieldBlock>
            </div>
          </Group>

          <Group label="SCHEDULE">
            <div className="flex flex-col gap-3 px-4 py-3.5">
              <FieldBlock label="TYPICAL TRAINING DAYS · multi-select">
                <div className="flex flex-wrap gap-1.5">
                  {TRAIN_DAYS.map((d) => (
                    <Chip
                      key={d}
                      multi
                      active={trainingDays.includes(d)}
                      onClick={() => toggle(d, trainingDays, setTrainingDays)}
                      disabled={isPending}
                    >
                      {d}
                    </Chip>
                  ))}
                </div>
              </FieldBlock>
              <FieldBlock label="LONG RUN DAYS · multi-select">
                <div className="flex flex-wrap gap-1.5">
                  {LONG_DAY_OPTS.map((d) => (
                    <Chip
                      key={d}
                      multi
                      active={longRunDays.includes(d)}
                      onClick={() => toggle(d, longRunDays, setLongRunDays)}
                      disabled={isPending}
                    >
                      {d}
                    </Chip>
                  ))}
                </div>
              </FieldBlock>
              <FieldBlock label="QUALITY DAYS · multi-select">
                <div className="flex flex-wrap gap-1.5">
                  {QUALITY_DAY_OPTS.map((d) => (
                    <Chip
                      key={d}
                      multi
                      active={qualityDays.includes(d)}
                      onClick={() => toggle(d, qualityDays, setQualityDays)}
                      disabled={isPending}
                    >
                      {d}
                    </Chip>
                  ))}
                </div>
              </FieldBlock>
              <FieldBlock label="STRENGTH PER WEEK">
                <SegmentedControl
                  options={STRENGTH_FREQ_OPTS}
                  value={strengthFreq || null}
                  onChange={(v) => setStrengthFreq(v)}
                  size="sm"
                  disabled={isPending}
                />
              </FieldBlock>
              <FieldBlock label="TIME OF DAY">
                <SegmentedControl
                  options={TIME_OF_DAY_OPTS}
                  value={timeOfDay || null}
                  onChange={(v) => setTimeOfDay(v)}
                  size="sm"
                  disabled={isPending}
                />
              </FieldBlock>
              <FieldBlock label="JOB TYPE">
                <div className="flex flex-wrap gap-1.5">
                  {JOB_OPTS.map((o) => (
                    <Chip
                      key={o}
                      active={jobType === o}
                      onClick={() => setJobType(o)}
                      disabled={isPending}
                    >
                      {o}
                    </Chip>
                  ))}
                </div>
              </FieldBlock>
            </div>
          </Group>

          <Group label="EQUIPMENT & ACCESS">
            <div className="flex flex-col gap-3 px-4 py-3.5">
              <FieldBlock label="GYM ACCESS">
                <div className="flex flex-wrap gap-1.5">
                  {GYM_OPTS.map((g) => (
                    <Chip
                      key={g}
                      active={gymAccess === g}
                      onClick={() => setGymAccess(g)}
                      disabled={isPending}
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
                      active={equipment.includes(o)}
                      onClick={() => toggle(o, equipment, setEquipment)}
                      disabled={isPending}
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
                      active={outdoorTerrain.includes(o)}
                      onClick={() =>
                        toggle(o, outdoorTerrain, setOutdoorTerrain)
                      }
                      disabled={isPending}
                    >
                      {o}
                    </Chip>
                  ))}
                </div>
              </FieldBlock>
            </div>
          </Group>

          <Group label="CROSS-TRAINING">
            <div className="px-4 py-3.5">
              <FieldBlock label="ENJOYS · multi-select">
                <div className="flex flex-wrap gap-1.5">
                  {CROSS_OPTS.map((o) => (
                    <Chip
                      key={o}
                      multi
                      active={crossTrainingEnjoys.includes(o)}
                      onClick={() =>
                        toggle(o, crossTrainingEnjoys, setCrossTrainingEnjoys)
                      }
                      disabled={isPending}
                    >
                      {o}
                    </Chip>
                  ))}
                </div>
              </FieldBlock>
            </div>
          </Group>

          <Group label="ADDITIONAL DETAILS">
            <button
              type="button"
              onClick={() => setAdditionalExpanded((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left"
            >
              <span className="text-[14.5px] font-medium text-zinc-950 dark:text-zinc-50">
                {additionalExpanded ? "Hide" : "Show"} HR & VO2 markers
              </span>
              <span
                className="font-mono text-[10.5px] uppercase text-zinc-500"
                style={{ letterSpacing: "0.16em" }}
              >
                {additionalExpanded ? "↓ HIDE" : "→ NICE-TO-HAVES"}
              </span>
            </button>
            {additionalExpanded && (
              <div className="flex flex-col gap-3 border-t border-zinc-200 px-4 py-3.5 dark:border-zinc-800">
                <span className="font-mono text-[10.5px] text-zinc-400 dark:text-zinc-600">
                  Leave blank if you don&apos;t know — these calibrate pacing
                  zones when available.
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <FieldBlock label="MAX HR">
                    <SuffixInput value={maxHr} onChange={setMaxHr} suffix="bpm" numeric disabled={isPending} />
                  </FieldBlock>
                  <FieldBlock label="RESTING HR">
                    <SuffixInput
                      value={restingHr}
                      onChange={setRestingHr}
                      suffix="bpm"
                      numeric
                      disabled={isPending}
                    />
                  </FieldBlock>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <FieldBlock label="LACTATE THRESHOLD HR">
                    <SuffixInput
                      value={lactateThresholdHr}
                      onChange={setLactateThresholdHr}
                      suffix="bpm"
                      numeric
                      disabled={isPending}
                    />
                  </FieldBlock>
                  <FieldBlock label="VO2 MAX">
                    <SuffixInput
                      value={vo2Max}
                      onChange={setVo2Max}
                      suffix="ml/kg/min"
                      numeric
                      disabled={isPending}
                    />
                  </FieldBlock>
                </div>
              </div>
            )}
          </Group>

          <Group label="TRAINING PREFERENCES">
            <div className="flex flex-col gap-2 px-4 py-3.5">
              <FieldBlock label="HOW YOU LIKE TO TRAIN">
                <textarea
                  value={trainingPreferences}
                  onChange={(e) => setTrainingPreferences(e.target.value)}
                  disabled={isPending}
                  placeholder="e.g. Long runs on Saturday morning. Prefer split squats. Avoid treadmill."
                  rows={4}
                  className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50"
                />
              </FieldBlock>
            </div>
          </Group>

          {error && (
            <div className="rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2 text-[12.5px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-zinc-200 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),18px)] sm:px-5 sm:pb-5 dark:border-zinc-800">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save changes"}
          {!isPending && <ArrowRight color="#052e1f" size={16} />}
        </button>
        <div className="flex justify-end">
          <Link
            href="/profile"
            className="text-[13px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            Cancel
          </Link>
        </div>
      </div>

      <TabBar active="profile" />
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
    <div className="flex flex-col gap-1.5">
      <FormSectionLabel required={required}>{label}</FormSectionLabel>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50"
    />
  );
}

function DateInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="rounded-[10px] border border-zinc-200 bg-white px-3 py-3 text-[14px] text-zinc-950 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50"
    />
  );
}

function SuffixInput({
  value,
  onChange,
  suffix,
  numeric,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  numeric?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 rounded-[10px] border border-zinc-200 bg-white px-3 py-3 focus-within:border-emerald-500 focus-within:ring-[3px] focus-within:ring-emerald-50 dark:border-zinc-800 dark:bg-[#0f0f11]">
      <input
        type={numeric ? "number" : "text"}
        inputMode={numeric ? "numeric" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1 bg-transparent text-[14px] text-zinc-950 focus:outline-none disabled:opacity-60 dark:text-zinc-50"
      />
      <span className="font-mono text-[11px] text-zinc-500">{suffix}</span>
    </div>
  );
}
