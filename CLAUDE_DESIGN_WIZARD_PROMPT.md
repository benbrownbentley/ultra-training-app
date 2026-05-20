# Claude Design prompt — Vert intake wizard

Paste this prompt into Claude Design. Designs the first-time-setup wizard
that captures v1 must-have fields and ends with first plan generation,
transitioning the user to the Today screen.

---

```
Design the intake wizard for Vert.

PURPOSE
First-time setup. Captures v1 must-have fields, generates the user's first
plan via Claude API, then transitions them to the Today screen. Strictly
first-time only — not surfaced from any tab post-setup.

LAYOUT
Mobile-first. Mobile (~390px wide) AND desktop (centered, max ~480px —
narrower than other screens since this is a focused form flow).
Full dark mode AND light mode. Same visual language as all previous
screens — emerald-500 primary, Geist Sans + Geist Mono, em-dash mono
section labels with tracking-[0.2em], topographic ridge motif.

WIZARD STRUCTURE (12 SCREENS)

0 — Welcome
1 — Your A race (details)
2 — Your race goal
3 — Other races coming up? (optional, skip-able)
4 — Your fitness right now
5 — Your experience
6 — About you
7 — Health
8 — Your schedule
9 — Equipment & cross-training
10 — Generating plan (atmospheric loading)
11 — You're all set (brief welcome, transitions to Today)

COMMON CHROME (steps 1–9, input steps)

- Top: thin progress bar (~3px tall, emerald-500 fill on a thin
  divider track) showing progress through the 9 input steps
  (Welcome and Generating don't count toward progress)
- Just below the progress bar: small mono label "STEP [N] OF 9"
- Section label below: "— [STEP TITLE]" in mono uppercase
- Page title in Geist Sans display weight, ~30px on mobile, font-medium,
  tight tracking
- Form fields below, vertically stacked
- Sticky bottom action bar:
  · "← Back" link on the left (dim, mono)
  · "Continue →" emerald CTA on the right with trailing ArrowRight
  · On step 9, the CTA changes to "Generate my plan →"
- "Save & exit" link in the top-right of every input step (a small
  dim mono link that saves progress and returns the user to wherever
  they were)
- Progress is auto-saved to localStorage on every field change so users
  can resume mid-wizard

STEP 0 — WELCOME

- Full-screen, no progress bar yet
- TopoBackground motif at low opacity behind
- VERT logo centered
- Title: "Let's build your plan."
- Body text in Geist Sans:
  "We'll ask about your target race, your fitness, and how you like
  to train. About two minutes."
- CTA at the bottom: "Get started →" emerald CTA, full-width on mobile

STEP 1 — YOUR A RACE (DETAILS)

- Section label: "— YOUR A RACE"
- Title: "What are you training for?"
- Helper: "Your primary target race — the one this plan builds toward.
  You can add B and C tune-up races on the next step or later in your
  Profile."
- Fields:
  · Race name (text input)
  · Race date (date picker)
  · Distance (number input + unit suffix per user units pref,
    defaulting to metric on first run with a way to change at any
    distance-input field via a "use mi?" link if needed — actually
    leave the units choice for the Preferences step or default
    metric and let user change in Profile after)
  · Elevation gain (number input + unit suffix)
  · Terrain (chip multi-select: trail, road, mountain, technical, mixed)
- Continue requires: name, date, distance, terrain (elevation optional
  but encouraged)

STEP 2 — YOUR RACE GOAL

- Section label: "— YOUR GOAL"
- Title: "What's the plan for this one?"
- Fields:
  · Target finish time (time input, OPTIONAL)
    Helper: "Optional — courses vary too much for tight predictions."
  · Effort intent (segmented control): [Competitive] [Finish strong]
    [Just finish]
    Helper text under each option that appears on selection:
    · Competitive: "Race to win or place. High intensity."
    · Finish strong: "Race for a strong personal effort."
    · Just finish: "Get to the finish line, enjoy the day."

STEP 3 — OTHER RACES COMING UP? (OPTIONAL)

- Section label: "— OTHER RACES · OPTIONAL"
- Title: "Got more races on your calendar?"
- Body text: "B races are tune-ups you race hard but don't peak for.
  C races are training-grade efforts. Add any if you have them, or
  skip — you can always add them later."
- Below, a list area starting empty with an "+ Add a race" affordance.
- Tapping "+ Add a race" expands an inline form:
  · Priority — segmented control [B] [C] (no A here, A is captured
    on step 1)
  · Race name
  · Race date
  · Distance + unit
  · Elevation gain + unit (optional)
  · Terrain chips (optional)
  · "Save race" emerald CTA + "Cancel" link
- After saving, the race appears as a compact card in the list and
  another "+ Add another" affordance becomes available
- Action bar at bottom of this step:
  · "← Back" link (left)
  · "Skip for now →" link in dim color (middle-left)
  · "Continue →" emerald CTA (right) — same CTA whether or not races
    were added; "Skip for now" just means continue without adding

STEP 4 — YOUR FITNESS RIGHT NOW

- Section label: "— FITNESS"
- Title: "Where are you starting from?"
- Fields:
  · Self-rated fitness — 1–5 chip selector with description that
    appears on selection (Just starting out / Building base /
    Consistent training / Trained, racing regularly / Highly trained,
    competitive)
  · Current weekly volume (number + unit per user pref)
  · Current weekly time (hours)
  · Longest run in the last month — distance input + date picker

STEP 5 — YOUR EXPERIENCE

- Section label: "— EXPERIENCE"
- Title: "What have you done?"
- Fields:
  · Years of running (number)
  · Years of ultra-specific training (number)
  · Ultras completed — chip selector [0] [1–3] [4–10] [10+]
  · Longest race ever — distance + unit (no per-field unit toggle,
    inherits from global units pref), optional name, optional date

STEP 6 — ABOUT YOU

- Section label: "— ABOUT YOU"
- Title: "A few details about you."
- Helper text: "All optional except age. Used for plan personalization
  and fueling recommendations."
- Fields:
  · Age (number, required)
  · Biological sex (segmented control): [Male] [Female] [Other]
    [Prefer not to say] — OPTIONAL
  · Body weight (number + unit per user pref) — OPTIONAL
    Helper: "Used for fueling recommendations."

STEP 7 — HEALTH

- Section label: "— HEALTH"
- Title: "Anything we should know?"
- Fields:
  · Past injuries — multi-line textarea
    Helper: "Brief notes on past injuries so Claude knows what areas
    have been vulnerable."
  · Chronic conditions — multi-line textarea
    Helper: "Asthma, diabetes, heart conditions, etc. Used for safety,
    not optimization."
  · Sleep average — chip selector [5] [6] [7] [8] [9+] hours
  · Stress baseline — 1–5 slider with Low → High helper labels

STEP 8 — YOUR SCHEDULE

- Section label: "— SCHEDULE"
- Title: "When do you train?"
- Fields:
  · Weekly hours available (number)
  · Typical training days — chip multi-select [M] [Tu] [W] [Th] [F] [Sa] [Su]
  · Long run day preference — chip selector [Sat] [Sun] [Other]
  · Quality day preference — chip selector [Tue] [Wed] [Thu] [Mixed]
    Helper: "Your hardest workout of the week — tempo, threshold,
    intervals, or hills."
  · Strength session frequency — chip selector [None] [1×] [2×] [3×] per week

STEP 9 — EQUIPMENT & CROSS-TRAINING

- Section label: "— EQUIPMENT"
- Title: "What do you have access to?"
- Fields:
  · Gym access — chip selector [Full] [Limited] [None]
  · Equipment available — chip multi-select [Treadmill] [Indoor trainer]
    [Weights] [Pool] [None]
  · Outdoor terrain access — chip multi-select [Trails nearby]
    [Hills nearby] [Mountains nearby] [Flat only]
  · Cross-training preferences — chip multi-select [Cycling] [Swimming]
    [Hiking] [Rowing] [None]

- AT THE BOTTOM OF THIS STEP, before the action bar, a small note:
  "Tip: After your plan is generated, you can add more detail (HR
  thresholds, recent race results, training preferences) in your
  Profile for a more personalized plan."

- The "Continue →" CTA on this step becomes "Generate my plan →"

STEP 10 — GENERATING PLAN

- Full-screen, atmospheric (same pattern as Regenerate sheet's
  generating state)
- TopoBackground motif at low opacity
- Centered: "— BUILDING YOUR PLAN"
- Rotating mono status lines below, one at a time fading in/out:
  · "Reading your inputs…"
  · "Mapping your training block…"
  · "Designing this week…"
  · "Setting up your weekly rhythm…"
  · "Almost there…"
- Subtle animated dot pattern (single element, no scattered animation)
- No back link, no actions — the user is committed
- Lasts 5–15 seconds typically; the actual Claude API call drives it

STEP 11 — YOU'RE ALL SET

- Full-screen, brief moment of confirmation before routing to Today
- TopoBackground motif at low opacity
- Centered: a subtle emerald checkmark animation (single flourish,
  not scattered)
- "— PLAN READY"
- Title: "You're all set."
- Body text in Geist Sans:
  "Tap Continue to see today's workout. Your plan adapts as you log
  workouts and add notes — visit Profile any time to add more detail."
- CTA: "See today's workout →" emerald CTA — routes to Today

STATES TO DESIGN

A — Step 0 (Welcome)
B — Step 1 (A race details, empty form)
C — Step 3 (Other races, empty state with the optional skip path)
D — Step 3 (Other races, one B race added showing the populated card)
E — Step 4 (Fitness, partial input)
F — Step 9 (Equipment, populated with the "Tip" note visible)
G — Step 10 (Generating plan loading state)
H — Step 11 (You're all set)

That's 8 representative states covering the welcome, a typical input
step, the optional-race step in both empty and filled states, an
input step with rich field types, the final input step with the tip,
the loading state, and the success state. The other steps (2, 5, 6,
7, 8) follow the same chrome and pattern.

DELIVERABLE

Each state × mobile + desktop × light + dark = 4 frames per state.
8 states × 4 = 32 frames.

If frame budget is tight, prioritize mobile light + dark for all 8
states (16 frames), then desktop where it materially differs.

DESIGN NOTES

- Progress bar is understated — emerald-500 fill on a thin track,
  ~3px tall. Not a dominant element.
- "STEP N OF 9" label is tiny mono, dim color, below the progress bar
- Each input step's title is the largest text on the screen and
  invites the user in conversationally
- Helper text under field labels is in dim secondary color, small
  (~12-13px), Geist Sans
- Sticky-bottom action bar handles keyboard appearance — content
  scrolls behind, action bar stays accessible
- The Welcome and Success screens have no progress bar or chrome —
  they're full-bleed moments
- All numerals Geist Mono, tabular
- Em-dash mono section labels at tracking-[0.2em] everywhere
- Dark mode required for every state
- The optional-races step (3) should visually feel optional —
  "Skip for now" should be findable and not feel like an escape from
  required work
```

---

## How to use this prompt

1. Continue your Claude Design session.
2. Paste the prompt above as a new message.
3. Expect ~32 frames (or ~16 if frame-budgeted to mobile only).

## What to look for in the result

- Welcome screen feels inviting, not officious
- Progress bar gives spatial sense without dominating the screen
- Each input step feels manageable — not too crowded
- The "Other races (optional)" step clearly communicates that skipping
  is fine — the skip option isn't buried
- The "Tip" at the bottom of step 9 reduces anxiety about commitment
  ("I don't need to nail this perfectly now")
- Generating screen feels like a moment of suspense, not loading-screen
  boredom
- Success screen transitions feel like the user has actually accomplished
  something

## After this

Only the **landing / marketing page** remains in the design pass. That's
v2 launch readiness work — when you're ready to think about public sign-ups.
