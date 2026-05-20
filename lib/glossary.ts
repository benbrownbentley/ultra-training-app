// Workout-type glossary registry. Pure content — no data layer. Two
// entries (tempo, lower-body) carry the full design copy; the rest ship
// as short placeholders that read as deliberate stubs rather than
// "coming soon" boilerplate.

export type GlossaryGroupId =
  | "running"
  | "strength"
  | "cross"
  | "mobility";

export interface GlossaryFact {
  label: string;
  value: string;
  unit?: string;
  primary?: boolean;
}

export interface GlossaryEntry {
  slug: string;
  group: GlossaryGroupId;
  // Eyebrow line under "GLOSSARY · …" on the detail page.
  eyebrow: string;
  // Card title — what people will recognise.
  title: string;
  // Tagline shown on the landing card + detail page.
  tagline: string;
  // Three small metric tiles up top.
  facts: GlossaryFact[];
  // Section paragraphs, in order: WHAT IT IS, WHAT IT DOES,
  // HOW TO EXECUTE IT WELL.
  whatItIs: string[];
  whatItDoes: string[];
  howToExecute: string[];
  commonMistakes: string[];
  // Slugs of related entries surfaced in the SEE ALSO section.
  seeAlso: string[];
}

export const GROUPS: Array<{ id: GlossaryGroupId; label: string }> = [
  { id: "running", label: "RUNNING" },
  { id: "strength", label: "STRENGTH" },
  { id: "cross", label: "CROSS-TRAINING" },
  { id: "mobility", label: "MOBILITY" },
];

// Compact placeholder so the stubs don't read as "missing data".
const STUB = (kind: string, focus: string) => ({
  whatItIs: [
    `${kind} sessions are ${focus.toLowerCase()}. Detail copy on this entry is still being written — the workout pattern itself is well-supported in the plan.`,
  ],
  whatItDoes: [
    "Builds the specific adaptation this slot is responsible for inside an 18-week ultra block. Detail copy still being written.",
  ],
  howToExecute: [
    "Follow the prescribed structure on your Today screen. Detail copy still being written.",
  ],
  commonMistakes: [
    "Skipping recovery between hard sessions.",
    "Cranking intensity instead of building consistency.",
  ],
});

