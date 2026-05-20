# Claude Design prompt — Vert workout-type glossary

Paste this prompt into Claude Design. Designs the workout glossary landing
route and representative detail pages.

---

```
Design the workout-type glossary for Vert.

PURPOSE
A browseable reference for the workout types in the user's plan. Linked
from two places:
- Inline "Read more about tempo runs →" link in each workout drill-down's
  WHY section (deep-links to the specific entry)
- Sub-route in Profile under "— REFERENCE" group
The glossary covers workout types and subtypes only — not individual
exercises like squats or RDLs. Form questions for individual exercises
point users elsewhere.

LAYOUT
Mobile-first. Mobile (~390px wide) AND desktop (centered, max ~720px).
Full dark mode AND light mode. Same visual language as all previous
screens — emerald-500 primary, Geist Sans + Geist Mono, em-dash mono
section labels with tracking-[0.2em].

GLOSSARY LANDING (/profile/glossary)

Anatomy (top to bottom):
1. Header bar — back link top-left: "← Profile"
2. Section label: "— WORKOUT GLOSSARY"
3. Title: "Workout types"
4. Brief intro paragraph in body text:
   "Reference for the workout types in your plan. Tap any type for
   details on what it is, what it does for your body, and how to do
   it well."
5. Grouped list, each group with a mono uppercase header:

   "— RUNNING"
   - Easy / Recovery — "Conversational pace. The foundation of every plan."
   - Tempo — "Sustained effort just below threshold."
   - Threshold — "Sustained hard effort at lactate threshold."
   - Intervals (VO2) — "Short hard efforts above threshold."
   - Hills — "Uphill repeats for strength and vert."
   - Long Run — "The cornerstone of every training week."

   "— STRENGTH"
   - Upper Body — "Push, pull, and stabilize."
   - Lower Body — "Squats, deadlifts, lunges, calves."
   - Full Body — "Compound work that integrates both."

   "— CROSS-TRAINING"
   - Cycling — "Active recovery or volume substitute without the impact."
   - Swimming — "Recovery-grade aerobic work."
   - Hiking — "Training-grade time on feet at vert."
   - Rowing — "Full-body endurance, low-impact."

   "— MOBILITY"
   - Pre-Run Activation — "Wake up the muscles before a session."
   - Daily Mobility — "Joint mobility and range of motion."
   - Recovery Flow — "Light flowing movement to aid recovery."

6. Each entry is a tappable row:
   - Left: type name in Geist Sans, font-medium
   - Below the name: one-line description in dim body text
   - Right: small chevron icon (Tabler ti-chevron-right) in dim color
   - 0.5px divider between rows within a group
   - Larger gap between groups
7. Bottom tab bar (Profile tab active — glossary is under Profile)

GLOSSARY ENTRY DETAIL (/profile/glossary/[type])

A dedicated page per type. Anatomy:

1. Header bar — back link top-left: "← Glossary"
2. Section label: "— GLOSSARY · [TYPE]" e.g., "— GLOSSARY · TEMPO"
3. Title: workout type name in Geist Sans display size (~30px),
   font-medium, tight tracking
4. One-line sub-heading in body text, slightly muted
5. Key facts row (data-tile pattern, like workout drill-down):
   - For Running types: HR ZONE · TYPICAL DURATION · COMMON IN
   - For Strength types: TYPICAL DURATION · EXERCISES · SETS PER EXERCISE
   - For Cross-training: TYPICAL DURATION · EFFORT · HR ZONE
   - For Mobility: TYPICAL DURATION · WHEN
6. Content sections, each with an em-dash mono header:

   "— WHAT IT IS"
   - 2-3 short paragraphs in body text describing the workout type

   "— WHAT IT DOES"
   - 2-3 short paragraphs on the physiological purpose / training stimulus

   "— HOW TO EXECUTE IT WELL"
   - 2-3 short paragraphs on form, pacing, and execution

   "— COMMON MISTAKES" (optional callout)
   - Set off visually (subtle background tint, e.g., warm muted tone)
   - Bulleted list of 2-4 common mistakes

7. Optionally at the bottom: a small "— SEE ALSO" section linking to
   related entries (e.g., from Tempo, link to Threshold and Easy Run)
8. Bottom tab bar

STATES TO DESIGN

A. Glossary landing — the grouped list with all ~15 entries visible
B. Detail page: TEMPO RUN — representative running entry
C. Detail page: LOWER BODY STRENGTH — representative strength entry,
   validates the pattern across primary types

CONTENT TO USE

For State A (landing) — use the exact entry list above.

For State B (Tempo Run detail page):
- Title: Tempo Run
- Sub-heading: "Sustained effort just below threshold."
- Key facts:
  · HR ZONE — Z3
  · TYPICAL DURATION — 40–75 min
  · COMMON IN — Build phase
- "— WHAT IT IS":
  "A tempo run is a sustained, moderately hard effort run at a pace
  you can hold for about an hour. In heart rate terms, this sits in
  your Z3 zone — comfortably hard, not race pace. You should be able
  to speak in short sentences but not hold a conversation.

  Tempo work usually shows up once a week during the build phase of
  an ultra cycle, often as a continuous 30–60 minute effort sandwiched
  between a warm-up and cool-down, or as longer intervals (e.g., 4 × 8
  minutes at tempo with short recoveries)."

- "— WHAT IT DOES":
  "Tempo running trains your body to clear lactate at faster paces.
  By teaching your muscles to handle sustained effort just below
  threshold, you raise the pace at which lactate starts accumulating
  — your aerobic ceiling lifts.

  For an ultrarunner, this matters most in the back third of long
  climbs. The fitter your aerobic ceiling, the longer you can sustain
  uncomfortable efforts before your legs and lungs cap out."

- "— HOW TO EXECUTE IT WELL":
  "Start with a 15-minute easy warm-up. Settle into tempo effort
  gradually rather than spiking into it. Hold a consistent effort —
  slow your pace slightly on climbs, don't surge. Stay relaxed in the
  shoulders and hips; this is a hard effort but not a max effort.
  End with a 10-minute cool-down at easy pace."

- "— COMMON MISTAKES":
  · "Going too hard — tempo is sustainable for ~60 minutes, not a
    5K race effort"
  · "Surging on climbs and bombing descents — keep the effort even"
  · "Skipping the warm-up — tempo cold is asking for injury"
  · "Treating it as just a long easy run with a bit more effort —
    intensity matters"

- "— SEE ALSO": Threshold · Easy / Recovery

For State C (Lower Body Strength detail page):
- Title: Lower Body Strength
- Sub-heading: "Builds the muscular foundation for hills, descents, and
  back-third resilience."
- Key facts:
  · TYPICAL DURATION — 30–60 min
  · EXERCISES — 3–6
  · SETS PER EXERCISE — 2–4
- "— WHAT IT IS":
  "Lower body strength training targets the muscles that propel
  running and absorb impact: quads, glutes, hamstrings, and calves.
  Sessions typically include compound lifts (squats, deadlift variants,
  lunges) plus accessory work (calf raises, planks, single-leg
  exercises).

  For ultrarunners, a typical lower body session takes 30–60 minutes
  and is done 1–2 times per week, separated from hard runs by at
  least a day where possible."

- "— WHAT IT DOES":
  "Lower body strength carries you through the back third of long
  races, where quad fatigue often becomes the limiter. Stronger glutes
  and hamstrings reduce reliance on quads alone, improve running
  economy, and protect against common injuries (knee pain, hip
  imbalances, Achilles overload).

  Strength work also builds the eccentric capacity that downhill
  running requires. The forces absorbed during a long technical
  descent are far higher than during steady uphill effort."

- "— HOW TO EXECUTE IT WELL":
  "Lift heavy enough that the last 1–2 reps of each set are
  challenging — endurance athletes routinely underestimate how heavy
  strength training should be. Prioritize form over weight. Start
  with compound lifts (squats, deadlifts) when you're freshest; finish
  with accessory work (calf raises, single-leg work, core).

  Allow 48+ hours of recovery before another lower body session.
  Pair strength days with easy run days rather than quality run days."

- "— COMMON MISTAKES":
  · "Lifting too light — leave 1–2 reps in the tank, but the last
    reps should feel hard"
  · "Going to failure on every set — reduces recovery without adding stimulus"
  · "Doing strength immediately before a hard run"
  · "Skipping unilateral work — single-leg exercises matter for runners"

- "— SEE ALSO": Upper Body · Full Body

DESIGN NOTES

- Entry detail pages should feel like a richer, type-general version of
  the per-workout WHY section on the workout drill-down. The drill-down
  WHY personalizes ("you're in week 6, here's what THIS tempo run is
  doing"); the glossary contextualizes ("here's what tempo runs do
  in general")
- The "— COMMON MISTAKES" callout uses a subtle background tint
  (warm muted color, light amber or warm gray) to set it apart visually
  without alarming
- Body text in the WHAT IT IS / WHAT IT DOES / HOW TO sections is
  Geist Sans, comfortable line-height (1.6–1.7), generous paragraph
  spacing
- All numerals Geist Mono, tabular
- Em-dash mono section labels at tracking-[0.2em] everywhere
- Dark mode required for every state
- The Profile tab in the bottom nav remains active when on glossary
  (the glossary is under Profile)

DELIVERABLE

- State A (glossary landing with grouped list) — 4 frames
  (mobile + desktop × light + dark)
- State B (Tempo Run detail page) — 4 frames
- State C (Lower Body Strength detail page) — 4 frames

Total: 12 frames.

The other entries (Threshold, Intervals, Hills, Long Run, Upper Body,
Full Body, Cycling, Swimming, Hiking, Rowing, Pre-run Activation, Daily
Mobility, Recovery Flow) follow the same pattern as B and C. We'll
produce their content during implementation; the design pattern is
established by these two representative entries.
```

---

## How to use this prompt

1. Continue your Profile-tab Claude Design session (or start a new chat with
   the preamble + reference screenshots, per the pattern from earlier prompt files).
2. Paste the prompt above as a new message.
3. Expect ~12 frames covering the glossary landing + 2 representative entry
   detail pages.

## What to look for in the result

- Landing groups feel scannable; entries clearly route somewhere
- Detail pages read like a thoughtful coaching reference, not a dry textbook
- "— COMMON MISTAKES" callout is visually distinct without being alarming
- Body copy is comfortable to read (line height, paragraph spacing)
- The pattern obviously extends to the other 13 entries — we shouldn't have
  to redesign for each

## After this

Only **wizard polish** and the **landing / marketing page** remain in the
design pass. Once those are done, every screen Vert needs is designed and
the focus shifts to implementation.
