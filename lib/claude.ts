import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  ActualDetail,
  AthleteProfile,
  Race,
  WorkoutKind,
  WorkoutStatus,
} from "./plan";
import {
  addDays,
  buildRetryMessage,
  errorsOnly,
  validateGeneratedPlan,
} from "@/lib/plan-validation";

const client = new Anthropic();

export interface LoggedWorkout {
  date: string;
  kind: WorkoutKind;
  title: string;
  details: string;
  status: WorkoutStatus;
  // Captured-on-the-day actuals. All optional. Fed into formatHistory so
  // Claude can see overperformance / underperformance vs. prescribed and
  // calibrate the next plan accordingly.
  actual_duration_min?: number | null;
  actual_distance_km?: number | null;
  actual_elevation_gain_m?: number | null;
  actual_hr_avg?: number | null;
  actual_rpe?: number | null;
  actual_notes?: string | null;
  actual_detail?: ActualDetail | null;
  // Planned exercises for strength workouts, sourced via
  // deriveWorkoutContent at history-build time. Lets
  // formatStrengthActuals classify each exercise as DONE AT PLANNED /
  // WITH OVERRIDES / SHORT against the planned target.
  planned_exercises?: {
    name: string;
    sets: number;
    reps: number;
    weight: number;
    unit: string;
  }[];
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
  // B/C races (and any non-A non-completed races) so the model can build
  // tune-up workouts and avoid stacking hard sessions adjacent to them.
  // Optional — empty array or undefined means there are no other races.
  otherRaces?: Race[];
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
  // The most recent accepted regen's coach-voice summary, replayed back
  // into the prompt for continuity. Lets Claude see "this is what I told
  // the athlete last time and what I moved" so the new plan can build on
  // (or deliberately diverge from) the prior direction. null on the
  // initial wizard plan and on any user with no accepted regens yet.
  previousSummary?: GenerationSummary | null;
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

const SYSTEM_PROMPT = `You are an expert ultra marathon coach generating personalized training plans for amateur runners. Submit plans using the submit_training_plan tool only — never respond with plain text.

# METHODOLOGY

Apply these rules quantitatively, not as vibes. They are guidelines you must check your plan against before submitting.

## Periodization

Allocate weeks across four phases, proportional to the total training window from start date to race day:

- BASE (40-50% of available weeks): aerobic volume, mobility, strength foundation. NO quality work, hill repeats, or tempo. Long run grows ~10% per week with a cutback every 4th week.
- BUILD (30-40%): introduce race-specific intensity — hill repeats, tempo, long-run-with-effort. Weekly shape: 1-2 quality sessions, 1 long run, remainder easy aerobic.
- PEAK (10-15%): highest sustained volume and longest long run. Race-specific brick sessions if applicable.
- TAPER (final 2 weeks, non-negotiable): reduce volume ~40% in week -2, ~60% in week -1. Maintain some intensity. End with short shakeout 1-2 days before race.

Compressed-window handling:
- Window < 12 weeks: compress BASE to 2-3 weeks, then BUILD → PEAK → TAPER.
- Window < 6 weeks: skip BASE entirely. Focus on race-specific work + recovery + 2-week taper.
- Window < 3 weeks: this is a taper-only plan. Maintain fitness, do not build.

## Quantitative rules (do not violate)

- 80/20 distribution: at least 80% of weekly running volume at easy aerobic effort (conversational pace, can speak in full sentences). No more than 20% at moderate-to-hard.
- 10% rule: weekly running volume increases by ≤10% week-over-week, with a cutback (−25 to −35%) every 3rd or 4th week.
- Long run cap: never exceeds 30-35% of weekly volume; for ultras, never exceeds 25% of race distance in a single training run.
- 48-hour spacing: no two hard sessions (quality run, hill repeats, long run, tempo) within 48 hours.
- Order of operations: the day after a long run is easy or rest. Never schedule back-to-back hard days.
- Race-day taper: progressive reduction in the final 14 days; last 3 days are easy shakeout or rest only.

## Race-specificity (read from race profile)

- High elevation gain (>500 m / 1500 ft): include weekly vert hikes or hill repeats from BUILD phase onward. Add downhill-emphasis sessions in PEAK to prep quads.
- Trail / technical terrain: bias long runs to trails when athlete has access (check outdoor_terrain). Include at least one weekly run on similar terrain from BUILD phase.
- Hot/humid race: include heat exposure prep in final 4 weeks.
- Intent = "relaxed" or "Just finish": conservative volume, no risk-taking, comfortable peak.
- Intent = "moderate" or "Finish strong": balanced approach, 1 quality session per week in BUILD.
- Intent = "competitive": more quality, sharper peaks, race-pace work in BUILD/PEAK.

## B/C races

If the user prompt includes OTHER RACES, treat each as a fixed point on the calendar:
- B-race: a tune-up effort. No quality sessions in the 3 days before. Recovery week after (cut volume ~25%).
- C-race: typically a training run with race shoes/fueling. Light reduction in surrounding load.
- Never schedule a hard quality session within 2 days after any B/C race.

## Strength sessions

- BASE & BUILD: 2 strength sessions per week (unless athlete strength_freq says otherwise — respect that field).
- PEAK: 1 per week (maintenance).
- TAPER week -2: 1 light session. TAPER week -1: none.
- Lower body emphasis: squats, RDLs, single-leg work, calf raises. Posterior chain priority for ultras.
- If injury_notes mentions Achilles: heavy slow calf raises 2×/week.
- If injury_notes mentions hip/knee/IT band: extra glute/hip stability work.

## Session duration accounting

Prescribe wall-clock time, not work time. Account for warm-up, inter-set rest, and transitions — without these, session-length estimates under-shoot by 30-40%.

**Strength** — budget per exercise:
- Compound lifts (squats, deadlifts, bench, OHP, rows): ~12 min each (2-3 min rest × 3-4 working sets + warm-up sets + plate changes).
- Accessory lifts (lunges, presses, pulldowns, single-leg work): ~8 min each (60-90s rest × 3 sets + transitions).
- Isolation work (curls, lateral raises, calf raises): ~5 min each (45-60s rest × 3 sets).
- Add 5-8 min general warm-up + 3-5 min cool-down to the session total.

A 45-min strength session realistically fits ~3-4 exercises. A 60-min session fits ~5-6. Do not prescribe 6-7 exercises in 45 minutes.

**Mobility** — pace ~60-90s per movement (hold + transition):
- 15-min session: 6-8 movements
- 20-min session: 8-10 movements
- 30-min session: 12-15 movements

Do not pack more movements than the time budget supports.

**Running, cycling, swimming, hiking** — wall-clock time equals work time (no inter-set rest), so duration prescriptions match activity time directly.

# INJURY HANDLING

Treat injury_notes as a primary constraint, not a footnote.

- Acute or recent injury (within 4 weeks): skip impact on flagged days, replace with pool running or stationary bike. Build back gradually (50% → 75% → 100% of planned volume over 3 weeks).
- Chronic flare risk: schedule low-impact alternatives on planned hard days. Never two consecutive high-impact days.
- Severe / recent surgery / stress fracture mentioned: reduce overall volume by 30-40% vs. what the profile alone would suggest. Add more cross-training and strength.

If chronic_conditions includes asthma, diabetes, or similar, prefer steadier efforts over high-spike intervals.

# ADAPTATION FROM HISTORY

When workout history is provided, read it for adherence and adapt:

- ≥80% completed: progress as planned. Modest increases appropriate to phase.
- 50-79% completed: hold volume flat. No increases. Check whether skipped sessions cluster — all gym? all hard? — and rebalance the mix.
- <50% completed: cut planned volume by ~20%. Simplify (more easy runs, fewer complex sessions). Rebuild gradually.
- Recent skipped long runs are the highest-priority signal — extend BASE before adding intensity.
- Multiple recent injury or pain entries in journal: bias toward conservative ramp, more cross-training, slower progression.

# OUTPUT REQUIREMENTS

- Generate workouts ONLY from start date through race day. Never include past dates.
- Every date in the range must have at least one workout. On rest days, schedule 15-20 min mobility.
- Include the race itself as a "run" kind workout on race day. Details should match the race (distance, elevation, terrain).
- Use the athlete's unit_system for distances and paces. Never substitute metric for imperial or vice versa. The unit_system field is the source of truth.
- Submit via the submit_training_plan tool. No plain text response.

# KIND VOCABULARY

Each workout must declare one of six kinds. Pick the kind that matches the session's intent, not the closest fit:

- run: actual running — easy aerobic, tempo, intervals, long runs, race itself. The spine of the plan.
- gym: barbell / dumbbell / bodyweight strength training. Push, pull, lower, full-body splits.
- hike: time-on-feet hill training with explicit vert focus. Walking pace on climbs; the goal is sustained climbing under fatigue, not running cadence. Schedule for races with significant elevation gain (>500 m).
- cross: non-impact aerobic — cycling, swimming, rowing, elliptical, pool running. Use as injury workaround or active recovery.
- physio: targeted injury-management routine with per-exercise focus. Prescribe when injury_notes flag a specific area. NOT general mobility.
- mobility: flexibility, activation, general movement prep. Default for rest days when there's no specific physio need.

# COACH VOICE (for summary field)

First person, addressed to the athlete, warm but direct. Reference recent context (last 14 days of history, journal entries flagged NEW, athlete notes) explicitly. 1-2 sentences.

Example: "You missed two of last week's runs and your calf was flagged in the journal — I've pulled back this week's volume and swapped the Wednesday quality session for an easy bike spin so we can settle the calf before we build into the next block."`;

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
              enum: ["run", "gym", "mobility", "hike", "cross", "physio"],
              description:
                "Workout type. See the KIND VOCABULARY section in the system prompt — pick the kind that matches the session's intent (e.g. hike for vert-focused walking, cross for non-impact aerobic, physio for injury-specific work).",
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

// Builds the `actual: …` sub-lines for a single workout. Each populated
// field contributes one fragment, joined by " · ". Returns null when no
// actuals are present so the caller can skip rendering the line.
export function formatActuals(w: LoggedWorkout): string | null {
  const parts: string[] = [];
  if (w.actual_distance_km != null) parts.push(`${w.actual_distance_km} km`);
  if (w.actual_duration_min != null) {
    const minutes = w.actual_duration_min;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const rem = Math.round(minutes - hours * 60);
      parts.push(rem > 0 ? `${hours}h${String(rem).padStart(2, "0")}` : `${hours}h`);
    } else {
      parts.push(`${minutes} min`);
    }
  }
  if (w.actual_elevation_gain_m != null) {
    parts.push(`+${w.actual_elevation_gain_m}m`);
  }
  if (w.actual_hr_avg != null) parts.push(`HR ${w.actual_hr_avg}`);
  if (w.actual_rpe != null) parts.push(`RPE ${w.actual_rpe}`);
  if (parts.length === 0 && !w.actual_notes && !w.actual_detail) return null;
  return parts.length > 0 ? `actual: ${parts.join(" · ")}` : null;
}

