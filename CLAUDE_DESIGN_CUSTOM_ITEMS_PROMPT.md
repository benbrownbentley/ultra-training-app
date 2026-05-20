# Claude Design prompt — Add / remove custom items in any LOG section

Delta prompt to add to the existing Claude Design session. Updates the LOG
section of the workout drill-down page across all primary types so the user
can add or remove items beyond what Claude planned.

---

```
Update the workout drill-down page (/workout/[id]) LOG section across all
primary types to support custom items — adding exercises/segments the user
did but weren't planned, and removing planned items the user skipped or
substituted.

Same visual language as the previous passes: emerald-500 primary, Geist
Sans + Geist Mono, em-dash mono section labels with tracking-[0.2em],
topographic ridge motif on Running, barbell motif on Strength.

FOR ITEMIZED-LIST LOG VARIANTS (Strength, Physio, Mobility)

Each existing exercise/movement row gets a small "× remove" affordance
on the right side of the row:
- Subtle icon (Tabler `ti-x` or similar), not destructive red — use the
  muted secondary-text color
- Tapping it marks the row as "removed" with a strikethrough; doesn't
  immediately delete from the DOM
- Beside the strikethrough row, show a brief "Undo" link in mono
- Removed items remain visible (strikethrough, dimmed ~50% opacity) so
  the user can scan what was planned

At the bottom of the itemized list, add a new full-width affordance
button, distinct from the inline "+ Add set" inside expanded exercise rows:

- Strength: `+ Add exercise`
- Physio: `+ Add exercise`
- Mobility: `+ Add movement`

Tapping it opens an inline form below the list:

- Exercise/movement name — text input (with autocomplete from a known
  exercise list when possible)
- For Strength: three small numeric inputs side by side — sets, reps,
  weight (with unit suffix kg/lb based on user pref)
- For Physio: sets, reps, optional pain-level slider (1–10), small notes
  field
- For Mobility: duration OR reps, optional notes field
- Two buttons: "Save" (outline) and "Cancel" (text link)

After saving, the new item appears as a row in the list. Visually
distinguish user-added items so it's clear what came from Claude vs the
user:
- A small mono tag in the corner of the row: "USER"
- OR a different bullet/marker style on the left side of the row
- (Pick whichever is less visually noisy in dark mode)

The new row behaves like any other from there — can be removed,
expanded, edited.

FOR SINGLE-BLOCK LOG VARIANTS (Running, Cross-training)

These don't have an itemized list by default. At the bottom of the LOG
section, before the sticky action bar, add an affordance:

- Running: `+ Add segment` — captures unplanned additions (e.g., "did
  some sprints at the end"). Opens an inline form: segment description,
  duration, optional HR or pace.
- Cross-training: `+ Add activity` — captures a side activity outside
  the plan. Opens an inline form: activity name, duration, optional
  effort (1–10).

Saved segments/activities appear as a small "— ADDITIONS" sub-section
above the action bar.

DESIGN NOTES

- "+ Add" affordances use the outline button style but at a slightly
  smaller size than the primary "Mark done" CTA — discoverable but
  not visually competing with the primary action
- "× remove" icons are subtle: muted secondary-text color in both
  light and dark mode, never red. Tapping shows a brief Undo opportunity
  rather than confirming deletion
- User-added rows are visually distinct from Claude-planned rows. The
  goal: a user looking at their log a month later should be able to
  tell which exercises they swapped in
- Removed (strikethrough) rows stay in the layout — don't reflow the
  list when something is removed
- Mobile-first; touch targets generous enough for the gym (44pt min on
  remove icons, despite their visual subtlety — make the tap area
  larger than the icon)
- Dark mode required

STATES TO DESIGN (on the STRENGTH variant — densest example)

State A1 — DEFAULT (showing the new "+ Add exercise" affordance at idle,
all planned exercises shown normally)

State A2 — INLINE FORM OPEN (user tapped "+ Add exercise"; the inline
form is visible with empty fields, focused on the exercise name input)

State A3 — ONE CUSTOM EXERCISE ADDED (the form has been submitted; a
new row appears in the list with the "USER" tag visible, planned
exercises unchanged)

State A4 — ONE PLANNED EXERCISE REMOVED (one of Claude's planned
exercises is strikethrough/dimmed, "Undo" link visible briefly beside
it; rest of list unchanged)

DELIVERABLE

- 4 mobile frames for the STRENGTH variant (states A1–A4), light + dark
  each = 8 frames
- Show the same patterns extend to Physio / Mobility / Running /
  Cross-training as described in the spec, but don't generate separate
  frames for each — the strength frames are the canonical reference
```

---

## How to use this prompt

1. Continue your existing Claude Design session.
2. Paste the prompt above as a new message.
3. Expect 8 frames covering the four interaction states on the strength variant.
4. The same pattern applies across all primary types — once the strength frames
   are right, the others follow.

## Why this matters

This affordance turns Vert from a "follow my AI's plan" tool into a "do your
own thing within an AI-shaped scaffold" tool. For users with a physio
prescription, a coach-given preference, or a personal taste, this is the
release valve that prevents friction.

The persistent-preference path (telling Claude "I always prefer X to Y") is
deferred to v2 — for v1, users write a Journal note and Claude picks it up
on the next regeneration. The one-time swap path (this exercise, this
session) is what these affordances handle.
