import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { WorkoutKind } from "./plan";

const client = new Anthropic();

export interface RaceInput {
  name: string;
  distance: string;
  date: string;
}

export interface BaselineInput {
  weeklyVolume: string;
  longestRunKm: number;
  easyPace: string;
  injuryNotes: string;
}

export interface GeneratePlanArgs {
  race: RaceInput;
  baseline: BaselineInput;
  startDate: string;
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

function buildUserPrompt(args: GeneratePlanArgs): string {
  return `Generate a complete training plan for the following runner.

RACE
- Name: ${args.race.name}
- Distance: ${args.race.distance}
- Date: ${args.race.date}

RUNNER BASELINE
- Current weekly running volume: ${args.baseline.weeklyVolume}
- Longest run in the past 4 weeks: ${args.baseline.longestRunKm} km
- Comfortable easy/conversational pace: ${args.baseline.easyPace}
- Current injuries / things to manage carefully: ${args.baseline.injuryNotes}

PLAN PARAMETERS
- Start date (today): ${args.startDate}
- End date (race day): ${args.race.date}
- Use metric units throughout (km, min/km pace)
- Include a 2-week taper before race day
- Include the race itself as the final workout on the race date

Submit the complete plan using the submit_training_plan tool.`;
}

export async function generateTrainingPlan(
  args: GeneratePlanArgs,
): Promise<GeneratedWorkout[]> {
  const stream = client.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [PLAN_TOOL],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: buildUserPrompt(args) }],
  });

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