// Strength-specific summary. When `planned_exercises` is threaded
// through (current path — see attachPlannedExercises in app/actions.ts),
// classify each planned exercise as done-at-planned / with-overrides /
// short and emit the rich "N exercises (M with overrides, K short)"
// line. When it's missing (legacy / external callers), fall back to
// raw totals — "N sets across M exercises" — so Claude still sees the
// shape of the session.
export function formatStrengthActuals(w: LoggedWorkout): string | null {
  const d = w.actual_detail;
  if (!d) return null;
  if (
    (!d.sets || d.sets.length === 0) &&
    (!d.skipped_exercises || d.skipped_exercises.length === 0) &&
    (!d.added_exercises || d.added_exercises.length === 0)
  ) {
    return null;
  }

  const planned = w.planned_exercises ?? [];
  const sets = d.sets ?? [];

  // Group recorded sets by exerciseName so the per-exercise comparison
  // doesn't have to scan the array N×M times.
  const byEx = new Map<string, typeof sets>();
  for (const s of sets) {
    const list = byEx.get(s.exerciseName) ?? [];
    list.push(s);
    byEx.set(s.exerciseName, list);
  }

  let exercisesAtPlanned = 0;
  let exercisesWithOverrides = 0;
  let exercisesShort = 0;
  for (const p of planned) {
    if (d.skipped_exercises?.includes(p.name)) continue;
    const exSets = byEx.get(p.name) ?? [];
    if (exSets.length === 0) continue;
    const last = exSets[exSets.length - 1];
    const isShort = last.reps < p.reps;
    const hasOverride = exSets.some(
      (s) => s.reps !== p.reps || s.weight !== p.weight,
    );
    if (isShort) exercisesShort++;
    else if (hasOverride) exercisesWithOverrides++;
    else exercisesAtPlanned++;
  }

  const parts: string[] = [];
  const totalClassified =
    exercisesAtPlanned + exercisesWithOverrides + exercisesShort;
  if (totalClassified > 0) {
    let line = `${totalClassified} exercise${
      totalClassified === 1 ? "" : "s"
    }`;
    const flags: string[] = [];
    if (exercisesWithOverrides > 0) {
      flags.push(`${exercisesWithOverrides} with overrides`);
    }
    if (exercisesShort > 0) flags.push(`${exercisesShort} short`);
    if (flags.length > 0) line += ` (${flags.join(", ")})`;
    parts.push(line);
  } else if (sets.length > 0) {
    // Legacy fallback — no planned data threaded, so we can't classify.
    const exNames = new Set(sets.map((s) => s.exerciseName));
    parts.push(
      `${sets.length} set${sets.length === 1 ? "" : "s"} across ${
        exNames.size
      } exercise${exNames.size === 1 ? "" : "s"}`,
    );
  }
  if (d.skipped_exercises && d.skipped_exercises.length > 0) {
    parts.push(`skipped: ${d.skipped_exercises.join(", ")}`);
  }
  if (d.added_exercises && d.added_exercises.length > 0) {
    parts.push(
      `user-added: ${d.added_exercises.map((e) => e.name).join(", ")}`,
    );
  }
  return parts.length > 0 ? `strength: ${parts.join(" · ")}` : null;
}