export const ENTRIES: GlossaryEntry[] = [
  {
    slug: "easy-recovery",
    group: "running",
    eyebrow: "EASY / RECOVERY",
    title: "Easy / Recovery Run",
    tagline: "Conversational pace. The foundation of every plan.",
    facts: [
      { label: "HR ZONE", value: "Z1–Z2", primary: true },
      { label: "DURATION", value: "30–90", unit: "min" },
      { label: "COMMON IN", value: "Every phase" },
    ],
    seeAlso: ["tempo", "long-run"],
    ...STUB("Easy/recovery", "Low-intensity aerobic running"),
  },
  {
    slug: "tempo",
    group: "running",
    eyebrow: "TEMPO",
    title: "Tempo Run",
    tagline: "Sustained effort just below threshold.",
    facts: [
      { label: "HR ZONE", value: "Z3", primary: true },
      { label: "DURATION", value: "40–75", unit: "min" },
      { label: "COMMON IN", value: "Build" },
    ],
    whatItIs: [
      "A tempo run is a sustained, moderately hard effort run at a pace you can hold for about an hour. In heart rate terms, this sits in your Z3 zone — comfortably hard, not race pace. You should be able to speak in short sentences but not hold a conversation.",
      "Tempo work usually shows up once a week during the build phase of an ultra cycle, often as a continuous 30–60 minute effort sandwiched between a warm-up and cool-down, or as longer intervals (e.g., 4 × 8 minutes at tempo with short recoveries).",
    ],
    whatItDoes: [
      "Tempo running trains your body to clear lactate at faster paces. By teaching your muscles to handle sustained effort just below threshold, you raise the pace at which lactate starts accumulating — your aerobic ceiling lifts.",
      "For an ultrarunner, this matters most in the back third of long climbs. The fitter your aerobic ceiling, the longer you can sustain uncomfortable efforts before your legs and lungs cap out.",
    ],
    howToExecute: [
      "Start with a 15-minute easy warm-up. Settle into tempo effort gradually rather than spiking into it. Hold a consistent effort — slow your pace slightly on climbs, don't surge. Stay relaxed in the shoulders and hips; this is a hard effort but not a max effort. End with a 10-minute cool-down at easy pace.",
    ],
    commonMistakes: [
      "Going too hard — tempo is sustainable for ~60 minutes, not a 5K race effort.",
      "Surging on climbs and bombing descents — keep the effort even.",
      "Skipping the warm-up — tempo cold is asking for injury.",
      "Treating it as just a long easy run with a bit more effort — intensity matters.",
    ],
    seeAlso: ["threshold", "easy-recovery"],
  },
  {
    slug: "threshold",
    group: "running",
    eyebrow: "THRESHOLD",
    title: "Threshold",
    tagline: "Sustained hard effort at lactate threshold.",
    facts: [
      { label: "HR ZONE", value: "Z4", primary: true },
      { label: "DURATION", value: "30–60", unit: "min" },
      { label: "COMMON IN", value: "Build · Peak" },
    ],
    seeAlso: ["tempo", "intervals-vo2"],
    ...STUB("Threshold", "Sustained efforts right at lactate threshold"),
  },
  {
    slug: "intervals-vo2",
    group: "running",
    eyebrow: "INTERVALS · VO2",
    title: "Intervals (VO2)",
    tagline: "Short hard efforts above threshold.",
    facts: [
      { label: "HR ZONE", value: "Z4–Z5", primary: true },
      { label: "DURATION", value: "40–60", unit: "min" },
      { label: "COMMON IN", value: "Peak" },
    ],
    seeAlso: ["threshold", "hills"],
    ...STUB("VO2 interval", "Short repeated efforts above threshold"),
  },
  {
    slug: "hills",
    group: "running",
    eyebrow: "HILLS",
    title: "Hill Repeats",
    tagline: "Uphill repeats for strength and vert.",
    facts: [
      { label: "HR ZONE", value: "Z3–Z4", primary: true },
      { label: "DURATION", value: "45–90", unit: "min" },
      { label: "COMMON IN", value: "Build · Peak" },
    ],
    seeAlso: ["tempo", "long-run"],
    ...STUB("Hill repeat", "Sustained uphill efforts at strong aerobic effort"),
  },
  {
    slug: "long-run",
    group: "running",
    eyebrow: "LONG RUN",
    title: "Long Run",
    tagline: "The cornerstone of every training week.",
    facts: [
      { label: "HR ZONE", value: "Z1–Z2", primary: true },
      { label: "DURATION", value: "2–6", unit: "hr" },
      { label: "COMMON IN", value: "Every phase" },
    ],
    seeAlso: ["easy-recovery", "hills"],
    ...STUB("Long run", "Extended aerobic effort at conversational pace"),
  },
  {
    slug: "upper-body",
    group: "strength",
    eyebrow: "UPPER BODY",
    title: "Upper Body Strength",
    tagline: "Push, pull, and stabilize.",
    facts: [
      { label: "DURATION", value: "30–45", unit: "min", primary: true },
      { label: "MOVES", value: "4–6" },
      { label: "SETS", value: "2–4" },
    ],
    seeAlso: ["lower-body", "full-body"],
    ...STUB("Upper body strength", "Push, pull, and stabilizing patterns"),
  },
  {
    slug: "lower-body",
    group: "strength",
    eyebrow: "LOWER BODY",
    title: "Lower Body Strength",
    tagline:
      "Builds the muscular foundation for hills, descents, and back-third resilience.",
    facts: [
      { label: "DURATION", value: "30–60", unit: "min", primary: true },
      { label: "MOVES", value: "3–6" },
      { label: "SETS", value: "2–4" },
    ],
    whatItIs: [
      "Lower body strength training targets the muscles that propel running and absorb impact: quads, glutes, hamstrings, and calves. Sessions typically include compound lifts (squats, deadlift variants, lunges) plus accessory work (calf raises, planks, single-leg exercises).",
      "For ultrarunners, a typical lower body session takes 30–60 minutes and is done 1–2 times per week, separated from hard runs by at least a day where possible.",
    ],
    whatItDoes: [
      "Lower body strength carries you through the back third of long races, where quad fatigue often becomes the limiter. Stronger glutes and hamstrings reduce reliance on quads alone, improve running economy, and protect against common injuries (knee pain, hip imbalances, Achilles overload).",
      "Strength work also builds the eccentric capacity that downhill running requires. The forces absorbed during a long technical descent are far higher than during steady uphill effort.",
    ],
    howToExecute: [
      "Lift heavy enough that the last 1–2 reps of each set are challenging — endurance athletes routinely underestimate how heavy strength training should be. Prioritize form over weight. Start with compound lifts (squats, deadlifts) when you're freshest; finish with accessory work (calf raises, single-leg work, core).",
      "Allow 48+ hours of recovery before another lower body session. Pair strength days with easy run days rather than quality run days.",
    ],
    commonMistakes: [
      "Lifting too light — leave 1–2 reps in the tank, but the last reps should feel hard.",
      "Going to failure on every set — reduces recovery without adding stimulus.",
      "Doing strength immediately before a hard run.",
      "Skipping unilateral work — single-leg exercises matter for runners.",
    ],
    seeAlso: ["upper-body", "full-body"],
  },
  {
    slug: "full-body",
    group: "strength",
    eyebrow: "FULL BODY",
    title: "Full Body Strength",
    tagline: "Compound work that integrates both.",
    facts: [
      { label: "DURATION", value: "40–60", unit: "min", primary: true },
      { label: "MOVES", value: "5–8" },
      { label: "SETS", value: "2–4" },
    ],
    seeAlso: ["upper-body", "lower-body"],
    ...STUB("Full body strength", "Compound lifts that integrate both halves"),
  },
  {
    slug: "cycling",
    group: "cross",
    eyebrow: "CYCLING",
    title: "Cycling",
    tagline: "Active recovery or volume substitute without the impact.",
    facts: [
      { label: "HR ZONE", value: "Z1–Z3", primary: true },
      { label: "DURATION", value: "45–120", unit: "min" },
      { label: "COMMON IN", value: "Build" },
    ],
    seeAlso: ["swimming", "rowing"],
    ...STUB("Cycling", "Low-impact aerobic work, optional vert"),
  },
  {
    slug: "swimming",
    group: "cross",
    eyebrow: "SWIMMING",
    title: "Swimming",
    tagline: "Recovery-grade aerobic work.",
    facts: [
      { label: "HR ZONE", value: "Z1–Z2", primary: true },
      { label: "DURATION", value: "30–60", unit: "min" },
      { label: "COMMON IN", value: "Base · Peak" },
    ],
    seeAlso: ["cycling", "rowing"],
    ...STUB("Swimming", "Zero-impact recovery aerobic"),
  },
  {
    slug: "hiking",
    group: "cross",
    eyebrow: "HIKING",
    title: "Hiking",
    tagline: "Training-grade time on feet at vert.",
    facts: [
      { label: "DURATION", value: "2–6", unit: "hr", primary: true },
      { label: "VERT", value: "+400–1500", unit: "m" },
      { label: "COMMON IN", value: "Build · Peak" },
    ],
    seeAlso: ["long-run", "hills"],
    ...STUB("Hiking", "Extended low-intensity vert time-on-feet"),
  },
  {
    slug: "rowing",
    group: "cross",
    eyebrow: "ROWING",
    title: "Rowing",
    tagline: "Full-body endurance, low-impact.",
    facts: [
      { label: "DURATION", value: "20–45", unit: "min", primary: true },
      { label: "INTENSITY", value: "Steady" },
      { label: "COMMON IN", value: "Base" },
    ],
    seeAlso: ["cycling", "swimming"],
    ...STUB("Rowing", "Full-body steady aerobic, low impact"),
  },
  {
    slug: "pre-run-activation",
    group: "mobility",
    eyebrow: "PRE-RUN ACTIVATION",
    title: "Pre-Run Activation",
    tagline: "Wake up the muscles before a session.",
    facts: [
      { label: "DURATION", value: "5–10", unit: "min", primary: true },
      { label: "FOCUS", value: "Hips · Glutes" },
      { label: "COMMON IN", value: "Every session" },
    ],
    seeAlso: ["daily-mobility", "recovery-flow"],
    ...STUB("Pre-run activation", "Short routine to prime hips and glutes"),
  },
  {
    slug: "daily-mobility",
    group: "mobility",
    eyebrow: "DAILY MOBILITY",
    title: "Daily Mobility",
    tagline: "Joint mobility and range of motion.",
    facts: [
      { label: "DURATION", value: "10–15", unit: "min", primary: true },
      { label: "FOCUS", value: "Hips · Ankles" },
      { label: "COMMON IN", value: "Every phase" },
    ],
    seeAlso: ["pre-run-activation", "recovery-flow"],
    ...STUB("Daily mobility", "Range of motion across major joints"),
  },
  {
    slug: "recovery-flow",
    group: "mobility",
    eyebrow: "RECOVERY FLOW",
    title: "Recovery Flow",
    tagline: "Light flowing movement to aid recovery.",
    facts: [
      { label: "DURATION", value: "15–25", unit: "min", primary: true },
      { label: "FOCUS", value: "Full body" },
      { label: "COMMON IN", value: "Rest days" },
    ],
    seeAlso: ["daily-mobility", "pre-run-activation"],
    ...STUB("Recovery flow", "Light flowing movement to aid recovery"),
  },
];

export function findEntry(slug: string): GlossaryEntry | null {
  return ENTRIES.find((e) => e.slug === slug) ?? null;
}

export function entriesInGroup(group: GlossaryGroupId): GlossaryEntry[] {
  return ENTRIES.filter((e) => e.group === group);
}
