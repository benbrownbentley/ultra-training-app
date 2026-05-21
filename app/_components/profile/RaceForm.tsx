"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { deleteRace, saveRace, type RaceFormPayload } from "@/app/actions";
import type { Intent, Race, RacePriority, Terrain } from "@/lib/plan";
import { isNextRedirectError } from "@/lib/utils";
import { Group, SegmentedControl } from "./atoms";
import { ProfileDetailHeader } from "./DetailHeader";
import { Chip, FormSectionLabel } from "@/app/_components/journal/atoms";
import { TabBar } from "@/app/_components/today/TabBar";
import { ArrowRight } from "@/app/_components/today/icons";
import { createPortal } from "react-dom";

const PRIORITY_HELP: Record<Exclude<RacePriority, "completed">, string> = {
  A: "Primary target. Plan builds toward this.",
  B: "Tune-up. Raced hard, not peaked for.",
  C: "Training-grade. Used as a workout, no taper.",
};

const TERRAIN_OPTS: Terrain[] = ["road", "mixed", "trail", "technical"];
const CLIMATE_OPTS = ["Hot", "Cold", "Altitude", "Temperate", "Varies"];
const PROFILE_OPTS = [
  "Point-to-point",
  "Loop",
  "Out-and-back",
  "Multi-stage",
];
const SUPPORT_OPTS = ["Aid stations", "Self-supported", "Semi-supported"];
const INTENT_OPTS_AB: Intent[] = ["competitive", "moderate", "relaxed"];
const INTENT_LABELS: Record<Intent, string> = {
  competitive: "Competitive",
  moderate: "Finish strong",
  relaxed: "Just finish",
};

interface Props {
  race: Race | null;
}

