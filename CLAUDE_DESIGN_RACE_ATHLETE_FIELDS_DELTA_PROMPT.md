# Claude Design delta prompt — Race calendar + expanded Athlete profile

Paste this into your Profile-tab Claude Design session as a follow-up.
Updates the Race info sub-route to support an ABC race calendar (not a
single race), and expands the Athlete profile sub-route to include the
full v1 field list.

---

```
Update the Race info and Athlete profile sub-routes in the Profile tab.

CONTEXT
The Race info sub-route was designed for a single target race. Update
it to support a *race calendar* with ABC prioritization (standard ultra
periodization). The Athlete profile sub-route already exists but needs
its field set expanded to the full v1 spec.

UPDATED RACE INFO SUB-ROUTE (/profile/race)

Conceptually shifts from "your target race" to "your race calendar."
Most users will have one A race; some will have B and/or C races
scheduled around it.

Anatomy:
- Back link top-left: "← Profile"
- Section label: "— RACE CALENDAR"
- Title: "Your races"
- Below the title, a sorted list of races, A first then B then C:

  · A RACE card (most visually prominent — emerald-filled or strong
    emerald border):
    "— A · UTMB 2026"
    Date · Distance · Vert · Terrain summary
    "Edit" affordance routes to the per-race edit form
    Countdown below: "14 weeks · 101 days"

  · B RACE card (subtler treatment — outline, less emphasis):
    "— B · Squamish 50 Tune-Up"
    Date · Distance · Vert · Terrain
    "Edit" affordance

  · C RACE card (dimmest — outline with smaller treatment):
    "— C · Local 25K"
    Same data layout

  · "+ Add another race" affordance at the bottom — outline button

- Tapping any race card opens the per-race edit form (same form for
  all priorities; the priority selector is one of the fields)

PER-RACE EDIT FORM (new screen, opened by Edit or Add)

Anatomy:
- Back link: "← Race calendar"
- Section label: "— EDIT RACE" or "— ADD RACE"
- Form fields, grouped:

  "— PRIORITY"
  - Segmented control: [A] [B] [C]
  - Helper text per option:
    · A — "Primary target. Plan builds toward this."
    · B — "Tune-up. Raced hard, not peaked for."
    · C — "Training-grade. Used as a workout, no taper."

  "— RACE DETAILS"
  - Race name (text input)
  - Race date (date picker)
  - Distance (number + unit, respects user unit pref)
  - Elevation gain (number + unit)
  - Terrain (chip multi-select: trail, road, mountain, technical, mixed)

  "— RACE GOAL"
  - Target finish time (time input, optional)
  - Effort intent (segmented control):
    · For A/B: [Competitive] [Finish strong] [Just finish]
    · For C: [Training-grade] (locked since C races aren't peaked for)

  "— ADDITIONAL DETAILS" (collapsible, optional fields, dim helper text:
  "Nice-to-have — leave blank if you don't know")
  - Elevation loss (number + unit) — "Often different from gain on
    point-to-point courses"
  - Cutoff time (time input) — "Total cutoff, not intermediate"
  - Climate / temperature expectation (chips: hot, cold, altitude,
    temperate, varies)
  - Course profile (chips: point-to-point, loop, out-and-back, multi-stage)
  - Aid station support (chips: aid stations, self-supported, semi-supported)

- Action bar (sticky bottom on mobile):
  · Cancel link
  · "Save race" — emerald CTA
  · If editing an existing race: "Delete race" link, dim, on the far
    left of the action bar → confirmation modal

UPDATED ATHLETE PROFILE SUB-ROUTE (/profile/athlete)

Same form structure as before, but with the full v1 field set.

Anatomy:
- Back link: "← Profile"
- Section label: "— ATHLETE PROFILE"
- Title: "Your training context"
- Form fields, grouped (v1 must-haves prominent, nice-to-haves in a
  collapsible "Additional details" group):

  "— FITNESS BASELINE"
  - Self-rated fitness (1-5 scale, each rating shows a description
    on selection):
    1 — "Just starting out"
    2 — "Building base fitness"
    3 — "Consistent training"
    4 — "Trained, racing regularly"
    5 — "Highly trained, competitive"
  - Current weekly running volume (number + unit per user pref)
  - Current weekly running time (hours)
  - Longest run in the last month (distance + optional date)

  "— EXPERIENCE"
  - Years of running (number)
  - Years of ultra-specific training (number)
  - Number of ultras completed (chip selector: 0 / 1–3 / 4–10 / 10+)
  - Longest race ever completed (distance + optional date input)
  - Previous endurance experience (chip multi-select: First ultra,
    Multiple ultras, Marathon experience, Triathlon, Other endurance)

  "— BODY"
  - Age (number input)
  - Biological sex (segmented control: Male / Female / Other /
    Prefer not to say) — small helper text: "Optional. Relevant for
    plan personalization research."
  - Body weight (number + unit kg/lb) — small helper text: "Optional.
    Used for fueling recommendations."

  "— HEALTH"
  - Past injuries (multi-line freeform text)
  - Current injuries — read-only reference: "Active injury reports are
    managed in your Journal" with a link
  - Chronic conditions (multi-line freeform text, helper:
    "asthma, diabetes, heart conditions, etc. Used for safety, not
    optimization.")
  - Sleep average (chip selector: 5 / 6 / 7 / 8 / 9+ hours)
  - Stress baseline (1-5 slider, with helper labels: Low → High)

  "— SCHEDULE"
  - Weekly hours available for training (number)
  - Typical training days (chip multi-select: M Tu W Th F Sa Su)
  - Long run day preference (chip selector: Sat / Sun / Other)
  - Quality day preference (chip selector: Tue / Wed / Thu / Mixed)
  - Strength session frequency (chip selector: None / 1× / 2× / 3× per week)
  - Time of day preference (chip selector: Morning / Evening / No preference)
  - Job type (chip selector: Sedentary office / Standing / Physical / Shift work)

  "— EQUIPMENT & ACCESS"
  - Gym access (chip selector: Full / Limited / None)
  - Equipment available (chip multi-select: Treadmill, Indoor trainer,
    Weights, Pool, None)
  - Outdoor terrain access (chip multi-select: Trails nearby, Hills
    nearby, Mountains nearby, Flat only)

  "— CROSS-TRAINING PREFERENCES"
  - Multi-select chips: Cycling, Swimming, Hiking, Rowing, None

  "— ADDITIONAL DETAILS" (collapsible by default — opens on tap)
  - Max HR (number input) — helper: "From a watch or test. Used for
    zone calculation."
  - Resting HR (number input) — helper: "Wake-up HR before getting out
    of bed. Fitness indicator."
  - Lactate threshold HR (number input) — helper: "If you've done a
    threshold test."
  - VO2max estimate (number input) — helper: "From a watch or test."
  - Recent race results (repeatable: date + distance + time + notes,
    up to 3 entries with `+ Add another` link)

  "— TRAINING PREFERENCES" (the freeform notes section, v1 home for
  "prefer X to Y")
  - Freeform multi-line textarea
  - Placeholder: "Anything Claude should consider about how you like
    to train? e.g., 'I prefer split squats to walking lunges', 'I hate
    treadmill runs', 'Long runs always on Saturday morning'."
  - Helper text below: "In a future update this will become structured
    swap rules. For now, freeform works fine."

- Action bar (sticky bottom on mobile):
  · Cancel link
  · "Save changes" emerald CTA

STATES TO DESIGN

For the RACE CALENDAR (race info sub-route):
- State A — race calendar default (one A race + one B race + one C race
  listed with the priority hierarchy visible)
- State B — per-race edit form, default empty state for a new race
- State C — per-race edit form, populated with the A race's values
  (showing the "Additional details" collapsed group)
- State D — per-race edit form with "Additional details" expanded
- State E — delete race confirmation modal

For the ATHLETE PROFILE sub-route:
- State F — athlete profile default, populated, with the "Additional
  details" group collapsed
- State G — athlete profile with "Additional details" expanded

CONTENT TO USE (realistic for UTMB 2026 + Ben's training context)

Race calendar (State A):
- A: UTMB 2026 · 26 Aug 2026 · 171.5 km · +10,040m · Trail + Mountain
- B: Squamish 50 Tune-Up · 12 Jul 2026 · 80.4 km · +3,100m · Trail
- C: Diez Vista 50K · 5 Apr 2026 · 50 km · +2,000m · Trail

(Note: C race is in the past for "current" context, so could be omitted
or shown as a completed race. Use editorial judgment — design State A
showing 2 future races plus 1 historical/completed race, OR just show
A + B if cleaner.)

Athlete profile (States F & G) — pre-populated with Ben's training
context (carry forward from the previous athlete profile state):
- Fitness 4/5
- 65 km/week, 6 hours/week
- Longest recent run: 32 km
- 12 years running, 5 years ultras
- Ultras: 4–10
- Longest race: Cascade Crest 100
- Previous experience: Multiple ultras + Marathon
- Age: ~35–40 (use realistic)
- Sex: Male (or Prefer not to say to show that option in context)
- Weight: 70 kg
- Past injuries: "Right achilles tendinopathy 2024 (recovered with PT).
  Occasional left ITB tightness."
- Sleep: 7 / Stress: 3
- Schedule: M-Sat days · Long run Sat · Quality Tue · Strength 2×
- Equipment: Full gym, Weights + Pool + Trails nearby + Hills nearby
- Cross-training: Cycling + Hiking
- Additional details (for State G): Max HR 178, Resting HR 48, LT HR
  162, VO2max 58
- Training preferences: "Long runs on Saturday morning. I prefer split
  squats to walking lunges. Avoid treadmill if possible."

DESIGN NOTES

- A/B/C race priority should be visually obvious — A race gets the most
  visual weight (emerald-filled or strong border), B is a step down,
  C is the dimmest
- The "Additional details" collapsible group keeps the athlete profile
  form from being overwhelming on first arrival — must-haves visible,
  nice-to-haves one tap away
- Chip multi-select and segmented controls are visually consistent
  across the app (match the journal injury-report chip pattern)
- Helper text under optional fields is in a dim secondary-text color,
  small (~12px in mono or Geist Sans)
- All numerals Geist Mono, tabular
- Em-dash mono section labels at tracking-[0.2em] everywhere
- Dark mode required for every state

DELIVERABLE

Race calendar:
- State A (calendar view with A/B/C) — 4 frames (mobile + desktop ×
  light + dark)
- State B (per-race edit, empty) — 2 frames (mobile, light + dark)
- State C (per-race edit, populated, collapsed group) — 2 frames
- State D (per-race edit, populated, expanded group) — 2 frames
- State E (delete race confirmation) — 2 frames (mobile only,
  light + dark)
= 12 race-flow frames

Athlete profile:
- State F (populated, collapsed group) — 4 frames (mobile + desktop ×
  light + dark)
- State G (populated, expanded group) — 4 frames
= 8 athlete-profile frames

TOTAL: 20 frames.
```

---

## How to use this prompt

1. Paste into your existing Profile-tab Claude Design session.
2. Expect ~20 frames covering the updated Race calendar with ABC and
   the expanded Athlete profile with collapsible "Additional details."

## What to look for in the result

- A race card visually dominates B and C — priority is obvious at a glance
- The per-race edit form scales gracefully whether the user fills in
  must-haves only or also opens the "Additional details" group
- Athlete profile feels approachable on first arrival (just must-have
  groups visible), expands to richer with one tap
- Helper text under optional fields is friendly and reduces commitment
  anxiety ("Optional. Used for...")
- Biological sex is unambiguously optional and respectful in its options
- The Training preferences textarea placeholder gives concrete examples
  the user can model

## Wizard alignment

The wizard captures only the v1 must-have fields from this spec. The
wizard's final step should include a note: "Want a more personalized plan?
Add training context, body details, and recent results in your Profile
once you're set up."

The wizard polish pass (coming after Profile is locked in) will reflect
this constraint and the must-haves-only field set.
