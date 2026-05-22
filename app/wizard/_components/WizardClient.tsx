"use client";

import { useState, useTransition } from "react";
import { submitWizard } from "@/app/actions";
import type { PlanGenErrorCode } from "@/lib/plan-gen-result";
import { WelcomeStep } from "./WelcomeStep";
import { WizardChrome } from "./WizardChrome";
import {
  AboutYouStepBody,
  EquipmentStepBody,
  ExperienceStepBody,
  FitnessStepBody,
  GoalFieldGroup,
  HealthStepBody,
  InlineRaceForm,
  RaceFieldGroup,
  SavedRaceCard,
  ScheduleStepBody,
} from "./steps";
import { HelperText } from "./form-bits";
import {
  DoneState,
  GeneratingErrorState,
  GeneratingState,
} from "./GeneratingDoneStates";
import {
  EMPTY_PAYLOAD,
  type WizardPayload,
  type WizardRaceInput,
} from "./wizard-types";

type StepId =
  | "welcome"
  | "races"
  | "fitness"
  | "experience"
  | "about"
  | "health"
  | "schedule"
  | "equipment"
  | "generating"
  | "generating-error"
  | "done";

const NUMBERED_FLOW: StepId[] = [
  "races",
  "fitness",
  "experience",
  "about",
  "health",
  "schedule",
  "equipment",
];

const TOTAL_STEPS = NUMBERED_FLOW.length;