// Pure formatters below are exported only so tests can snapshot them.
// They aren't part of the public API — generateTrainingPlan is.
// ---------- adherence summary ----------
//
// Why this exists: Claude is non-deterministic and won't always extract
// adherence patterns from raw logs reliably. Pre-computing rolling
// completion rates, by-kind breakdowns, most-recent skip, and skip
// clusters surfaces the highest-signal facts as explicit lines at the
// top of the WORKOUT HISTORY section. The detailed per-workout lines
// are still included for the last 28 days; everything older gets
// rolled up into a compressed one-liner so the prompt doesn't bloat
// over a long training cycle.

export interface AdherenceWindowStats {
  totalWorkouts: number;
  completed: number;
  skipped: number;
  pending: number;
  // 0-1 fraction. null when totalWorkouts === 0 so consumers can decide
  // how to render the empty case.
  completionRate: number | null;
}

export interface AdherenceByKind {
  run: AdherenceWindowStats;
  gym: AdherenceWindowStats;
  mobility: AdherenceWindowStats;
}

export interface SkipCluster {
  startDate: string;
  endDate: string;
  days: number;
}

export interface AdherenceSummary {
  // Rolling windows ending the day before `today` (since `today` workouts
  // aren't logged yet — history is strictly past).
  last7: AdherenceWindowStats;
  last14: AdherenceWindowStats;
  last28: AdherenceWindowStats;
  // Whole training cycle (everything in history).
  cycle: AdherenceWindowStats;
  // Earliest date in history; proxy for cycle start. null when history empty.
  cycleStartDate: string | null;
  // By-kind breakdown for the last 28 days (the window Claude sees detailed).
  byKindLast28: AdherenceByKind;
  // Most recently skipped workout across the whole history.
  mostRecentSkipped: LoggedWorkout | null;
  // Contiguous date ranges of ≥2 consecutive days with at least one
  // skipped workout and zero completed (likely travel / injury / rest).
  skipClusters: SkipCluster[];
}