export function RaceForm({ race }: Props) {
  const isEdit = !!race?.id;
  const [priority, setPriority] = useState<RacePriority>(
    (race?.priority as RacePriority) ?? "A",
  );
  const [name, setName] = useState(race?.name ?? "");
  const [date, setDate] = useState(race?.date ?? "");
  const [distance, setDistance] = useState(race?.distance ?? "");
  const [elevationGain, setElevationGain] = useState(
    race?.elevation_gain != null ? String(race.elevation_gain) : "",
  );
  const [terrain, setTerrain] = useState<Terrain | null>(race?.terrain ?? null);
  const [targetTime, setTargetTime] = useState(race?.target_time ?? "");
  const [intent, setIntent] = useState<Intent | null>(race?.intent ?? "moderate");
  const [additionalExpanded, setAdditionalExpanded] = useState(false);
  const [elevationLoss, setElevationLoss] = useState(
    race?.elevation_loss != null ? String(race.elevation_loss) : "",
  );
  const [cutoffTime, setCutoffTime] = useState(race?.cutoff_time ?? "");
  const [climate, setClimate] = useState(race?.climate ?? "");
  const [courseProfile, setCourseProfile] = useState(race?.course_profile ?? "");
  const [support, setSupport] = useState(race?.support ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = useCallback(() => {
    if (!name.trim()) {
      setError("Race name is required.");
      return;
    }
    if (!date) {
      setError("Race date is required.");
      return;
    }
    if (!distance.trim()) {
      setError("Distance is required.");
      return;
    }
    setError(null);
    const payload: RaceFormPayload = {
      id: race?.id,
      priority,
      name,
      date,
      distance,
      elevationGain: elevationGain ? Number(elevationGain) : null,
      terrain,
      targetTime,
      intent: priority === "C" ? "relaxed" : intent,
      elevationLoss: elevationLoss ? Number(elevationLoss) : null,
      cutoffTime,
      climate,
      courseProfile,
      support,
    };
    startTransition(async () => {
      try {
        await saveRace(payload);
      } catch (e) {
        // The server action calls redirect() on success — Next.js
        // signals navigation by throwing NEXT_REDIRECT. Re-throw so
        // the framework can catch it and actually navigate; only treat
        // other errors as save failures.
        if (isNextRedirectError(e)) throw e;
        setError(e instanceof Error ? e.message : "Failed to save race");
      }
    });
  }, [
    race?.id,
    priority,
    name,
    date,
    distance,
    elevationGain,
    terrain,
    targetTime,
    intent,
    elevationLoss,
    cutoffTime,
    climate,
    courseProfile,
    support,
  ]);

  const priorityHelp =
    priority === "completed" ? null : PRIORITY_HELP[priority];

  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <ProfileDetailHeader
        backHref="/profile/race"
        backLabel="RACE CALENDAR"
      />
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 pt-5 sm:px-5">
          <div>
            <div
              className="font-mono text-[11px] uppercase text-zinc-500"
              style={{ letterSpacing: "0.2em" }}
            >
              — {isEdit ? "EDIT RACE" : "ADD RACE"}
            </div>
            <h1
              className="m-0 mt-1.5 text-[26px] font-medium leading-tight text-zinc-950 dark:text-zinc-50"
              style={{ letterSpacing: "-0.02em" }}
            >
              {isEdit ? race?.name || "Race" : "New race"}
            </h1>
          </div>

          <Group label="PRIORITY">
            <div className="flex flex-col gap-2.5 px-4 py-3.5">
              <SegmentedControl
                options={["A", "B", "C"] as const}
                value={priority === "completed" ? null : priority}
                onChange={(v) => setPriority(v)}
                disabled={isPending}
              />
              {priorityHelp && (
                <span className="font-mono text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
                  <span className="mr-1.5 font-semibold text-emerald-500">
                    {priority} —
                  </span>
                  {priorityHelp}
                </span>
              )}
            </div>
          </Group>

          <Group label="RACE DETAILS">
            <div className="flex flex-col gap-3 px-4 py-3.5">
              <FieldBlock label="RACE NAME" required>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                  placeholder="e.g. Ultra-Trail du Mont-Blanc"
                  className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
                />
              </FieldBlock>
              <div className="grid grid-cols-2 gap-2.5">
                <FieldBlock label="RACE DATE" required>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={isPending}
                    className="rounded-[10px] border border-zinc-200 bg-white px-3 py-3 text-[14px] text-zinc-950 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
                  />
                </FieldBlock>
                <FieldBlock label="DISTANCE" required>
                  <SuffixInput
                    value={distance}
                    onChange={setDistance}
                    suffix="km"
                    placeholder="171.5"
                    disabled={isPending}
                  />
                </FieldBlock>
              </div>
              <FieldBlock label="ELEVATION GAIN">
                <SuffixInput
                  value={elevationGain}
                  onChange={setElevationGain}
                  suffix="m"
                  placeholder="—"
                  disabled={isPending}
                  numeric
                />
              </FieldBlock>
              <FieldBlock label="TERRAIN">
                <div className="flex flex-wrap gap-1.5">
                  {TERRAIN_OPTS.map((t) => (
                    <Chip
                      key={t}
                      active={terrain === t}
                      onClick={() => setTerrain(terrain === t ? null : t)}
                      disabled={isPending}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Chip>
                  ))}
                </div>
              </FieldBlock>
            </div>
          </Group>

          <Group label="RACE GOAL">
            <div className="flex flex-col gap-3 px-4 py-3.5">
              <FieldBlock label="TARGET FINISH TIME · OPTIONAL">
                <input
                  type="text"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  disabled={isPending}
                  placeholder="hh:mm"
                  className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
                />
              </FieldBlock>
              <FieldBlock label="EFFORT INTENT">
                {priority === "C" ? (
                  <SegmentedControl
                    options={["Training-grade"] as const}
                    value={"Training-grade"}
                    disabled
                  />
                ) : (
                  <SegmentedControl
                    options={INTENT_OPTS_AB.map((i) => INTENT_LABELS[i])}
                    value={intent ? INTENT_LABELS[intent] : null}
                    onChange={(label) => {
                      const next = INTENT_OPTS_AB.find(
                        (i) => INTENT_LABELS[i] === label,
                      );
                      if (next) setIntent(next);
                    }}
                    disabled={isPending}
                  />
                )}
                {priority === "C" && (
                  <span className="mt-1.5 block font-mono text-[10.5px] text-zinc-400 dark:text-zinc-600">
                    C races are used as workouts — effort is locked.
                  </span>
                )}
              </FieldBlock>
            </div>
          </Group>

          <Group label="ADDITIONAL DETAILS">
            <button
              type="button"
              onClick={() => setAdditionalExpanded((v) => !v)}
              disabled={isPending}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left"
            >
              <span className="text-[14.5px] font-medium text-zinc-950 dark:text-zinc-50">
                {additionalExpanded ? "Hide" : "Show"} additional details
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
                <div className="grid grid-cols-2 gap-2.5">
                  <FieldBlock label="ELEVATION LOSS">
                    <SuffixInput
                      value={elevationLoss}
                      onChange={setElevationLoss}
                      suffix="m"
                      placeholder="—"
                      disabled={isPending}
                      numeric
                    />
                  </FieldBlock>
                  <FieldBlock label="CUTOFF TIME">
                    <input
                      type="text"
                      value={cutoffTime}
                      onChange={(e) => setCutoffTime(e.target.value)}
                      disabled={isPending}
                      placeholder="hh:mm"
                      className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
                    />
                  </FieldBlock>
                </div>
                <FieldBlock label="CLIMATE / TEMPERATURE">
                  <div className="flex flex-wrap gap-1.5">
                    {CLIMATE_OPTS.map((c) => (
                      <Chip
                        key={c}
                        active={climate === c}
                        onClick={() => setClimate(climate === c ? "" : c)}
                        disabled={isPending}
                      >
                        {c}
                      </Chip>
                    ))}
                  </div>
                </FieldBlock>
                <FieldBlock label="COURSE PROFILE">
                  <div className="flex flex-wrap gap-1.5">
                    {PROFILE_OPTS.map((p) => (
                      <Chip
                        key={p}
                        active={courseProfile === p}
                        onClick={() =>
                          setCourseProfile(courseProfile === p ? "" : p)
                        }
                        disabled={isPending}
                      >
                        {p}
                      </Chip>
                    ))}
                  </div>
                </FieldBlock>
                <FieldBlock label="AID STATION SUPPORT">
                  <div className="flex flex-wrap gap-1.5">
                    {SUPPORT_OPTS.map((s) => (
                      <Chip
                        key={s}
                        active={support === s}
                        onClick={() => setSupport(support === s ? "" : s)}
                        disabled={isPending}
                      >
                        {s}
                      </Chip>
                    ))}
                  </div>
                </FieldBlock>
              </div>
            )}
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
          {isPending ? "Saving…" : "Save race"}
          {!isPending && <ArrowRight color="#052e1f" size={16} />}
        </button>
        <div className="flex items-center justify-between">
          {isEdit ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={isPending}
              className="bg-transparent text-[13px] font-medium text-red-600 disabled:opacity-50 dark:text-red-500"
            >
              Delete race
            </button>
          ) : (
            <span />
          )}
          <Link
            href="/profile/race"
            className="text-[13px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            Cancel
          </Link>
        </div>
      </div>

      <TabBar active="profile" />

      {confirmDelete && race?.id && (
        <DeleteRaceConfirm
          raceId={race.id}
          raceName={race.name}
          onClose={() => setConfirmDelete(false)}
        />
      )}
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

