import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  AthleteProfile,
  Race,
  WorkoutKind,
  WorkoutStatus,
} from "./plan";

const client = new Anthropic();

export interface LoggedWorkout {
  date: string;
  kind: WorkoutKind;
  title: string;
  details: string;
  status: WorkoutStatus;
}

export interface JournalContextEntry {
  type: "note" | "travel" | "injury" | "physio";
  entry_date: string;
  title: string | null;
  body: string | null;
  // Structured per-type payload as already-formatted lines, e.g.
  // ["body_part: Achilles", "side: right", "severity: 3/10"].
  details_lines: string[];
  consumed: boolean;
}

export interface GeneratePlanArgs {
  race: Race;
  profile: AthleteProfile;
  startDate: string;
  history: LoggedWorkout[];
  // Free-text the athlete typed in the regenerate sheet — surfaces what
  // happened since the last regen that the database can't see (subjective
  // feel, last-minute travel, "push the volume", etc.).
  notes?: string | null;
  // Persistent context from the journal tab: travel plans, injury
  // reports, physio notes, free notes. Anything still flagged
  // `consumed: false` is fresh since the last regen.
  journalEntries?: JournalContextEntry[];
}

export interface GeneratedWorkout {
  date: string;
  kind: WorkoutKind;
  title: string;
  details: string;
  position: number;
}

// Canonical definition of GenerationSummary + ChangeType lives in
// lib/preview.ts (it's part of the preview data flow). Re-exported here
// so callers depending on @/lib/claude keep working unchanged.
export type { ChangeType, GenerationSummary } from "@/lib/preview";
import type { GenerationSummary } from "@/lib/preview";

// What generateTrainingPlan returns: the workouts plus the coach summary.
// Previously this function returned just GeneratedWorkout[] — callers must
// now read .workouts.
export interface PlanGenerationResult {
  workouts: GeneratedWorkout[];
  summary: GenerationSummary;
}

const SYSTEM_PROMPT = `You are an expert ultra marathon coach generating personalized training plans for amateur runners. Your plans:

- Use a progressive overload approach with a hard/easy weekly structure and a cutback week every 3rd or 4th week
- Mix running with strength/gym sessions (typically 2 per week) and mobility/recovery work
- Build aerobic base before adding intensity; introduce tempo and hills only after several base weeks
- Account for the runner's specific injury history with conservative ramp rates and low-impact cross-training alternatives (stationary bike, pool running) on days when high impact would aggravate the issue
- Use the units specified in the user prompt — never hardcode metric. The athlete's unit_system field is the source of truth.
- Include a deliberate 2-week taper before race day
- Include the race itself as a "run" workout on the race date

Each day in the plan should have at least one workout. On rest days, schedule a short mobility session (15-20 min) so the day is not blank.

ADAPTATION FROM HISTORY
If a workout history is provided, the runner has been logging adherence. Use it to adapt the upcoming plan:
- Strong adherence (mostly completed): progress as planned, consider modest increases in intensity or volume if appropriate for the phase
- Frequent skipped runs: cut back planned volume, prioritize easier aerobic sessions, rebuild gradually
- Specific patterns (e.g., all gym sessions skipped, or all hard workouts skipped): adjust the mix accordingly
- Recent skipped long runs are the highest signal — protect aerobic base by extending the build phase if needed
- Generate workouts ONLY from the start date through race day. Do not regenerate past workouts.

Submit the plan using the submit_training_plan tool, including a short coach-voice summary and the high-level changes you made. Do not respond with any text — only call the tool.`;

