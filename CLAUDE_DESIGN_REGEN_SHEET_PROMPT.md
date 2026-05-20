# Claude Design prompt — Universal Regenerate sheet/modal

Delta prompt to add to the existing Claude Design session. Introduces a universal
sheet/modal that opens on every Regenerate entry point — replacing the inline
"+ add notes" affordance across all previously designed screens.

---

```
Design a universal "Regenerate plan" sheet/modal that opens on every regenerate
entry point in Vert. This replaces the inline "+ Add notes" affordance on all
previously designed screens.

WHY THIS COMPONENT EXISTS

Currently, regenerate entry points (the REGEN affordance on Today, the
"Regenerate plan" button on Plan tab, the "Regenerate again with notes"
on the regeneration result screen) each handle the "add optional notes"
case slightly differently. This creates inconsistency and makes the notes
affordance easy to miss.

A universal Regenerate sheet — opened by every entry point — solves three
problems at once:
1. Consistent behavior across entry points
2. The notes affordance is always surfaced
3. Builds trust by showing what context Claude will already use

The sheet is NOT a friction step. It does informational work: shows the
user what Claude already knows, lets them add anything else, then triggers
the regen with one tap.

ENTRY POINTS THAT OPEN THIS SHEET

- Today screen — the small inline `REGEN` affordance
- Plan tab — the prominent `Regenerate plan` button
- Regeneration result page — the `Regenerate` outline button (was
  "Regenerate again with notes" — drop the "with notes" since the sheet
  always offers notes)
- Journal — auto-opens after submitting an injury report or significant
  note (with that fresh entry surfaced in the context list)

REMOVE FROM EXISTING SCREENS

- Today screen: keep the small REGEN affordance, but remove any "+ add
  notes" affordance beside it
- Plan tab: keep the "Regenerate plan" button, but remove the "+ Add
  notes" line below it
- Regeneration result page: change the secondary button label from
  "Regenerate again with notes" to just "Regenerate again" (the sheet
  handles the notes case)

ANATOMY OF THE SHEET / MODAL

Mobile: bottom sheet that slides up from below, occupying ~60-70% of
screen height. Dismissable by swipe-down on the handle, by tapping
outside the sheet, or by tapping Cancel.

Desktop: centered modal with the same content, modal max-width ~480px,
backdrop dim (rgba black at low alpha).

Content (top to bottom):

1. Drag handle indicator at top (mobile only) — small pill bar
2. Section label: "— REGENERATE PLAN" mono uppercase tracking-[0.2em]
3. Body section: "Recent context Claude already has:"
   - Body text in Geist Sans, slightly muted color
   - Below: a vertical list of unconsumed Journal entries + recent
     activity summary, each as a mono row with a leading bullet:
     · "Travel Fri 23 → Sun 25 May · added 15 May"
     · "Right Achilles tightness · mild (3/10) · 12 May"
     · "Last 14 days · 11 done · 2 skipped"
   - Rows in Geist Mono small, dim-but-readable
   - If there's no context to show (rare — first regeneration after
     wizard, no Journal entries, no logged activity), show a single
     line: "Just your race target and athlete profile."
4. Notes input section: "Anything else to consider? (optional)"
   - Label in Geist Sans
   - Multiline textarea below, 3-4 rows tall on mobile, taller on
     desktop
   - Placeholder text: "e.g. 'I'm feeling great this week — push the
     volume a bit', or 'my Achilles is still flaring — keep it light.'"
   - Auto-focus on open (mobile keyboard appears immediately)
5. Action bar at bottom (sticky to sheet bottom on mobile):
   - Cancel: text link, dim, left-aligned
   - Regenerate: emerald CTA with soft glow shadow, trailing ArrowRight,
     right-aligned, h-11
6. The sheet uses the established design tokens: Geist Sans + Mono,
   emerald-500 primary, em-dash mono labels with tracking-[0.2em]

INTERACTION DETAILS

- Tapping Regenerate triggers the regen flow → routes to the regeneration
  result page (we've already designed) with the mid-generation state showing
- The sheet collapses/dismisses as the navigation happens
- If notes were typed, they're saved as a Journal note (with a "regen
  context" tag in v2) so the user can see them later
- If the user dismisses without tapping Regenerate, no regeneration happens
  and any typed notes are discarded (a small "Save as note instead?"
  affordance on cancel could be a v2 thought)

STATES TO DESIGN (4 total)

State A — DEFAULT (sheet just opened, no notes typed)
- Context list shown
- Notes textarea empty with placeholder visible
- Regenerate button in default state

State B — NOTES BEING TYPED
- Context list still shown
- Notes textarea has actual text in it
- Regenerate button still emerald, ready

State C — NO CONTEXT YET (brand-new user, just finished wizard)
- Single-line context: "Just your race target and athlete profile."
- Notes textarea empty with placeholder
- Same actions

State C2 — NOTHING NEW SINCE LAST REGEN (active user, but no activity
or notes since their previous regeneration)
- Context list is sparse, e.g.:
  · "Race target: UTMB 2026"
  · "Last regeneration: May 14, 2026 (3 days ago)"
  · "No new workouts logged · No new notes"
- Below the context section, a soft tip in muted text:
  "Tip: Adding notes will give Claude more to work with. Otherwise
  the plan will likely come back unchanged."
- Notes textarea empty with placeholder
- CTA still says "Regenerate" — the tip is informative, not blocking
- User can still proceed; they're informed, not gated

State D — DESKTOP (centered modal variant)
- All the same content but in a centered modal
- Backdrop dim behind
- Modal max-width ~480px, close-X in the top right corner

DESIGN NOTES

- The sheet should feel informative, not friction-y. The user opens it
  and instinctively understands "ah, Claude is going to use these things,
  and I can add more if I want."
- The context list rows are visually similar to data tiles but more
  compact — mono, single line each, easy to scan
- Mobile bottom sheet must handle keyboard appearing without the action
  bar getting hidden — sticky-bottom action bar that floats above the
  keyboard, or content scrolls behind it
- All em-dash mono labels at tracking-[0.2em]
- Dark mode required for both mobile sheet and desktop modal
- The Regenerate CTA is the most weighty element after the sheet's title

DELIVERABLE — THE SHEET ITSELF

- 5 states (A, B, C, C2, D)
- States A, B, C, C2 × mobile (sheet) × light + dark = 8 mobile frames
- State D × desktop (modal) × 2 variants (default + with notes typed)
  × light + dark = 4 desktop frames
- 12 frames total for the sheet

ALSO: REGENERATE THE PREVIOUSLY DESIGNED SCREENS WITH THE INLINE
"+ ADD NOTES" AFFORDANCES REMOVED

Today screen:
- Keep the small inline REGEN affordance in the plan-strip area
- Remove any "+ Add notes" affordance beside it
- Tapping REGEN now opens this sheet
- 4 frames (mobile + desktop × light + dark)

Plan tab:
- Keep the "Regenerate plan" full-width outline button in the top section
- Remove the "+ ADD NOTES" line below it
- Tapping the button opens this sheet
- 4 frames (mobile + desktop × light + dark)

Regeneration result page (State B, Result view):
- Keep the three actions: Accept new plan / Regenerate again / Discard
- Change the secondary button label from "Regenerate again with notes" to
  just "Regenerate again"
- Remove the inline notes input from this page
- Tapping "Regenerate again" opens this sheet
- 4 frames (mobile + desktop × light + dark)

Updated screens total: 12 additional frames

GRAND TOTAL: 22 frames (10 for the sheet + 12 for the screen updates)
```

---

## How to use this prompt

1. Continue your existing Claude Design session.
2. Paste the prompt above as a new message.
3. Expect ~10 frames covering the sheet/modal in 4 states.
4. After review, Claude Design's existing screens (Today, Plan, Regeneration
   result) should be updated by removing the inline "+ Add notes" affordances —
   ask Claude Design to regenerate those screens with the affordance removed,
   referencing the sheet as the new home for that interaction.

## What to look for in the result

- The context list feels informative, not data-dump-y
- The Notes textarea placeholder gives a concrete example the user can model
- The Regenerate CTA is visually weighty and inviting
- Mobile sheet handles the keyboard cleanly — action bar stays accessible
- Desktop modal feels appropriately framed (centered, max-width, backdrop)
- The sheet's visual language matches Today/Plan/Regen-result screens
  exactly — same emerald, same Geist, same em-dash labels

## A v2 thought worth noting

If a user types notes in the sheet and then taps Cancel (rather than Regenerate),
those notes are currently discarded. In v2, surface a "Save as note instead?"
affordance on cancel — so the user who decided not to regenerate right now but
wrote something useful doesn't lose the thought. Defer to v2.
