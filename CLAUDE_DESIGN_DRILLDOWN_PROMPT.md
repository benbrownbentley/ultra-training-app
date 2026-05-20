# Claude Design prompt — Vert workout drill-down / log page (/workout/[id])

Paste this prompt into Claude Design once the Today screen pass is locked in. The
design system, auth aesthetic, and Today-screen design language should already be
in scope from previous turns in the design canvas.

---

```
Design the workout drill-down / log page for Vert (route: /workout/[id]).

PURPOSE
The detail page for any workout — where users land when they tap any card on
Today. Hosts the full planned details, Claude's "why this workout" explanation
specific to this user's plan, and the inline logging interface for actuals.
Second-most-used screen after Today.

LAYOUT
Mobile-first. Mobile (~390px wide, single column) AND desktop (centered, max
~720px). Full dark mode AND light mode for each. Inherit the visual language
from the Today screen — emerald-500 primary, Geist Sans + Geist Mono, em-dash
mono section labels with tracking-[0.2em], topographic ridge motif on Running
cards, barbell silhouette motif on Strength cards.

ANATOMY (top to bottom)

1. Header bar
   - "← Today" back link top-left in Geist Mono uppercase, tracking-[0.12em]
   - Settings cog top-right
   - Header section label below the bar:
     "— TUE 17 MAY · WEEK 6 OF 18 · BUILD"

2. Title block
   - Workout title in Geist Sans, font-medium, tracking-[-0.02em], large
     (~30px on mobile)
   - One-line description below in Geist Sans body weight, slightly muted
     (e.g., "Sustained effort just below threshold.")
   - Subtle topographic motif (from components/auth/topo-background.tsx)
     anchors the trail/run feel — low opacity, behind the title

3. Key metrics row (data-tile pattern)
   - 4–5 metric tiles in Geist Mono, tabular numerals
   - Each tile: LABEL (mono uppercase, wide tracking, dim) / VALUE (mono,
     large, font-medium) / unit (small, dimmer)
   - For Running: HR ZONE · DURATION · DISTANCE · VERT · TERRAIN
   - Horizontal row on mobile (compact tiles); wider tiles on desktop

4. "— STRUCTURE" section
   - The workout broken into segments, each segment a row
   - Each row: segment name · duration · zone · brief note
   - For the tempo example:
     · Warm-up · 15 min · Z1–Z2 · easy, by feel
     · Main · 4 × (8 min @ Z3 / 2 min jog) · sustained tempo effort
     · Cool-down · 10 min · Z1 · easy

5. "— WHY" section
   - 3–4 sentence paragraph in Geist Sans body
   - Slightly larger or italicized to differentiate from list/metric text
   - Specific to THIS user's plan in THIS week, not generic
   - Body copy treatment, comfortable line-height

6. Glossary link
   - One-line in emerald link style: "Read more about tempo runs →"
   - Routes to the workout-type glossary entry

7. "— LOG" section (the inline logging interface)
   - For RUNNING (and most cardio):
     · Duration: input field, mm:ss or hh:mm:ss, pre-filled with planned
     · Distance: numeric input, pre-filled with planned distance, unit suffix
     · Vert: numeric input (visible only when terrain = trail), pre-filled
     · Avg HR: numeric input — REQUIRED
     · "+ Add time-in-zone breakdown" — expandable; reveals Z1/Z2/Z3/Z4/Z5
       minute inputs. Optional.
   - For STRENGTH (Option D — collapsible exercise rows):
     · Each exercise as a row, collapsed by default
     · Collapsed row format: "Squat · 4×6 · 60kg · [Done?]"
       Tap "Done?" to mark the whole exercise complete at planned values
     · Tap the row body to expand. Expanded shows each set as its own row
       with editable reps and weight, plus an individual done state per set
     · Expanded row includes "+ Add set" affordance for going beyond planned
     · The exercise's collapsed/expanded state is local to the user's
       interaction; if any set has overrides, they're stored
   - For PHYSIO:
     · Each prescribed exercise as a row
     · Each row has: exercise name, completed checkbox, pain-level slider
       (1–10), small notes field
   - For CROSS-TRAINING:
     · Duration input, perceived effort (1–10 or Z scale dropdown),
       optional HR
   - For MOBILITY:
     · Single "Done" toggle, optional duration

8. "— NOTES" section
   - Freeform text input: "How did it feel?"
   - Auto-saves; will be consumed by the next regeneration as context
   - Visible from State A onward; persists in subsequent states

9. Log actions
   - Sticky bottom on mobile, inline on desktop
   - Primary: "Mark done" — emerald CTA with soft glow shadow, trailing
     ArrowRight, h-11
   - Secondary: "Mark skipped" — outline, h-11

STATES TO DESIGN (5 total)

State A — UPCOMING / TODAY, NOT YET LOGGED (default)
- Full page visible
- LOG section ready to accept input, planned values pre-filled
- Log actions active

State B — LOGGED-DONE
- Small "— LOGGED" badge near the title or in the header section label
- Done timestamp ("Logged Tue 17 May, 6:42 PM")
- LOG section shows actuals with planned values dimmed alongside
  (e.g., "Duration: 62 min · target 60")
- For Running: avg HR shown; time-in-zone breakdown if it was entered
- Sticky-bottom actions: "Edit log" link in place of "Mark done"

State C — LOGGED-SKIPPED
- "— SKIPPED" banner near the top
- If reason was provided: shows it below the banner
- LOG section collapsed or hidden
- "Log retrospectively" affordance to convert to a logged-done state

State D — MISSED IN THE PAST
- Slightly desaturated visual state — past day, never logged
- "— MISSED · You can still log this" banner
- Primary CTA changes to "Log retrospectively"
- All other sections visible and editable

State E — FUTURE WORKOUT (read-only)
- Workout 3+ days from now
- All informational sections visible (planned, structure, why)
- LOG section visible but disabled, with a placeholder:
  "— LOG · Available on the day"
- Log actions disabled or replaced with a single "Save to bookmarks"
  affordance (optional)

CONTENT TO USE (realistic ultrarunner training for UTMB 2026)

Athlete is 18 weeks out from UTMB 2026, currently in BUILD phase, week 6 of 18.
Today: Tue 17 May 2026.

Primary example — RUNNING variant (use this for all 5 states):

- Title: Tempo Run
- Description: "Sustained effort just below threshold."
- Metrics:
  · HR ZONE — Z3–Z4
  · DURATION — 60 min
  · DISTANCE — 12 km
  · VERT — +220m
  · TERRAIN — Trail
- Structure:
  · Warm-up · 15 min · Z1–Z2 · easy, by feel
  · Main · 4 × (8 min @ Z3 / 2 min jog) · sustained tempo
  · Cool-down · 10 min · Z1 · easy
- Why (sample Claude output): "You're in week 6 of an 18-week block — the build
  phase is where weekly volume climbs and tempo work introduces the body to
  sustained discomfort. Today's session sits just below your lactate threshold,
  training your body to clear lactate at faster paces. By race day, this work
  pays off on the back third of long climbs, when your aerobic ceiling decides
  everything."
- Glossary link: "Read more about tempo runs →"

For State B (logged-done) — actuals:
- Duration: 62 min (target 60)
- Distance: 11.8 km (target 12)
- Vert: +245m (target +220)
- Avg HR: 158
- Time-in-zone: Z3 42 min · Z4 18 min · target Z3–Z4 60 min
- Notes: "Felt strong on the climbs, second half slightly slower."

Additional example — STRENGTH variant (also include this; show both collapsed
and expanded LOG section, in both planned and logged-done states):

- Title: Strength A
- Description: "Lower-body posterior chain. Supports your hill work."
- Metrics: DURATION ~45 min · EXERCISES 5 · FOCUS Lower
- Structure / planned exercises (these populate the LOG section):
  · Squat · 4×6 · 60kg
  · Romanian Deadlift · 3×8 · 50kg
  · Walking Lunge · 3×8 per leg · 20kg DBs
  · Calf Raise · 3×12 · 30kg
  · Plank · 3×60s · bodyweight
- Why (sample): "Lower-body strength carries you through the back third of
  UTMB, where quads are the limiter. Today's session targets the posterior
  chain (glutes, hamstrings) — the muscles that take over when quads fade."

For STRENGTH State B (logged-done, with set-level overrides):
- Squat: 4×6 @ 60kg (all sets done at planned values — collapsed shows
  "Done at planned")
- RDL: expanded view; set 1 @ 8×50, set 2 @ 8×50, set 3 @ 7×50 (one rep
  short on the last set)
- Walking Lunge: collapsed, done at planned
- Calf Raise: collapsed, done at planned + 1 extra set added
- Plank: collapsed, done at planned

Additional example — CROSS-TRAINING variant (validates the simplified LOG):

- Title: Easy Spin
- Subtype label: "— CROSS-TRAINING · CYCLING"
- Description: "Active recovery on the bike. Spin the legs, no pressure."
- Metrics: DURATION ~45 min · EFFORT Easy · HR Z1–Z2 (optional)
- Structure: single block — "45 min · Z1–Z2 · conversational cadence"
- Why (sample): "Yesterday's tempo loaded your legs. Today is about
  circulation, not training stimulus. Keep the cadence high and the
  effort low — if you can't hold a conversation, you're going too hard."
- LOG fields: duration, perceived effort (1–10), optional avg HR
- For State B: actual duration 48 min, RPE 3, avg HR 124

Additional example — MOBILITY variant (validates the minimal LOG):

- Title: Daily Mobility
- Subtype label: "— MOBILITY · DAILY"
- Description: "Joint mobility and activation. 10 minutes, anywhere."
- Metrics: DURATION ~10 min · FOCUS Hips & ankles
- Structure: routine listed as a checklist (4–6 movements with reps/time)
  · World's greatest stretch · 2 × 5/side
  · 90/90 hip switches · 2 × 8
  · Ankle rocks · 2 × 10/side
  · Cossack squats · 2 × 6/side
  · Couch stretch · 60s/side
- Why: short — "Hip and ankle mobility is the single best injury
  prevention investment for an ultrarunner. 10 minutes a day pays for
  itself in week-12 of a build cycle."
- LOG fields: single "Done" toggle, optional actual duration

DESIGN NOTES

- All numerals in Geist Mono, tabular
- Every section label uses em-dash mono uppercase with tracking-[0.2em]
- The background motif (topo for Running, barbell for Strength) used on the
  Today card flows into the drill-down's title block as visual continuity —
  same motif, same opacity, larger scale on the detail page
- LOG section feels like a working tool, not a form. Touch-friendly inputs,
  defaults pre-populated with planned values, edits feel reversible
- Sticky bottom action bar on mobile must not occlude the last visible
  content row when the keyboard is open — design for both
- Dark mode required for every state and every variant
- Avoid: purple gradients, Inter typeface, hover-heavy micro-interactions,
  web-only patterns (the app migrates to React Native in v3)

DELIVERABLE

For the RUNNING variant:
- All 5 states (A–E)
- Each state × mobile + desktop × light + dark = 4 frames per state
- 5 × 4 = 20 frames

For the STRENGTH variant (validate Option D in pixels):
- State A (default — collapsed exercise rows)
- State A (same, with one exercise expanded showing the set-level UI)
- State B (logged-done with the mix of collapsed and expanded states above)
- Each × mobile + light + dark = 6 additional frames

For the PHYSIO variant (validate the pain-slider UI):
- State A (default — exercises with pain sliders, mobile only, light + dark)
- 2 frames

For the CROSS-TRAINING variant (validate the simplified LOG):
- State A (default — cycling example with duration / RPE / optional HR,
  mobile only, light + dark)
- 2 frames

For the MOBILITY variant (validate the minimal LOG):
- State A (default — daily mobility checklist with single "Done" toggle,
  mobile only, light + dark)
- 2 frames

Total: ~32 frames. Group by variant and state for side-by-side scanning.
```