export function WizardClient() {
  const [step, setStep] = useState<StepId>("welcome");
  const [data, setData] = useState<WizardPayload>(EMPTY_PAYLOAD);
  const [error, setError] = useState<string | null>(null);
  // Captured from the typed envelope returned by submitWizard on
  // generation failure. Drives the copy + debug footer on the
  // GeneratingErrorState screen.
  const [generationError, setGenerationError] = useState<{
    code: PlanGenErrorCode;
    requestId?: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof WizardPayload>(key: K, value: WizardPayload[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function goTo(next: StepId) {
    setStep(next);
    setError(null);
  }

  function advance() {
    const idx = NUMBERED_FLOW.indexOf(step as (typeof NUMBERED_FLOW)[number]);
    if (idx === -1) return;
    if (idx === NUMBERED_FLOW.length - 1) {
      submit();
    } else {
      goTo(NUMBERED_FLOW[idx + 1]);
    }
  }

  function back() {
    const idx = NUMBERED_FLOW.indexOf(step as (typeof NUMBERED_FLOW)[number]);
    if (step === "races") {
      goTo("welcome");
      return;
    }
    if (idx > 0) goTo(NUMBERED_FLOW[idx - 1]);
  }

  function submit() {
    setError(null);
    setGenerationError(null);
    setStep("generating");
    startTransition(async () => {
      try {
        const r = await submitWizard(data);
        if (!r.ok) {
          // Generation failed in a way the server could classify —
          // surface the branded error screen so the user has a single
          // primary Try-Again CTA. Wizard inputs are preserved in
          // client state so a retry doesn't lose typed answers.
          setGenerationError({ code: r.code, requestId: r.requestId });
          setStep("generating-error");
          return;
        }
        setStep("done");
      } catch (e) {
        // Network-level failure — the server action's typed envelope
        // never landed (typical Vercel 504 HTML response). Treat as a
        // generation_timeout so the user sees the same branded UX.
        console.error("[WizardClient] submitWizard threw", e);
        setGenerationError({ code: "generation_timeout" });
        setStep("generating-error");
      }
    });
  }

  if (step === "welcome") {
    return (
      <WelcomeStep
        unitSystem={data.unitSystem}
        onUnitsChange={(v) => set("unitSystem", v)}
        onContinue={() => goTo("races")}
      />
    );
  }
  if (step === "generating") {
    return <GeneratingState />;
  }
  if (step === "generating-error") {
    return (
      <GeneratingErrorState
        code={generationError?.code ?? "unknown"}
        requestId={generationError?.requestId}
        onTryAgain={submit}
        onEditSetup={() => {
          setGenerationError(null);
          setStep("races");
        }}
      />
    );
  }
  if (step === "done") {
    return <DoneState />;
  }

  const stepNum =
    NUMBERED_FLOW.indexOf(step as (typeof NUMBERED_FLOW)[number]) + 1;
  return (
    <StepWrapper
      step={stepNum}
      stepId={step}
      data={data}
      set={set}
      onAdvance={advance}
      onBack={back}
      error={error}
      busy={isPending}
    />
  );
}

function StepWrapper({
  step,
  stepId,
  data,
  set,
  onAdvance,
  onBack,
  error,
  busy,
}: {
  step: number;
  stepId: StepId;
  data: WizardPayload;
  set: <K extends keyof WizardPayload>(k: K, v: WizardPayload[K]) => void;
  onAdvance: () => void;
  onBack: () => void;
  error: string | null;
  busy: boolean;
}) {
  const isLast = step === TOTAL_STEPS;
  const primaryLabel = isLast ? "Generate my plan" : "Continue";

  let title = "";
  let eyebrow = "";
  let helper: string | undefined = undefined;
  let body: React.ReactNode = null;
  let canAdvance = true;
  let onSkip: (() => void) | undefined = undefined;

  if (stepId === "races") {
    eyebrow = "YOUR A RACE";
    title = "What are you training for?";
    body = <RacesStepBody data={data} set={set} disabled={busy} />;
    canAdvance =
      data.aRace.name.trim().length > 0 &&
      data.aRace.date.length > 0 &&
      data.aRace.distance.trim().length > 0;
  } else if (stepId === "fitness") {
    eyebrow = "FITNESS";
    title = "Where are you starting from?";
    body = <FitnessStepBody data={data} set={set} disabled={busy} />;
  } else if (stepId === "experience") {
    eyebrow = "EXPERIENCE";
    title = "What have you done?";
    body = <ExperienceStepBody data={data} set={set} disabled={busy} />;
  } else if (stepId === "about") {
    eyebrow = "ABOUT YOU";
    title = "A few details about you.";
    helper =
      "All optional except age. Used for plan personalization and fueling recommendations.";
    body = <AboutYouStepBody data={data} set={set} disabled={busy} />;
    canAdvance = data.age != null && data.age > 0;
  } else if (stepId === "health") {
    eyebrow = "HEALTH";
    title = "Anything we should know?";
    body = <HealthStepBody data={data} set={set} disabled={busy} />;
    onSkip = onAdvance;
  } else if (stepId === "schedule") {
    eyebrow = "SCHEDULE";
    title = "When do you train?";
    body = <ScheduleStepBody data={data} set={set} disabled={busy} />;
  } else if (stepId === "equipment") {
    eyebrow = "EQUIPMENT";
    title = "What do you have access to?";
    body = <EquipmentStepBody data={data} set={set} disabled={busy} />;
  }

  return (
    <WizardChrome
      step={step}
      totalSteps={TOTAL_STEPS}
      eyebrow={eyebrow}
      title={title}
      helper={helper}
      onPrimary={onAdvance}
      onBack={onBack}
      onSkip={onSkip}
      primaryLabel={primaryLabel}
      disabled={!canAdvance}
      busy={busy}
    >
      {body}
      {error && (
        <div className="rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2 text-[12.5px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
    </WizardChrome>
  );
}

// Races step body — A race + GOAL + optional B/C list with inline add form.
function RacesStepBody({
  data,
  set,
  disabled,
}: {
  data: WizardPayload;
  set: <K extends keyof WizardPayload>(k: K, v: WizardPayload[K]) => void;
  disabled: boolean;
}) {
  const [addingRace, setAddingRace] = useState<WizardRaceInput | null>(null);

  function startAdd(priority: "B" | "C") {
    setAddingRace({
      priority,
      name: "",
      date: "",
      distance: "",
      elevationGain: null,
      terrain: null,
      targetTime: "",
      intent: priority === "B" ? "moderate" : "relaxed",
    });
  }

  function saveAdd() {
    if (!addingRace) return;
    set("otherRaces", [...data.otherRaces, addingRace]);
    setAddingRace(null);
  }

  function removeRace(idx: number) {
    set(
      "otherRaces",
      data.otherRaces.filter((_, i) => i !== idx),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <RaceFieldGroup
        race={data.aRace}
        onChange={(v) => set("aRace", v)}
        disabled={disabled}
      />
      <div className="h-px bg-zinc-200 dark:bg-zinc-800" />
      <GoalFieldGroup
        race={data.aRace}
        onChange={(v) => set("aRace", v)}
        disabled={disabled}
      />
      <div className="h-px bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex flex-col gap-2">
        <span
          className="font-mono text-[10px] uppercase text-zinc-500"
          style={{ letterSpacing: "0.2em" }}
        >
          — OTHER RACES · OPTIONAL
        </span>
        <HelperText>
          B races are tune-ups you race hard but don&apos;t peak for. C races
          are training-grade efforts. Add any if you have them, or skip — you
          can add them later in Profile.
        </HelperText>
      </div>

      <div className="flex flex-col gap-2.5">
        {data.otherRaces.map((race, idx) => (
          <SavedRaceCard
            key={idx}
            race={race}
            onEdit={() => setAddingRace(race)}
            onRemove={() => removeRace(idx)}
            disabled={disabled}
          />
        ))}
        {addingRace && (
          <InlineRaceForm
            race={addingRace}
            onChange={setAddingRace}
            onSave={saveAdd}
            onCancel={() => setAddingRace(null)}
            disabled={disabled}
          />
        )}
        {!addingRace && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => startAdd("B")}
              disabled={disabled}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-dashed border-zinc-200 px-3.5 py-3 text-[13px] font-medium text-zinc-950 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-50"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Add B race
            </button>
            <button
              type="button"
              onClick={() => startAdd("C")}
              disabled={disabled}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-dashed border-zinc-200 px-3.5 py-3 text-[13px] font-medium text-zinc-950 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-50"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Add C race
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
