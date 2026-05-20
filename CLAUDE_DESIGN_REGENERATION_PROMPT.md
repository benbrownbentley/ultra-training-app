# Claude Design prompt — Vert regeneration result page

Paste this prompt into Claude Design once the drill-down/log page is locked in.
Continues the same design system / visual language established by previous passes.

---

```
Design the regeneration result page for Vert.

PURPOSE
The screen the user lands on after triggering a plan regeneration. The
single most important screen for the product's "adaptive AI" promise —
if this feels like a black box, the entire value prop collapses. Show
the user clearly what changed, why, and what Claude considered. Give
them agency: accept, regenerate again (with optional notes), or discard.
The plan never auto-commits — explicit accept only.

ENTRY POINTS (where the user arrives from)
- "REGEN" inline affordance on the Today screen — one-tap regen
- "Regenerate plan" CTA on the Plan tab — primary path ("review then regenerate")
- Auto-triggered after submitting an injury report or significant note in Journal

All three lead here. What triggered the regen is surfaced in the
"— BASED ON" section.

LAYOUT
Mobile-first. Mobile (~390px wide) AND desktop (centered, max ~720px).
Full dark mode AND light mode. Same visual language as Today and the
drill-down page — emerald-500 primary, Geist Sans + Geist Mono, em-dash
mono section labels with tracking-[0.2em], topographic ridge motif at
low opacity as ambient decoration.

ANATOMY (top to bottom — when in RESULT state)

1. Header
   - Back link top-left: "← Today" in mono uppercase (user can bail
     anytime without committing)
   - Settings cog top-right

2. State title in mono uppercase, large tracking
   - Default result: "— PLAN UPDATED · just now"
   - Minor change variant: "— PLAN CONFIRMED · minor adjustments only"
   - Accepted: "— PLAN UPDATED · you're all set"

3. Summary card (top, prominent)
   - 2–3 sentences in plain English from Claude — the Vert "coach voice"
   - Body text in Geist Sans, slightly larger than typical card copy,
     comfortable line height
   - Sample copy: "I shifted your Saturday long run to Thursday to make
     room for your Friday flight, and reduced this week's total volume
     by 8% to give your Achilles a lighter load while you ramp up calf
     strength work."

4. Change badges (below the summary)
   - Pill-style tiles in mono uppercase showing high-level moves
   - Three badges in this example:
     · "SHIFTED · Sat long → Thu"
     · "REDUCED · weekly volume −8%"
     · "ADDED · 2× calf strength"
   - Each badge: data-tile pattern but small, horizontally laid out,
     wraps to two rows if needed

5. "— WEEK BY WEEK" diff view
   - The next 4–6 weeks displayed
   - SINGLE COLUMN on mobile (each week as a stacked section)
   - On desktop: side-by-side OLD vs NEW columns where it fits cleanly
   - For each week:
     · Week header label: "— WEEK 6 OF 18"
     · Day rows: Mon Tue Wed Thu Fri Sat Sun
   - For each day:
     · UNCHANGED: dimmed/muted; workout title and key metric only
       ("Mon · Easy 8km")
     · CHANGED: emerald accent; show before → after inline
       ("Thu · Long Run 32km · was Sat")
     · ADDED: emerald with a "+ NEW" badge
       ("Wed · Calf Strength · 15 min")
     · REMOVED: strikethrough/dimmed with a "REMOVED" badge
   - Goal: changes scan instantly without reading every line

6. "— BASED ON" section
   - EXPANDED by default for the first ~3 regenerations a user sees,
     auto-collapses after the pattern is familiar
   - Lists Claude's inputs in clean Geist Mono so the user can audit:
     · "Last 14 days · 11 workouts done · 2 skipped · avg pace within
       target"
     · "Journal note · Travel Fri 23 → Sun 25 May (Vancouver → SF) ·
       added 15 May"
     · "Injury report · Right Achilles tightness · mild (3/10) ·
       reported 12 May"
     · "Race target · UTMB 2026 · 18 weeks out · BUILD phase"
   - Each input on its own row, plainly presented

7. Action bar (sticky bottom on mobile, inline on desktop)
   - Primary: "Accept new plan" — emerald CTA with soft glow shadow,
     trailing ArrowRight, h-11
   - Secondary: "Regenerate" — outline button, h-11
     · Beside or below the Regenerate button: a small muted affordance
       "+ add notes" in mono lowercase. Tapping it opens an inline
       notes textarea below the button.
     · When notes are entered, the Regenerate button label updates to
       "Regenerate with notes" and the inline notes preview shows
   - Tertiary: "Discard" — text link, dim color, kept understated
     because discarding shouldn't feel like a primary action

STATES TO DESIGN (5 total)

State A — GENERATING (loading state, 5–15 seconds)
- Full-screen, atmospheric
- TopoBackground motif at full canvas, low opacity (~12–15%)
- Centered: "— UPDATING YOUR PLAN"
- Rotating mono status lines below, one at a time, fading in/out:
  · "Reading your last 14 days…"
  · "Considering your injury history…"
  · "Balancing volume and recovery…"
  · "Working out your race week taper…"
- A subtle animated dot pattern (just one — no scattered micro-interactions)
- No header back link visible, no actions — user is committed to waiting
- Should feel like a moment of suspense, earned attention

State B — RESULT VIEW (the main screen above)
- Full anatomy as described
- User can scroll the diff, expand/collapse "— BASED ON"
- Action bar visible at bottom
- The screen the user spends time on

State C — MINOR CHANGE
- Same anatomy but diff section collapsed by default
- Summary card emphasizes that the plan is holding up:
  "Your plan is holding up well. I made a few small adjustments based
  on your last 14 days — shifting two strength sessions to better
  recovery timing. No major changes needed."
- Fewer change badges (maybe 1–2)
- "— WEEK BY WEEK" visible but collapsed with a "View 3 small
  adjustments →" expand affordance
- Reinforces that the AI isn't churning the plan for the sake of it

State D — ACCEPTED (brief confirmation, then routes back to Today)
- Full-screen, brief moment
- "— PLAN UPDATED · you're all set"
- Subtle confirmation animation (a single emerald checkmark cluster)
- Auto-routes back to Today after ~1.5 seconds without user action
- (Optional small toast on Today afterwards: "Plan updated")

State E — ERROR
- Header: "— REGENERATION FAILED"
- Body: "We couldn't update your plan right now. Your existing plan
  is unchanged. Try again in a moment, or contact support if this
  keeps happening."
- Two actions: "Try again" (primary outline) and "Back to Today" (text link)
- Muted, apologetic but not catastrophic

CONTENT TO USE (realistic scenario for all visible states)

Athlete is 18 weeks out from UTMB 2026, BUILD phase, week 6 of 18.
Today is Tue 17 May 2026.

Context that triggered this regeneration:
- 14 days of compliant logs (11 workouts done, 2 skipped — both easy runs)
- Journal note added 15 May: "Travel Fri 23 → Sun 25 May, Vancouver to
  SF for a wedding. Can't run Friday or Sunday."
- Injury report submitted 12 May: "Right Achilles tightness, mild
  (3/10), feels worse in the mornings."

Resulting plan changes:
- Sat 21 May long run (32 km, +1,420m vert) shifted to **Thu 22 May**
  (before the flight)
- Weekly volume reduced 8% this week (88 km → 81 km) and next week
  (92 km → 85 km)
- Added 2× calf-strength micro-sessions on Wed 18 May and Sat 21 May
  (15 min each) for Achilles management
- Fri 23 May and Sun 25 May explicitly marked as rest/travel days

Use this scenario consistently across all states.

DESIGN NOTES

- The summary card is the "coach voice" moment — body text, comfortable
  line height, slightly more presence than typical card copy. Italic or
  larger size to differentiate.
- Change badges feel like data tiles but smaller, pill-shaped, mono
- The diff section is the densest part of the page — design carefully
  so it scans on mobile. If single-column highlights feel cramped,
  surface an alternate layout (e.g., grouped by week with collapsed
  unchanged days)
- Mid-generation state is a moment of suspense — atmospheric but not
  busy. One animated element only.
- Accept CTA must feel weighty and reassuring — the user is committing
  to the new plan
- Discard is intentionally tertiary; users shouldn't habitually discard
- The "+ add notes" affordance is visible from the first arrival, not
  hidden behind a first regen
- All numerals Geist Mono, tabular
- Em-dash mono section labels everywhere, tracking-[0.2em]
- Avoid: purple gradients, Inter typeface, hover-heavy micro-interactions

DELIVERABLE

- All 5 states (A–E)
- Each state × mobile + desktop × light + dark = 4 frames per state
- 5 × 4 = 20 frames total

OPTIONAL ALTERNATE
- Desktop variant of State B showing side-by-side OLD vs NEW columns
  in the diff view as an alternative to the single-column layout
  (light + dark = 2 frames)
```