const PLAN_TOOL: Anthropic.Tool = {
  name: "submit_training_plan",
  description:
    "Submit the generated training plan plus a short coach-voice summary of the plan changes.",
  input_schema: {
    type: "object",
    properties: {
      workouts: {
        type: "array",
        description:
          "All workouts from start date through race day, in chronological order. Every day in the range must appear at least once.",
        items: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "ISO date YYYY-MM-DD",
            },
            kind: {
              type: "string",
              enum: ["run", "gym", "mobility"],
              description: "Workout type",
            },
            title: {
              type: "string",
              description:
                "Short title: e.g. 'Easy run', 'Long run', 'Hill repeats', 'Lower body', 'Mobility'",
            },
            details: {
              type: "string",
              description:
                "Concrete prescription using the athlete's unit system: e.g. '10 km @ 6:00/km easy', '6 × 90s hill repeats + warmup/cooldown', '45 min — squats, RDLs, single-leg work'",
            },
            position: {
              type: "integer",
              description:
                "Order within the day (0 = primary, 1 = secondary, etc.)",
            },
          },
          required: ["date", "kind", "title", "details", "position"],
        },
      },
      summary: {
        type: "string",
        description:
          "1-2 sentences in coach voice (first person, addressed to the athlete) explaining the high-level rationale for this regeneration. Surfaces in the 'FROM YOUR COACH' card on the regen preview screen. Reference the athlete's most recent context (last 14 days, journal entries, notes) where useful.",
      },
      changes: {
        type: "array",
        description:
          "High-level moves the AI made, rendered as small change badges (e.g. 'SHIFTED Sat long → Thu'). Keep to 1-4 entries. Use 'shifted' when moving sessions across days, 'reduced' for cuts in volume or intensity, 'added' for new sessions, 'removed' when dropping sessions entirely.",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["shifted", "reduced", "added", "removed"],
            },
            text: {
              type: "string",
              description:
                "Short text rendered after the type badge (e.g. 'Sat long → Thu', 'weekly volume −8%', '2× calf strength').",
            },
          },
          required: ["type", "text"],
        },
      },
    },
    required: ["workouts", "summary", "changes"],
  },
};

// Pure formatters below are exported only so tests can snapshot them.
// They aren't part of the public API — generateTrainingPlan is.
export function formatHistory(history: LoggedWorkout[]): string {
  if (history.length === 0) {
    return "No logged history yet — this is the initial plan.";
  }
  const lines = history.map(
    (w) =>
      `${w.date} [${w.kind}] ${w.title} — ${w.details}  →  ${w.status}`,
  );
  const completedCount = history.filter((w) => w.status === "completed").length;
  const skippedCount = history.filter((w) => w.status === "skipped").length;
  const pendingCount = history.filter((w) => w.status === "pending").length;
  return `Past workouts and adherence (${completedCount} completed, ${skippedCount} skipped, ${pendingCount} unlogged):
${lines.join("\n")}`;
}

export function formatRace(race: Race, unit: "metric" | "imperial"): string {
  const distanceUnit = unit === "metric" ? "m" : "ft";
  const lines = [
    `- Name: ${race.name}`,
    `- Distance: ${race.distance}`,
    `- Date: ${race.date}`,
  ];
  if (race.elevation_gain != null)
    lines.push(`- Elevation gain: ${race.elevation_gain} ${distanceUnit}`);
  if (race.terrain) lines.push(`- Terrain: ${race.terrain}`);
  if (race.target_time) lines.push(`- Target finish time: ${race.target_time}`);
  if (race.intent) lines.push(`- Race intent: ${race.intent}`);
  return lines.join("\n");
}

export function formatProfile(p: AthleteProfile): string {
  const distUnit = p.unit_system === "metric" ? "km" : "mi";
  const paceUnit = p.unit_system === "metric" ? "min/km" : "min/mi";
  const lines = [
    `- Preferred units: ${p.unit_system}`,
    `- Current weekly running volume: ${p.weekly_volume}`,
    `- Longest run in past 4 weeks: ${p.longest_run_distance} ${distUnit}`,
    `- Comfortable easy pace: ${p.easy_pace} (${paceUnit})`,
    `- Injuries / things to manage carefully: ${p.injury_notes ?? "none reported"}`,
  ];
  if (p.experience) lines.push(`- Endurance experience: ${p.experience}`);
  if (p.gym_access) lines.push(`- Gym access: ${p.gym_access}`);
  if (p.equipment) lines.push(`- Equipment available: ${p.equipment}`);
  if (p.weekly_hours != null)
    lines.push(`- Weekly training time available: ${p.weekly_hours} hours`);
  if (p.cross_training)
    lines.push(`- Cross-training preferences: ${p.cross_training}`);
  if (p.other_commitments)
    lines.push(`- Other commitments / disruptions: ${p.other_commitments}`);
  if (p.sleep_stress) lines.push(`- Sleep & stress baseline: ${p.sleep_stress}`);
  return lines.join("\n");
}