function tallyWindow(workouts: LoggedWorkout[]): AdherenceWindowStats {
  const completed = workouts.filter((w) => w.status === "completed").length;
  const skipped = workouts.filter((w) => w.status === "skipped").length;
  const pending = workouts.filter((w) => w.status === "pending").length;
  const total = workouts.length;
  return {
    totalWorkouts: total,
    completed,
    skipped,
    pending,
    completionRate: total > 0 ? completed / total : null,
  };
}

const EMPTY_WINDOW = (): AdherenceWindowStats => ({
  totalWorkouts: 0,
  completed: 0,
  skipped: 0,
  pending: 0,
  completionRate: null,
});

// Identifies contiguous runs of ≥2 days where each day had ≥1 skipped
// workout and zero completed. Multi-workout days with mixed status (one
// skipped, one completed) are NOT counted as skip days because the user
// clearly showed up; the skip was a within-day swap.
function computeSkipClusters(history: LoggedWorkout[]): SkipCluster[] {
  // Group by date so multi-workout days are evaluated as a unit.
  const byDate = new Map<string, LoggedWorkout[]>();
  for (const w of history) {
    const arr = byDate.get(w.date) ?? [];
    arr.push(w);
    byDate.set(w.date, arr);
  }
  // A "skip day" is one where ≥1 workout was skipped and 0 were completed.
  const skipDays = [...byDate.entries()]
    .filter(([, ws]) => {
      const hasSkipped = ws.some((w) => w.status === "skipped");
      const hasCompleted = ws.some((w) => w.status === "completed");
      return hasSkipped && !hasCompleted;
    })
    .map(([date]) => date)
    .sort();

  // Walk the sorted skip-days, gathering contiguous runs (no gaps).
  const clusters: SkipCluster[] = [];
  let runStart: string | null = null;
  let runEnd: string | null = null;
  let runLen = 0;
  const flush = () => {
    if (runStart && runEnd && runLen >= 2) {
      clusters.push({ startDate: runStart, endDate: runEnd, days: runLen });
    }
  };
  for (const date of skipDays) {
    if (runEnd && addDays(runEnd, 1) === date) {
      runEnd = date;
      runLen++;
    } else {
      flush();
      runStart = date;
      runEnd = date;
      runLen = 1;
    }
  }
  flush();
  return clusters;
}