---

## How to use this prompt

1. Continue your existing Claude Design session.
2. Paste the prompt above as a new message.
3. Let Claude Design generate. Expect ~20 frames (22 with the optional alternate).
4. Review against the canary checklist below, iterate with surgical follow-ups.

## What to look for in the result

- The summary card reads like a coach speaking, not like a system log
- Change badges are scannable in under 3 seconds — high-level move + magnitude
- The diff highlights what changed without burying it under unchanged content
- "— BASED ON" feels demystifying, not data-dump-y. The user should be able
  to read each line and think "yes, of course Claude considered that"
- The mid-generation state feels atmospheric, not annoying — five to fifteen
  seconds is a long time to wait, the design should make the wait feel
  intentional
- Accept CTA is the visually heaviest element after the summary card
- "+ add notes" is discoverable but doesn't compete with the primary action
- Discard is findable but understated

## If single-column diff feels cramped on mobile

Ask Claude Design to redraw State B with an alternate diff layout — grouped
by week with unchanged days collapsed under a "+ 4 unchanged days" affordance
that expands on tap. We can compare and pick the better one.

## Next screens after this one

Once the regeneration result is locked in, the next screens in order are:

1. **Plan tab** — full training block view; phase visualization; per-week
   drill-down; where drag-and-drop manual edits will eventually live
2. **Journal tab** — unified surface for notes / injuries / physio / observations
   / travel. Filter chips. "Report injury" and "Add note" flows live here.
3. **Profile tab** — settings, account, athlete profile, race info, edit setup,
   glossary sub-route
4. **Wizard polish** — bring the existing intake wizard into the new design system
5. **Landing / marketing page** — for v2 public launch
