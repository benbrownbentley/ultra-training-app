// Composes the right Workout Detail variant (Running, Strength, Physio,
// Cross, Mobility, Hike) into the shared page chrome. Each variant is a
// fragment of sections; the page mounts the chosen body inside the same
// shell.

import type { WorkoutContent } from "@/lib/workout-content";
import type { WorkoutStatus } from "@/lib/plan";
import { Section } from "./Section";
import {
  DisclosureRow,
  EffortSlider,
  ExerciseRow,
  FieldRow,
  FuelingCallout,
  GlossaryLink,
  NotesField,
  PhysioExerciseRow,
  RoutineRow,
  SegmentRow,
  TimeInZoneBar,
  WarmupCallout,
  WhyParagraph,
  DoneToggle,
} from "./atoms";

type Variant = "upcoming" | "logged" | "skipped" | "missed" | "future";

interface CommonProps {
  content: WorkoutContent;
  variant: Variant;
  status: WorkoutStatus;
  loggedAt: string | null;
  isFuture: boolean;
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
}: CommonProps) {
  const logHidden = variant === "skipped";
  const isLogged = variant === "logged";

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
            <FieldRow label="Duration" value={isLogged ? "—" : "—"} unit="min" disabled={isFuture} />
            <FieldRow label="Distance" value="—" unit="km" disabled={isFuture} />
            <FieldRow label="Vert" value="—" unit="m" disabled={isFuture} />
            <FieldRow label="Avg HR" value="—" unit="bpm" required disabled={isFuture} />
            {isLogged ? (
              <TimeInZoneBar zones={[]} />
            ) : (
              <DisclosureRow label="Add time-in-zone breakdown" disabled={isFuture} />
            )}
          </div>
        </Section>
      )}

      {!logHidden && (
        <Section label="NOTES">
          <NotesField disabled={isFuture} />
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
}: CommonProps) {
  const isLogged = variant === "logged";

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
          {content.exercises.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-zinc-200 px-3.5 py-3 text-[13px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
              Exercise list will appear here once your plan stores structured
              sets and reps. For now, follow the prescription above.
            </div>
          ) : (
            content.exercises.map((ex, i) => <ExerciseRow key={i} {...ex} />)
          )}
        </div>
      </Section>

      <Section label="NOTES">
        <NotesField />
      </Section>
    </>
  );
}

// ─── Physio ─────────────────────────────────────────────────
export function PhysioBody({ content }: CommonProps) {
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
            content.physioExercises.map((ex, i) => (
              <PhysioExerciseRow key={i} {...ex} />
            ))
          )}
        </div>
      </Section>

      <Section label="NOTES">
        <NotesField />
      </Section>
    </>
  );
}

// ─── Cross-training (cycling / swim) ────────────────────────
export function CrossBody({ content, variant, loggedAt, isFuture }: CommonProps) {
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
          <FieldRow label="Duration" value="—" unit="min" disabled={isFuture} />
          <EffortSlider value={0} />
          <FieldRow label="Avg HR" value="—" unit="bpm" disabled={isFuture} />
        </div>
      </Section>

      <Section label="NOTES">
        <NotesField disabled={isFuture} />
      </Section>
    </>
  );
}

// ─── Mobility ───────────────────────────────────────────────
export function MobilityBody({ content, variant, loggedAt, status, isFuture }: CommonProps) {
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
          <DoneToggle done={status === "completed"} />
          <FieldRow label="Actual duration" value="—" unit="min" disabled={isFuture} />
        </div>
      </Section>

      <Section label="NOTES">
        <NotesField disabled={isFuture} />
      </Section>
    </>
  );
}

// ─── Hike ───────────────────────────────────────────────────
export function HikeBody({ content, variant, loggedAt, isFuture }: CommonProps) {
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
          <FieldRow label="Time on feet" value="—" unit="hr" required disabled={isFuture} />
          <FieldRow label="Vert" value="—" unit="m" disabled={isFuture} />
          <FieldRow label="Distance" value="—" unit="km" disabled={isFuture} />
          <FieldRow label="Avg HR" value="—" unit="bpm" disabled={isFuture} />
          <EffortSlider value={0} />
        </div>
      </Section>

      <Section label="NOTES">
        <NotesField disabled={isFuture} />
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