---

## How to use this prompt

1. Continue from your Today-screen design session in claude.ai/design. The system
   should already be in scope from the Today pass.
2. Paste the prompt above as a new message in the design canvas.
3. Let Claude Design generate. Expect ~28 frames.
4. Review against the canary checklist below. Iterate with surgical follow-ups.

## What to look for in the result

- Same emerald-500 / Geist Sans + Mono / em-dash mono labels / topo motif system
  as the Today screen
- LOG section feels usable in the gym (large tap targets, clear defaults, fast
  to confirm)
- Option D for strength: collapsed row is one-tap to mark done; expanded row is
  visibly more powerful but never confusing
- "— WHY" feels like a coach speaking to this specific athlete in this specific
  week — not generic copy
- Planned vs. actual in State B is comprehensible at a glance (e.g., the
  difference between target 60 min and actual 62 min is obvious without
  squinting)
- Future workout (State E) feels read-only without feeling broken or empty

## If the LOG section feels chaotic inline

The architecture decision was: try inline first, fall back to a separate log
step if it's too cramped. If Claude Design's output for State A on mobile feels
overcrowded, ask it to redraw with the LOG section on a separate sub-route
(`/workout/[id]/log`) accessed via a prominent "Log this workout" CTA on the
detail page. We can iterate from there.

## Next screens after this one

Once the drill-down/log page is locked in, the next screens in order are:

1. **Regeneration result / diff** — the differentiating moment of the product;
   the screen that proves "adaptive" isn't a black box
2. **Plan tab** — the zoom-out view of the full training block
3. **Journal tab** — unified surface for notes / injuries / physio / observations
4. **Profile tab** — settings, account, athlete profile, race info, edit setup,
   glossary sub-route
5. **Wizard polish** — the existing intake wizard brought into the new design system
6. **Landing / marketing page** — for v2 public launch
