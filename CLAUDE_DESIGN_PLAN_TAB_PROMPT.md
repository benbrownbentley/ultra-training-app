# Claude Design prompt — Vert Plan tab

Paste this prompt into Claude Design once the previous screens are locked in.
Continues the same design system / visual language.

---

```
Design the Plan tab for Vert.

PURPOSE
The zoom-out view of the user's training block. Home for "where am I in the
journey, and what's coming?" The user comes here to review the plan, see the
arc, regenerate when life changes, and (in v2) make manual edits via drag-
and-drop.

LAYOUT
Mobile-first. Mobile (~390px wide, single column) AND desktop (centered, max
~720px, 2-column where it helps). Full dark mode AND light mode. Same visual
language as Today and the drill-down page — emerald-500 primary, Geist Sans
+ Geist Mono, em-dash mono section labels with tracking-[0.2em],
topographic ridge motif as ambient decoration.

ANATOMY (top to bottom)

1. Header bar
   - VERT logo on the left (or omit since this is a tab — judge what feels right)
   - Settings cog on the right
   - No back link (Plan is a tab destination, not a route off another screen)

2. Top section (above the week scroll)
   - Phase + week marker, mono uppercase wide tracking:
     "— BUILD · WEEK 6 OF 18 · 12 WEEKS TO UTMB"
   - Volume progression sparkline:
     · Horizontal chart spanning the full width
     · X-axis: 18 weeks of the block
     · Primary line: weekly running volume in km (or mi based on user pref)
     · Secondary line: weekly vert in m, lighter / thinner / dimmed
     · Vertical marker line at the current week (week 6)
     · Subtle phase background tint behind the relevant week ranges
     · Y-axis labels are optional — small mono tokens at min/max
     · No interactivity needed in v1; it's a context-setting visualization
   - "Regenerate plan" button:
     · Full-width outline, h-11
     · A muted "+ add notes" affordance beside or below it (same pattern
       as the regeneration result screen)
     · Tapping kicks off the regeneration flow → routes to the regeneration
       result screen we've already designed

3. Week scroll (the main body)
   - "← View earlier weeks" affordance at the very top:
     · Small mono link, dimmed
     · Tapping expands all past weeks inline above the current scroll
       position (does not navigate away; user is still on Plan tab)
   - Last week (week 5 in our example) shown above current:
     · Same week-section format as future weeks but visually dimmed/muted
       (~60% opacity, slightly desaturated)
     · Communicates "this is past" without hiding it
   - Current week (week 6):
     · Highlighted with emerald accent — subtle emerald border or background
       tint that makes it visually distinct from past and future
     · The "— WEEK 6 OF 18 · BUILD" label gets emerald color treatment
   - Each week section format:
     · Label: "— WEEK [N] OF 18 · [PHASE]" in mono uppercase
     · Below the label: a row of 7 small day cards (Mon Tue Wed Thu Fri Sat Sun)
     · Each day card: day initial · workout-type icon · key metric
       (e.g., "T · run icon · 12km" or "F · — · rest")
     · Subtle weekly summary line below the day strip:
       "Volume · 88 km · Vert · +1,420m" in mono, dim
     · The whole week section is tappable: routes to /plan/week/[n] for
       the full per-week view
   - Phase background tinting:
     · Each week's section gets a very subtle background color shift based
       on phase (Base / Build / Peak / Taper)
     · Lean: a single emerald with varying lightness — Base ~0% tint
       (white/zinc-50), Build ~4% emerald tint, Peak ~8% emerald tint,
       Taper ~3% emerald tint (lighter, almost mint)
     · Tints should be subtle enough that text remains crisp
   - Phase divider:
     · Between weeks where the phase changes, insert a labeled divider:
       "— PEAK PHASE BEGINS" (mono uppercase, tracking-[0.2em], emerald)
     · A thin horizontal rule above and below the label
     · Makes phase transitions clearly visible
   - Race day tile at the very end of the scroll:
     · Distinct from week sections — a full-width emerald-filled tile
       (bg-emerald-500, text-emerald-950 for high contrast)
     · Content: "— RACE DAY" mono label, then a large sans-serif title
       "UTMB 2026", then mono data line:
       "26 AUG 2026 · 171.5 km · +10,040 m · cutoff 46:30"
     · Visually substantial — the destination the whole block builds toward

4. Bottom tab bar (persistent)
   - PLAN tab is active

PER-WEEK DRILL-DOWN VIEW (route: /plan/week/[n])

When the user taps any week section, they route to a dedicated view of that
week. This view should be designed in this same pass.

Anatomy:
- Back link top-left: "← Plan" in mono uppercase
- Header section label: "— WEEK 6 OF 18 · BUILD · 12 WEEKS TO UTMB"
- Week summary tiles (data-tile pattern): VOLUME · VERT · KEY WORKOUTS · PHASE
- 7-day list, each day as a section:
  · Day header: "MON 19 MAY" mono uppercase + summary line
    ("Easy 8km · Z1-Z2")
  · Workout cards for that day (same compressed card format as Today's
    workout cards, with the topo/barbell/etc motifs)
  · Tapping a workout card routes to /workout/[id]
- Rest days shown as a peaceful "— REST" section, not skipped or empty
- Mini phase pill at top reinforcing context

States:
- Default — viewing a future or current week
- Past week — same layout but with logged data shown alongside planned
- Race week (week 18) — last week before race day, special framing
  ("— RACE WEEK · TAPER" header treatment)

STATES TO DESIGN (4 total for Plan tab + 1 for per-week)

State A — DEFAULT (Plan tab)
- Top section + week scroll showing last week (dimmed) → current week
  (highlighted) → next 4-6 future weeks
- Past collapsed behind the "← View earlier weeks" affordance
- All sections rendered at normal density
- Race tile visible if user scrolls to the bottom (or showing in the
  "future weeks" range if it fits)

State B — PAST WEEKS EXPANDED
- User tapped "← View earlier weeks"; weeks 1-4 now visible above week 5
- All past weeks have the same dimmed treatment
- A small "Collapse" affordance at the top to re-hide
- The user can scroll all the way back to week 1

State C — MID-REGENERATION
- Banner at top of the Plan tab: "— UPDATING YOUR PLAN · Reading your
  last 14 days…" with the same animated dot pattern from the Today and
  regeneration screens
- Regenerate button disabled
- Week sections dim slightly to indicate the plan is being recomputed
- After regen completes, user is routed to the regeneration result screen

State D — RACE WEEK (current week = week 18)
- Top header reflects: "— TAPER · WEEK 18 OF 18 · 3 DAYS TO UTMB"
- Race day tile feels imminent — maybe slightly more prominent or with
  an added "starts in 3 days" sub-line
- Week 18 itself is the current-week-highlighted section
- Conveys "this is the week" without panic

State E — PER-WEEK DRILL-DOWN VIEW (the /plan/week/[n] route)
- Showing a specific week (use week 6) with the anatomy described above
- Tap-affordance to navigate to individual workouts

CONTENT TO USE (realistic for UTMB 2026)

Block structure (18-week ultra build):
- Weeks 1-5: Base phase (volume buildup, mostly Z1-Z2)
- Weeks 6-11: Build phase (introducing tempo, threshold, hills)
- Weeks 12-15: Peak phase (highest volume, race-specific simulation)
- Weeks 16-18: Taper (reducing volume, maintaining intensity)
- Week 18 ends with race day on 26 Aug 2026

Weekly volume progression (km, for the sparkline):
W1 60 · W2 65 · W3 72 · W4 70 · W5 78 · W6 88 (current) · W7 92 · W8 96 ·
W9 88 (down week) · W10 102 · W11 108 · W12 116 (peak) · W13 122 (peak) ·
W14 108 · W15 95 · W16 70 (taper) · W17 50 · W18 30 (race week)

Weekly vert progression (m, secondary sparkline line):
proportional to the volume but with peaks where vert-specific weeks happen

Athlete is currently in BUILD phase, week 6 of 18, 12 weeks to UTMB.
Today: Tue 17 May 2026. Race day: 26 Aug 2026.

DESIGN NOTES

- Sparkline is the macro context — keep it readable but not dominant
- Phase tints must be subtle. If they fight the readability of the day
  cards' text, dial them back
- The race tile at the end is the visual gravity of the whole tab — it's
  what everything builds toward. Make it weighty, like the user is
  scrolling toward race day
- "View earlier weeks" affordance: discoverable but understated. Users
  shouldn't trip over it; they should find it when they want it
- All numerals Geist Mono, tabular
- Em-dash mono section labels with tracking-[0.2em] everywhere
- Dark mode required for every state
- Day cards within week sections leave horizontal room for v2 drag-and-drop
  drop targets — don't show drag handles or affordances yet, just leave
  the spatial allowance

DELIVERABLE

- 5 states (A-E)
- Each state × mobile + desktop × light + dark = 4 frames per state
- 5 × 4 = 20 frames total
- Group frames by state for side-by-side comparison
```