export function computeAdherence(
  history: LoggedWorkout[],
  today: string,
): AdherenceSummary {
  if (history.length === 0) {
    return {
      last7: EMPTY_WINDOW(),
      last14: EMPTY_WINDOW(),
      last28: EMPTY_WINDOW(),
      cycle: EMPTY_WINDOW(),
      cycleStartDate: null,
      byKindLast28: {
        run: EMPTY_WINDOW(),
        gym: EMPTY_WINDOW(),
        mobility: EMPTY_WINDOW(),
      },
      mostRecentSkipped: null,
      skipClusters: [],
    };
  }

  // Cutoffs are inclusive (date >= cutoff) and bounded above by `today`
  // (history is already filtered to date < today upstream).
  const cut7 = addDays(today, -7);
  const cut14 = addDays(today, -14);
  const cut28 = addDays(today, -28);
  const last7 = history.filter((w) => w.date >= cut7);
  const last14 = history.filter((w) => w.date >= cut14);
  const last28 = history.filter((w) => w.date >= cut28);

  // Cycle start = earliest workout date in history (lexicographic sort is
  // safe for YYYY-MM-DD strings).
  const cycleStartDate = [...history.map((w) => w.date)].sort()[0] ?? null;

  const byKindLast28: AdherenceByKind = {
    run: tallyWindow(last28.filter((w) => w.kind === "run")),
    gym: tallyWindow(last28.filter((w) => w.kind === "gym")),
    mobility: tallyWindow(last28.filter((w) => w.kind === "mobility")),
  };

  // Most recently skipped — sort descending by date, take the first.
  const mostRecentSkipped =
    [...history]
      .filter((w) => w.status === "skipped")
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

  return {
    last7: tallyWindow(last7),
    last14: tallyWindow(last14),
    last28: tallyWindow(last28),
    cycle: tallyWindow(history),
    cycleStartDate,
    byKindLast28,
    mostRecentSkipped,
    skipClusters: computeSkipClusters(history),
  };
}