function SuffixInput({
  value,
  onChange,
  suffix,
  placeholder,
  disabled,
  numeric,
}: {
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  placeholder?: string;
  disabled?: boolean;
  numeric?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 rounded-[10px] border border-zinc-200 bg-white px-3 py-3 focus-within:border-emerald-500 focus-within:ring-[3px] focus-within:ring-emerald-50 dark:border-zinc-800 dark:bg-[#0f0f11] dark:focus-within:ring-emerald-500/10">
      <input
        type={numeric ? "number" : "text"}
        inputMode={numeric ? "numeric" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:outline-none disabled:opacity-60 dark:text-zinc-50"
      />
      <span className="font-mono text-[11px] text-zinc-500">{suffix}</span>
    </div>
  );
}

function DeleteRaceConfirm({
  raceId,
  raceName,
  onClose,
}: {
  raceId: number;
  raceName: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 font-sans">
      <button
        type="button"
        onClick={isPending ? undefined : onClose}
        aria-label="Close"
        className="absolute inset-0 bg-zinc-950/45 dark:bg-black/60"
      />
      <div className="absolute right-0 bottom-0 left-0 rounded-t-[20px] bg-zinc-50 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),22px)] shadow-[0_-16px_48px_rgba(0,0,0,0.35)] sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2 sm:w-[460px] sm:max-w-[92%] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-zinc-200 sm:p-6 dark:bg-zinc-950 dark:sm:border-zinc-800">
        <div className="flex justify-center pb-3.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div
          className="font-mono text-[10.5px] font-semibold uppercase text-red-600 dark:text-red-500"
          style={{ letterSpacing: "0.2em" }}
        >
          — DELETE RACE
        </div>
        <h2
          className="m-0 mt-2 mb-2 text-[22px] font-medium text-zinc-950 dark:text-zinc-50"
          style={{ letterSpacing: "-0.015em" }}
        >
          Delete {raceName || "this race"}?
        </h2>
        <p className="m-0 mb-5 text-sm leading-snug text-zinc-600 dark:text-zinc-400">
          The race will be removed from your calendar. Your training plan
          won&apos;t change automatically — adjust it from the Plan tab if you
          need to.
        </p>
        {error && (
          <div className="mb-3 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2 text-[12.5px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-[14px] font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await deleteRace(raceId);
                } catch (e) {
                  if (isNextRedirectError(e)) throw e;
                  setError(e instanceof Error ? e.message : "Failed to delete");
                }
              });
            }}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-[10px] border border-red-700 bg-red-600 px-4 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(220,38,38,0.28)] transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Deleting…" : "Delete race"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
