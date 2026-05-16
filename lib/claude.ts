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

export interface GeneratePlanArgs {
  race: Race;
  profile: AthleteProfile;
  startDate: string;
  history: LoggedWorkout[];
}

export interface GeneratedWorkout {
  date: string;
  kind: WorkoutKind;
  title: string;
  details: string;
  position: number;
}

const SYSTEM_PROMPT = `You are an expert ultra marathon coach generating personalized training plans for amateur runners. Your plans:

- Use a progressive overload approach with a hard/easy weekly structure and a cutback week every 3rd or 4th week
- Mix running with strength/gym sessions (typically 2 per week) and mobility/recovery work
- Build aerobic base before adding intensity; introduce tempo and hills only after several base weeks
- Account for the runner's specific injury history with conservative ramp rates and low-impact cross-training alternatives (stationary bike, pool running) on days when high impact would aggravate the issue
- Use metric units throughout (km for distance, min/km for pace)
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

Submit the plan using the submit_training_plan tool. Do not respond with any text — only call the tool.`;

const PLAN_TOOL: Anthropic.Tool = {
  name: "submit_training_plan",
  description:
    "Submit the generated training plan for storage in the database.",
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
                "Concrete prescription in metric: e.g. '10 km @ 6:00/km easy', '6 × 90s hill repeats + warmup/cooldown', '45 min — squats, RDLs, single-leg work', '20 min foam roll + hip openers'",
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
    },
    required: ["workouts"],
  },
};

function formatHistory(history: LoggedWorkout[]): string {
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

function formatRace(race: Race, unit: "metric" | "imperial"): string {
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

function formatProfile(p: AthleteProfile): string {
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

function buildUserPrompt(args: GeneratePlanArgs): string {
  const distUnit = args.profile.unit_system === "metric" ? "km" : "mi";
  const paceUnit =
    args.profile.unit_system === "metric" ? "min/km" : "min/mi";

  return `Generate a training plan for the following runner.

RACE
${formatRace(args.race, args.profile.unit_system)}

RUNNER PROFILE
${formatProfile(args.profile)}

WORKOUT HISTORY
${formatHistory(args.history)}

PLAN PARAMETERS
- Start date (today): ${args.startDate}
- End date (race day): ${args.race.date}
- Use ${args.profile.unit_system} units throughout: ${distUnit} for distance, ${paceUnit} for pace
- Include a 2-week taper before race day
- Include the race itself as the final workout on the race date
- Generate workouts ONLY for dates from the start date onwards. Do NOT include any dates before the start date.

Submit the plan using the submit_training_plan tool.`;
}

export async function generateTrainingPlan(
  args: GeneratePlanArgs,
): Promise<GeneratedWorkout[]> {
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

  const input = toolUse.input as { workouts?: unknown };
  if (!Array.isArray(input.workouts)) {
    throw new Error("Claude returned no workouts array.");
  }

  return input.workouts as GeneratedWorkout[];
}