function formatPct(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function formatWindow(
  label: string,
  w: AdherenceWindowStats,
): string {
  if (w.totalWorkouts === 0) {
    return `- ${label}: no workouts logged in window`;
  }
  return `- ${label}: ${w.completed}/${w.totalWorkouts} completed (${formatPct(w.completionRate)}), ${w.skipped} skipped, ${w.pending} unlogged`;
}

export function formatAdherenceSummary(summary: AdherenceSummary): string {
  if (summary.cycle.totalWorkouts === 0) return "";
  const lines: string[] = ["ADHERENCE SUMMARY"];
  lines.push(formatWindow("Last 7 days", summary.last7));
  lines.push(formatWindow("Last 14 days", summary.last14));
  lines.push(formatWindow("Last 28 days", summary.last28));
  lines.push(
    formatWindow(
      summary.cycleStartDate
        ? `This cycle (since ${summary.cycleStartDate})`
        : "This cycle",
      summary.cycle,
    ),
  );

  // By-kind breakdown for last 28 days — only include kinds with workouts.
  const bk = summary.byKindLast28;
  const parts: string[] = [];
  if (bk.run.totalWorkouts > 0) {
    parts.push(`runs ${bk.run.completed}/${bk.run.totalWorkouts}`);
  }
  if (bk.gym.totalWorkouts > 0) {
    parts.push(`strength ${bk.gym.completed}/${bk.gym.totalWorkouts}`);
  }
  if (bk.mobility.totalWorkouts > 0) {
    parts.push(`mobility ${bk.mobility.completed}/${bk.mobility.totalWorkouts}`);
  }
  if (parts.length > 0) {
    lines.push(`- By kind (last 28 days): ${parts.join(", ")}`);
  }

  if (summary.mostRecentSkipped) {
    const m = summary.mostRecentSkipped;
    lines.push(
      `- Most recent skipped: ${m.date} [${m.kind}] ${m.title} — ${m.details}`,
    );
  }

  if (summary.skipClusters.length > 0) {
    const clusterLines = summary.skipClusters
      .map((c) => `${c.startDate} → ${c.endDate} (${c.days} days)`)
      .join("; ");
    lines.push(`- Skip clusters (≥2 consecutive days, no workouts completed): ${clusterLines}`);
  }

  return lines.join("\n");
}

// Per-workout detail line for the RECENT WORKOUTS block. Pulled out of
// formatHistory so it can be unit-tested and reused.
function formatHistoryLine(w: LoggedWorkout): string[] {
  const out = [
    `${w.date} [${w.kind}] ${w.title} — ${w.details}  →  ${w.status}`,
  ];
  const actuals = formatActuals(w);
  if (actuals) out.push(`  ${actuals}`);
  if (w.kind === "gym") {
    const strength = formatStrengthActuals(w);
    if (strength) out.push(`  ${strength}`);
  }
  if (w.actual_notes && w.actual_notes.trim().length > 0) {
    // Quote the note so Claude reads it as athlete voice rather than
    // structured data. Single-line — collapse newlines defensively.
    out.push(`  "${w.actual_notes.replace(/\s+/g, " ").trim()}"`);
  }
  if (w.actual_detail?.zones && w.actual_detail.zones.length > 0) {
    const zoneStr = w.actual_detail.zones
      .map((z) => `${z.label} ${z.minutes}min`)
      .join(" · ");
    out.push(`  time in zone: ${zoneStr}`);
  }
  return out;
}

export function formatHistory(
  history: LoggedWorkout[],
  today: string,
): string {
  if (history.length === 0) {
    return "No logged history yet — this is the initial plan.";
  }

  const summary = computeAdherence(history, today);
  const summaryBlock = formatAdherenceSummary(summary);

  // Split detailed (last 28 days) vs earlier (compressed rollup only).
  const cutoff = addDays(today, -28);
  const recent = history.filter((w) => w.date >= cutoff);
  const earlier = history.filter((w) => w.date < cutoff);

  const recentBlock =
    recent.length > 0
      ? `

RECENT WORKOUTS (last 28 days, detailed)
${recent.flatMap((w) => formatHistoryLine(w)).join("\n")}`
      : "";

  let earlierBlock = "";
  if (earlier.length > 0) {
    const earlierStats = tallyWindow(earlier);
    const earlierStart = earlier[0].date;
    const earlierEnd = earlier[earlier.length - 1].date;
    earlierBlock = `

EARLIER IN THIS CYCLE (rolled up — not shown per-workout)
- Range: ${earlierStart} → ${earlierEnd}
- ${earlierStats.completed}/${earlierStats.totalWorkouts} completed (${formatPct(earlierStats.completionRate)}), ${earlierStats.skipped} skipped, ${earlierStats.pending} unlogged`;
  }

  return `${summaryBlock}${recentBlock}${earlierBlock}`;
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

// Formats B/C (and any other non-A) races as a compact section. The
// model uses these to schedule tune-up workouts and to avoid placing
// hard sessions in the days surrounding a B-race. Returns an empty
// string when there are no other races so the prompt stays clean.
export function formatOtherRaces(
  races: Race[] | undefined,
  unit: "metric" | "imperial",
): string {
  if (!races || races.length === 0) return "";
  const distanceUnit = unit === "metric" ? "m" : "ft";
  const lines = races.map((r) => {
    const parts: string[] = [
      `${r.priority ?? "B"}-race · ${r.date} · ${r.name} · ${r.distance}`,
    ];
    const extras: string[] = [];
    if (r.elevation_gain != null)
      extras.push(`${r.elevation_gain} ${distanceUnit} gain`);
    if (r.terrain) extras.push(r.terrain);
    if (r.intent) extras.push(`intent: ${r.intent}`);
    if (extras.length > 0) parts.push(`(${extras.join(", ")})`);
    return `- ${parts.join(" ")}`;
  });
  return `

OTHER RACES (lower-priority races between today and the A race. Schedule them as tune-ups or B-race efforts depending on intent. Do NOT place hard quality sessions in the 3 days before or 2 days after any B/C race):
${lines.join("\n")}`;
}

// Fitness self-rating (1-5) → human label so the model gets the
// semantic meaning, not just a number.
const FITNESS_LABELS: Record<number, string> = {
  1: "just starting out",
  2: "building base fitness",
  3: "consistent training",
  4: "trained, racing regularly",
  5: "highly trained, competitive",
};

// Stress self-rating (1-5) → human label.
const STRESS_LABELS: Record<number, string> = {
  1: "very low",
  2: "low",
  3: "moderate",
  4: "high",
  5: "very high",
};

export function formatProfile(p: AthleteProfile): string {
  const distUnit = p.unit_system === "metric" ? "km" : "mi";
  const lines = [
    `- Preferred units: ${p.unit_system}`,
    `- Current weekly running volume: ${p.weekly_volume}`,
    `- Longest run in past 4 weeks: ${p.longest_run_distance} ${distUnit}`,
    `- Injuries / things to manage carefully: ${p.injury_notes ?? "none reported"}`,
  ];
  // Self-rated fitness: most important calibration signal. 1-5 scale
  // surfaced as a human label so the model doesn't have to guess what
  // "3" means.
  if (p.fitness_rating != null && FITNESS_LABELS[p.fitness_rating]) {
    lines.push(
      `- Self-rated fitness: ${p.fitness_rating}/5 (${FITNESS_LABELS[p.fitness_rating]})`,
    );
  }
  // Endurance history. years_ultras + ultras_completed are the highest-
  // signal experience fields for ultra-distance planning.
  if (p.years_running != null) {
    lines.push(`- Years running: ${p.years_running}`);
  }
  if (p.years_ultras != null) {
    lines.push(`- Years doing ultras: ${p.years_ultras}`);
  }
  if (p.ultras_completed) {
    lines.push(`- Ultras completed: ${p.ultras_completed}`);
  }
  if (p.longest_race_distance != null) {
    const namePart = p.longest_race_name ? ` (${p.longest_race_name})` : "";
    const datePart = p.longest_race_date ? `, ${p.longest_race_date}` : "";
    lines.push(
      `- Longest race ever: ${p.longest_race_distance} ${distUnit}${namePart}${datePart}`,
    );
  }
  if (p.experience) lines.push(`- Endurance experience: ${p.experience}`);

  // Health & recovery. Sleep + stress let the model weight recovery
  // aggressiveness; chronic_conditions is separate from injury_notes
  // (acute) and useful for long-term risk awareness.
  if (p.sleep_hours != null) {
    lines.push(`- Typical sleep: ${p.sleep_hours} hrs/night`);
  }
  if (p.stress_baseline != null && STRESS_LABELS[p.stress_baseline]) {
    lines.push(
      `- Baseline life stress: ${p.stress_baseline}/5 (${STRESS_LABELS[p.stress_baseline]})`,
    );
  }
  if (p.chronic_conditions) {
    lines.push(`- Chronic conditions: ${p.chronic_conditions}`);
  }

  // Biometrics — marginal for plan structure but useful for conservative
  // ramp rates with older athletes or future heart-rate work.
  if (p.age != null) lines.push(`- Age: ${p.age}`);
  if (p.sex) lines.push(`- Sex: ${p.sex}`);
  if (p.body_weight != null) {
    const wtUnit = p.unit_system === "metric" ? "kg" : "lb";
    lines.push(`- Body weight: ${p.body_weight} ${wtUnit}`);
  }

  // Equipment & access. outdoor_terrain is critical for race-specificity
  // (no point prescribing weekly hill repeats if they live somewhere flat).
  if (p.gym_access) lines.push(`- Gym access: ${p.gym_access}`);
  if (p.equipment) lines.push(`- Equipment available: ${p.equipment}`);
  if (p.outdoor_terrain && p.outdoor_terrain.length > 0) {
    lines.push(`- Outdoor terrain access: ${p.outdoor_terrain.join(", ")}`);
  }

  // Training time + scheduling. Two distinct fields: how much they
  // currently train vs. how much they could. Render both when they differ.
  if (
    p.weekly_hours_current != null &&
    p.weekly_hours != null &&
    p.weekly_hours_current !== p.weekly_hours
  ) {
    lines.push(`- Currently training: ${p.weekly_hours_current} hrs/week`);
    lines.push(`- Available training time: ${p.weekly_hours} hrs/week`);
  } else if (p.weekly_hours != null) {
    lines.push(`- Weekly training time available: ${p.weekly_hours} hours`);
  } else if (p.weekly_hours_current != null) {
    lines.push(`- Currently training: ${p.weekly_hours_current} hrs/week`);
  }
  if (p.training_days && p.training_days.length > 0) {
    lines.push(`- Training days available: ${p.training_days.join(", ")}`);
  }
  if (p.strength_freq) {
    lines.push(`- Preferred strength frequency: ${p.strength_freq}`);
  }
  // Multi-day arrays preferred over the legacy single-value columns.
  const longDays =
    p.long_run_days && p.long_run_days.length > 0
      ? p.long_run_days.join(", ")
      : p.long_run_day;
  if (longDays) lines.push(`- Long run days: ${longDays}`);
  const qDays =
    p.quality_days && p.quality_days.length > 0
      ? p.quality_days.join(", ")
      : p.quality_day;
  if (qDays) lines.push(`- Quality day(s): ${qDays}`);
  if (p.cross_training)
    lines.push(`- Cross-training preferences: ${p.cross_training}`);
  if (p.other_commitments)
    lines.push(`- Other commitments / disruptions: ${p.other_commitments}`);
  if (p.sleep_stress) lines.push(`- Sleep & stress baseline: ${p.sleep_stress}`);
  return lines.join("\n");
}

// Renders the most recently accepted regen's coach-voice summary +
// change badges as a continuity section. Returns empty string when
// there's no previous summary (initial plan from wizard, or all prior
// previews were discarded). The framing makes clear this is context,
// not a directive — Claude can build on the prior direction or
// deliberately diverge if recent signals warrant.
export function formatPreviousSummary(
  prev: GenerationSummary | null | undefined,
): string {
  if (!prev || !prev.summary || prev.summary.trim().length === 0) return "";
  const changeLines =
    Array.isArray(prev.changes) && prev.changes.length > 0
      ? "\n" +
        prev.changes
          .map((c) => `- ${c.type.toUpperCase()} ${c.text}`)
          .join("\n")
      : "";
  return `

PREVIOUS COACH MESSAGE (what you told the athlete in the last accepted regen — use for continuity, but feel free to revise direction if recent context warrants):
"${prev.summary.trim()}"${changeLines}`;
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
  const otherRacesSection = formatOtherRaces(
    args.otherRaces,
    args.profile.unit_system,
  );
  const previousSummarySection = formatPreviousSummary(args.previousSummary);

  return `Generate a training plan for the following runner.

RACE
${formatRace(args.race, args.profile.unit_system)}${otherRacesSection}

RUNNER PROFILE
${formatProfile(args.profile)}

WORKOUT HISTORY
${formatHistory(args.history, args.startDate)}${journalSection}${notesSection}${previousSummarySection}

PLAN PARAMETERS
- Start date (today): ${args.startDate}
- End date (race day): ${args.race.date}
- Athlete unit_system: ${unit}. Use ${distUnit} for distance and ${paceUnit} for pace in every workout's details. Never substitute metric.
- Include a 2-week taper before race day
- Include the race itself as the final workout on the race date
- Generate workouts ONLY for dates from the start date onwards. Do NOT include any dates before the start date.

Submit the plan using the submit_training_plan tool, including a coach-voice summary and a small array of change badges.`;
}

// Pulls the tool-call output out of a Claude message and shapes it
// into the result we want. Throws if Claude didn't call the tool or
// returned malformed workouts. Kept separate from generateTrainingPlan
// so the retry path can reuse the same parsing logic.
function parsePlanFromMessage(
  message: Anthropic.Message,
): PlanGenerationResult & { _raw: Anthropic.Message } {
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
    // The raw assistant message is attached so the retry path can replay
    // it back to Claude as conversational context. Stripped before
    // returning to public callers via stripRaw().
    _raw: message,
  };
}

// Single Claude call. The retry path adds follow-up messages and
// re-invokes the API; this helper keeps both attempts on the same
// param shape.
async function callClaudeOnce(
  args: GeneratePlanArgs,
  extraMessages: Anthropic.MessageParam[] = [],
): Promise<Anthropic.Message> {
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
      ...extraMessages,
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

  return await stream.finalMessage();
}

export async function generateTrainingPlan(
  args: GeneratePlanArgs,
): Promise<PlanGenerationResult> {
  // First attempt.
  const firstMessage = await callClaudeOnce(args);
  const firstResult = parsePlanFromMessage(firstMessage);

  const firstIssues = validateGeneratedPlan({
    workouts: firstResult.workouts,
    startDate: args.startDate,
    raceDate: args.race.date,
  });
  const firstErrors = errorsOnly(firstIssues);

  // Happy path: no errors. Log any soft warnings and return.
  if (firstErrors.length === 0) {
    logWarnings(firstIssues);
    return stripRaw(firstResult);
  }

  // Retry path: replay the assistant's previous tool call, then send a
  // tool_result pointing out what was wrong and asking Claude to
  // re-submit. Replaying the assistant turn means Claude sees its own
  // previous attempt as conversation context, which leads to targeted
  // fixes rather than starting from scratch.
  console.warn(
    "[generateTrainingPlan] validation failed on first attempt — retrying once. Issues:",
    firstErrors,
  );

  const priorToolUse = firstResult._raw.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === "submit_training_plan",
  );
  if (!priorToolUse) {
    throw new Error(
      "Internal: parsed plan from first attempt but tool_use block missing on retry.",
    );
  }

  const retryMessages: Anthropic.MessageParam[] = [
    // The assistant's prior turn, replayed verbatim so the tool_use_id
    // lines up with the tool_result below.
    { role: "assistant", content: firstResult._raw.content },
    // Our tool_result pointing out the failures.
    {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: priorToolUse.id,
          content: buildRetryMessage(firstIssues),
          is_error: true,
        },
      ],
    },
  ];

  const secondMessage = await callClaudeOnce(args, retryMessages);
  const secondResult = parsePlanFromMessage(secondMessage);

  const secondIssues = validateGeneratedPlan({
    workouts: secondResult.workouts,
    startDate: args.startDate,
    raceDate: args.race.date,
  });
  const secondErrors = errorsOnly(secondIssues);

  if (secondErrors.length > 0) {
    // Retry also failed. Surface a clear error — the action layer will
    // catch this and render the error screen with a Retry button.
    const codes = secondErrors.map((e) => e.code).join(", ");
    throw new Error(
      `Plan failed validation after retry (issues: ${codes}). See server logs for details.`,
    );
  }

  logWarnings(secondIssues);
  return stripRaw(secondResult);
}

// Strip the internal _raw field before returning to callers. Keeps the
// public PlanGenerationResult shape clean.
function stripRaw(
  result: PlanGenerationResult & { _raw?: Anthropic.Message },
): PlanGenerationResult {
  const { workouts, summary } = result;
  return { workouts, summary };
}

// Centralised warning logger so soft-validation issues end up in one
// recognisable place in server logs.
function logWarnings(
  issues: ReturnType<typeof validateGeneratedPlan>,
): void {
  const warnings = issues.filter((i) => i.severity === "warning");
  if (warnings.length === 0) return;
  console.warn(
    "[generateTrainingPlan] plan accepted with warnings:",
    warnings,
  );
}