---

## How to use this prompt

1. Continue your existing Claude Design session.
2. Paste the prompt above as a new message.
3. Expect ~20 frames covering the Plan tab in 5 states (default, past expanded,
   mid-regeneration, race week, per-week drill-down).

## What to look for in the result

- Sparkline reads as macro context without dominating the screen
- Past week (week 5) is visibly dimmed but legible
- Current week (week 6) has clear emerald accent — the user knows where they are
- Phase tints are subtle enough that workout details remain crisp
- Phase divider between Build and Peak reads as a meaningful transition, not
  a random label
- Race tile feels weighty — like a destination, not just another row
- Per-week drill-down feels like a natural extension of the week section, not
  a parallel design system

## Iteration prompts if things are off

- "Phase tints are too saturated. Reduce by 50%."
- "The sparkline competes with the week scroll for attention. Make it shorter
  in vertical height (~50px max) and use lighter line weights."
- "Race tile looks like a button. Make it feel more like a milestone marker —
  add a subtle topo motif behind, increase corner radius, maybe a small flag
  or finish-line icon top-right."

## Next screens after this one

Once the Plan tab is locked in, the next screens in order are:

1. **Journal tab** — unified surface for notes / injuries / physio / observations
   / travel & events. Filter chips. "Report injury" and "Add note" flows live here.
2. **Profile tab** — settings, account, athlete profile, race info, edit setup,
   glossary sub-route, preferences.
3. **Wizard polish** — bring the existing intake wizard into the new design system.
4. **Landing / marketing page** — for v2 public launch.