// Formats the journal entries into a prompt section. Unconsumed entries
// are marked NEW so the model knows what's fresh since the last regen.
export function formatJournal(entries: JournalContextEntry[] | undefined): string {
  if (!entries || entries.length === 0) return "";
  const lines = entries.map((e) => {
    const flag = e.consumed ? "(seen)" : "(NEW)";
    const head = `[${e.type.toUpperCase()} · ${e.entry_date}] ${flag}`;
    const titleLine = e.title ? `\n  ${e.title}` : "";
    const bodyLine = e.body ? `\n  ${e.body}` : "";
    const detailLines = e.details_lines
      .map((d) => `\n  · ${d}`)
      .join("");
    return `${head}${titleLine}${bodyLine}${detailLines}`;
  });
  return `

JOURNAL ENTRIES (athlete-logged context — travel, injuries, physio visits, free notes. Items flagged NEW haven't been factored into a plan yet):
${lines.join("\n")}`;
}

export function buildUserPrompt(args: GeneratePlanArgs): string {
  const unit = args.profile.unit_system;
  const distUnit = unit === "metric" ? "km" : "mi";
  const paceUnit = unit === "metric" ? "min/km" : "min/mi";

  const notesSection = args.notes?.trim()
    ? `

ATHLETE NOTES (just shared via the regenerate sheet — treat as the most recent context, overriding stale assumptions):
${args.notes.trim()}`
    : "";

  const journalSection = formatJournal(args.journalEntries);

  return `Generate a training plan for the following runner.

RACE
${formatRace(args.race, args.profile.unit_system)}

RUNNER PROFILE
${formatProfile(args.profile)}

WORKOUT HISTORY
${formatHistory(args.history)}${journalSection}${notesSection}

PLAN PARAMETERS
- Start date (today): ${args.startDate}
- End date (race day): ${args.race.date}
- Athlete unit_system: ${unit}. Use ${distUnit} for distance and ${paceUnit} for pace in every workout's details. Never substitute metric.
- Include a 2-week taper before race day
- Include the race itself as the final workout on the race date
- Generate workouts ONLY for dates from the start date onwards. Do NOT include any dates before the start date.

Submit the plan using the submit_training_plan tool, including a coach-voice summary and a small array of change badges.`;
}

export async function generateTrainingPlan(
  args: GeneratePlanArgs,
): Promise<PlanGenerationResult> {
  const model = process.env.CLAUDE_MODEL ?? "claude-haiku-4-5";
  const supportsThinking =
    model.startsWith("claude-opus-") || model === "claude-sonnet-4-6";

  const baseParams = {
    model,
    max_tokens: 32000,
    system: [
      {
        type: "text" as const,
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    tools: [PLAN_TOOL],
    tool_choice: { type: "auto" as const },
    messages: [
      { role: "user" as const, content: buildUserPrompt(args) },
    ],
  };

  const stream = client.messages.stream(
    supportsThinking
      ? {
          ...baseParams,
          thinking: { type: "adaptive" as const },
          output_config: { effort: "medium" as const },
        }
      : baseParams,
  );

  const message = await stream.finalMessage();

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === "submit_training_plan",
  );

  if (!toolUse) {
    throw new Error(
      `Claude did not call submit_training_plan. stop_reason=${message.stop_reason}`,
    );
  }

  const input = toolUse.input as {
    workouts?: unknown;
    summary?: unknown;
    changes?: unknown;
  };
  if (!Array.isArray(input.workouts)) {
    throw new Error("Claude returned no workouts array.");
  }

  // Fall back to a generic coach message if the tool call returned no
  // summary — older model behaviour, defensive guard.
  const summaryText =
    typeof input.summary === "string" && input.summary.trim().length > 0
      ? input.summary.trim()
      : "I updated your plan based on the latest context. Tap a week to see what changed.";

  // Filter changes to the accepted shape. Anything malformed is dropped
  // silently rather than throwing — the diff still renders without badges.
  const changes: GenerationSummary["changes"] = Array.isArray(input.changes)
    ? (input.changes as unknown[])
        .filter(
          (c): c is { type: string; text: string } =>
            typeof c === "object" &&
            c !== null &&
            typeof (c as { type?: unknown }).type === "string" &&
            typeof (c as { text?: unknown }).text === "string",
        )
        .filter((c) =>
          ["shifted", "reduced", "added", "removed"].includes(c.type),
        )
        .map((c) => ({
          type: c.type as GenerationSummary["changes"][number]["type"],
          text: c.text,
        }))
    : [];

  return {
    workouts: input.workouts as GeneratedWorkout[],
    summary: { summary: summaryText, changes },
  };
}
