# Claude Design prompt — Vert Journal tab + input flows

Paste this prompt into Claude Design once previous screens are locked in.
Substantive pass — covers the Journal feed plus four input flows
(Note sheet, Injury route, Physio route, Travel sheet).

---

```
Design the Journal tab for Vert plus the input flows for each of its four
entry types.

PURPOSE
The unified surface where the user tells Claude things to consider —
feelings, travel plans, injury reports, physio prescriptions. Everything
the user wants Claude to know but isn't a logged workout lives here.
Feed view + filter chips + add flows. Each entry shows whether Claude
has consumed it in the last regeneration.

LAYOUT
Mobile-first. Mobile (~390px wide, single column) AND desktop (centered,
max ~720px). Full dark mode AND light mode. Same visual language as all
previous screens — emerald-500 primary, Geist Sans + Geist Mono, em-dash
mono section labels with tracking-[0.2em].

JOURNAL FEED (the tab itself)

Anatomy (top to bottom):
1. Header bar — settings cog top-right (no back link — tab destination)
2. Section label in mono: "— JOURNAL"
3. Filter chips row, horizontally scrollable on mobile:
   `All · Notes · Injuries · Physio · Travel`
   - Active chip has emerald background fill; inactive chips are outline
   - "All" is the default
4. `+ Add` button — full-width emerald outline, h-11, prominent
5. Vertical scroll of entry cards, newest first
6. Bottom tab bar (Journal active)

ENTRY CARD format (collapsed by default):
- Em-dash mono sub-label at top: "— [TYPE] · [DATE]"
  e.g., "— INJURY · 12 MAY", "— NOTE · 17 MAY", "— TRAVEL · 15 MAY",
  "— PHYSIO · 10 MAY"
- Title or first line of content in Geist Sans, font-medium
- Content snippet in body text (truncated to ~2 lines)
- Consumed indicator in the top-right corner of the card:
  · `✓` mono badge in emerald if Claude has used it in the most recent
    regeneration ("seen")
  · `○` mono badge in muted color if still pending
- Tapping the card expands it inline to show full content + edit/delete

EXPANDED ENTRY (after user taps a card):
- Card expands in place (doesn't navigate away)
- Full content visible (no truncation)
- Two affordances at the bottom of the expanded card:
  · `Edit` outline button — opens the type's input UI pre-filled
  · `Delete` text link, dim color
- Tap anywhere else on the card or the section label to collapse

DELETE CONFIRMATION:
- Tapping Delete opens a confirmation sheet/modal:
  "Delete this entry?"
  "Claude won't consider it in future regenerations."
  [Cancel] [Delete] (with Delete in destructive-red color, not the
  app's destructive token — this is a real destructive action)

THE FOUR ENTRY TYPES & THEIR INPUT FLOWS

After tapping `+ Add`, a small type-picker bottom sheet (mobile) or modal
(desktop) appears:
- Title: "— ADD TO JOURNAL"
- Four options as tappable rows, each with a Tabler icon + label + brief
  description:
  · "Note" — "A thought or observation for Claude"
  · "Injury" — "Report something hurting"
  · "Physio" — "Notes from your physio"
  · "Travel" — "Trips or events that affect training"
- Cancel link at bottom

Type 1 — NOTE (bottom sheet)

After picking Note from the type picker, open a quick-capture bottom sheet:
- Title: "— NEW NOTE"
- Single multiline textarea, ~6 rows tall on mobile, auto-focus
- Placeholder: "What should Claude consider? e.g., 'Feeling strong
  this week. Achilles slightly better in the mornings. Push the volume?'"
- Action bar: [Cancel] [Save] (Save is emerald CTA)
- After saving: sheet collapses, entry appears at top of journal feed,
  the next regeneration will consume it (toast: "Note saved · Claude
  will see it on the next regeneration")
- Optional: a secondary "Save & regenerate now" button that saves AND
  opens the Regenerate sheet

Type 2 — INJURY (full route at /journal/injury)

A dedicated screen for structured injury reporting.

Anatomy:
- Back link top-left: "← Journal"
- Section label: "— REPORT AN INJURY"
- Title in Geist Sans: "What's bothering you?"
- Form fields, vertically stacked:
  · Body part — chip selector or autocomplete (knee, ankle, achilles,
    hip, foot, calf, hamstring, quad, lower back, IT band, plantar fascia,
    other)
  · Side — chip selector (left, right, both, n/a)
  · Severity — slider 1–10 with mono number readout
  · Pain quality — chip multi-select (sharp, dull, ache, sting, throbbing,
    stiff, weak)
  · When did it start? — date picker
  · Restrictions — chip multi-select + freeform "other":
    (no running, no impact, no downhill, reduce volume, stretch only,
    rest completely, modify strength, other)
  · Notes — freeform text
  · Optional: "Check back in [N] days" — small number input
- Action bar (sticky bottom on mobile):
  · Cancel link (left)
  · "Save & regenerate plan" — emerald CTA (primary)
  · "Save only" — outline (secondary, doesn't trigger regeneration)
- After save: routes back to Journal feed with the injury at the top;
  if "Save & regenerate" was chosen, opens the Regenerate sheet with
  the new injury surfaced in context

Type 3 — PHYSIO (full route at /journal/physio)

Dedicated screen for physio prescription input.

Anatomy:
- Back link top-left: "← Journal"
- Section label: "— ADD PHYSIO NOTES"
- Title: "What did your physio say?"
- Form fields:
  · Physio name — optional text input
  · Date of visit — date picker, defaults to today
  · Diagnosis — text input
  · Restrictions — chip multi-select + freeform
  · Prescribed exercises — repeatable form section:
    · Exercise name (autocomplete or freeform)
    · Sets · Reps
    · Frequency (e.g., "3× per week")
    · `+ Add another exercise` link
  · Duration of program — number input + unit selector
    (weeks / until-symptoms-resolve)
  · Notes — freeform
- Action bar:
  · Cancel link
  · "Save & regenerate plan" — emerald CTA
  · "Save only" — outline

Type 4 — TRAVEL (bottom sheet)

Quick-capture sheet for travel and events.

Anatomy:
- Title: "— ADD TRAVEL OR EVENT"
- Form fields:
  · Start date — date picker
  · End date — date picker (defaults to start date for single-day events)
  · Description — text input ("e.g., Vancouver to SF for a wedding")
  · Training impact — chip selector + optional notes:
    (no running, light only, normal training, depends — see notes)
- Action bar: [Cancel] [Save] (Save is emerald CTA)
- After saving: sheet collapses, entry appears at top of Journal feed

EMPTY STATE

When the user has no entries:
- Centered message
- Topographic motif at low opacity behind
- Body text: "Tell Claude things to consider — recent feelings, travel
  plans, injury reports, or anything else that affects your training."
- Centered CTA: `+ Add your first entry` (emerald, the same +Add affordance)

STATES TO DESIGN

JOURNAL FEED:
A. Default — feed with mixed entries (Note, Injury, Travel, Physio all
   visible), "All" filter selected, some entries marked ✓ and some ○
B. Filtered — same data but "Injuries" filter selected; only injury
   entries visible
C. Empty — no entries; the empty-state design described above
D. Entry expanded — one entry tapped, expanded in-place showing full
   content + Edit/Delete affordances
E. Delete confirmation — the confirmation sheet/modal open

ADD FLOW:
F. Type-picker sheet — the 4 type options visible

INPUT FLOWS:
G. Note sheet — default empty state
H. Injury route — default empty state
I. Physio route — default empty state
J. Travel sheet — default empty state

CONTENT TO USE (realistic for UTMB 2026 context)

Sample journal entries for State A (mixed feed):
- "— NOTE · 17 MAY" / "Feeling strong this week. Achilles slightly better
  in the mornings. Push the volume?" / ○ pending
- "— TRAVEL · 15 MAY" / "Vancouver → SF, Fri 23 → Sun 25 May. Wedding
  weekend, no running Fri or Sun." / ✓ consumed
- "— INJURY · 12 MAY" / "Right Achilles tightness, mild (3/10), feels
  worse in mornings. Restrictions: limit downhill running." / ✓ consumed
- "— PHYSIO · 10 MAY" / "Dr. Sarah Chen — diagnosed mild Achilles
  tendinopathy. 4 weeks of eccentric calf work + ankle mobility." / ✓ consumed
- "— NOTE · 8 MAY" / "Long run yesterday felt great. Legs are coming
  around." / ✓ consumed

DESIGN NOTES

- Filter chips on mobile: horizontally scrollable if they don't fit;
  active chip uses emerald-500 background with emerald-950 text;
  inactive chips are outline with body-text color
- Entry cards have the same visual treatment as other Vert cards —
  subtle border, soft corner radius, generous padding
- The consumed indicator (`✓` vs `○`) is small and understated — top-right
  corner of the entry card, mono, ~12px
- Body part chips in the Injury form should be visually similar to filter
  chips — same selection treatment
- Date pickers should feel native: use the platform's native date picker
  on mobile, a calendar dropdown on desktop
- Form action bars (sticky bottom on mobile for the route screens) handle
  keyboard appearance — content scrolls, action bar stays accessible
- All numerals Geist Mono, tabular
- Em-dash mono section labels everywhere with tracking-[0.2em]
- Dark mode required for every state

DELIVERABLE

Mobile + desktop, light + dark for each state:

Journal feed:
- State A (Default mixed feed) — 4 frames
- State B (Filtered to Injuries) — 4 frames
- State C (Empty state) — 4 frames
- State D (Entry expanded with edit/delete) — 4 frames
- State E (Delete confirmation) — 2 frames (mobile only, light + dark)

Add flow:
- State F (Type-picker sheet/modal) — 4 frames

Input flows (default empty state for each):
- State G (Note bottom sheet) — 4 frames
- State H (Injury route) — 4 frames
- State I (Physio route) — 4 frames
- State J (Travel bottom sheet) — 4 frames

Total: 38 frames. Substantial pass — group by section
(feed / add / inputs) for review.
```

---

## How to use this prompt

1. Continue your existing Claude Design session.
2. Paste the prompt as a new message.
3. Expect ~38 frames covering the feed in 5 states + the add picker + 4 input flows.
4. Iterate with surgical follow-ups if needed.

## What to look for in the result

- Entry cards feel like a coherent family despite different types — same
  em-dash mono header, same visual rhythm
- The consumed indicator is understated but findable
- The filter chips work clearly on mobile (horizontally scrollable if they
  overflow)
- Injury and Physio routes feel substantial without feeling bureaucratic —
  thoughtful form design, clear groupings
- Note and Travel sheets feel like quick capture, not friction
- Empty state feels warm and inviting, not like a failure

## Next screens after this one

Once Journal is locked in, the remaining screens in order are:

1. **Profile tab** — settings, account, athlete profile, race info, edit setup,
   glossary sub-route, exercise preferences (v1 base + future structured prefs)
2. **Wizard polish** — bring the existing intake wizard into the new design system
3. **Landing / marketing page** — for v2 public launch

After Profile we'll have all 4 tabs designed. Wizard polish and Landing are
v2-launch-readiness work.
