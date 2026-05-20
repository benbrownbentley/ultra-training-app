# Claude Design prompt — Vert Today screen (first design pass)

Paste this whole prompt into Claude Design once your design system is set up (the
codebase + brief should already be attached at design-system setup time).

---

```
Design the home / Today screen for Vert.

PURPOSE
The single most-used screen. Answer "what am I doing today, and where
am I in the week?" in under 2 seconds. Optimized for one-thumb mobile
operation — users open this on their phone, often outdoors and sweaty,
often right before or after a workout.

LAYOUT
Mobile-first. Design both mobile (~390px wide, single column) AND
desktop (centered, max ~720px) versions. Full dark mode AND light mode
for each. Match the visual language established in
components/auth/auth-split.tsx (emerald-500 primary, Geist Sans + Geist
Mono, em-dash mono section labels with tracking-[0.2em]).

ANATOMY (top to bottom)

1. Header bar
   - VERT logo (the existing ridge SVG + mono wordmark) on the left
   - Section label center: "— BUILD PHASE · WEEK 6 OF 18"
   - Settings icon (cog) on the right

2. Today section, labeled "— TODAY · TUE 17 MAY"
   - Stack of workout cards (1–N), one per activity for today
   - Below the cards: primary action buttons
     · "Log done" — emerald CTA (bg-emerald-500, text-emerald-950) with
       the soft emerald glow shadow established in the auth pages,
       trailing ArrowRight icon, h-11
     · "Skip" — outline variant, h-11

3. "— THIS WEEK" weekly strip
   - 7 day cards (M T W T F S S), horizontal row
   - Each day shows: day initial · workout-type icon · key metric
     ("12 km", "rest", "32 km long")
   - Today's card highlighted with emerald-500 border + emerald-50
     background tint
   - Completed days: subtle check mark inside a thin circle
   - Skipped days: muted alternate state
   - Prev / next / today nav in Geist Mono, understated

4. "— PLAN" slim stat strip (above the tab bar, ~32px tall)
   - Three mono tiles inline: WK VOL · 88 km  |  VERT · 1,420 m  |  PHASE · BUILD
   - Always visible on Today (drops to less prominent treatment on
     other tabs if needed)

5. Bottom tab bar (persistent across the whole app)
   - TODAY (active here, emerald icon + label)
   - PLAN
   - JOURNAL
   - PROFILE
   - Each tab: Tabler line icon + Geist Mono label in tracking-[0.12em]
   - 0.5px top border separating the bar from content

WORKOUT CARDS — the core component

Every card has the same skeleton:
- Em-dash mono sub-label uppercase: "— [TERRAIN/CATEGORY] · [SUBTYPE]"
  e.g. "— TRAIL · TEMPO", "— STRENGTH · LOWER", "— ROAD · EASY"
- Sans-serif title in Geist Sans, font-medium, tracking-[-0.01em]
- Primary data line in Geist Mono: HR zone → duration → distance/vert
- Optional secondary line (interval structure, fueling, exercise list)
  below a 0.5px dashed divider, dimmer text
- Tap-affordance chevron top-right
- Background motif (low opacity ~16-20%) per primary type:
  · Running: topographic ridge lines fading from right — reuse the
    TopoBackground SVG component from components/auth/topo-background.tsx
  · Strength: stylized barbell silhouette in the same line-art
    vocabulary (a horizontal bar with two outlined circular plates on
    each end, fading from right)
  · Physio, Cross-training, Mobility: propose motifs in the same
    line-art vocabulary — abstract enough not to claim to be data,
    recognizable enough to differentiate at a glance
- Whole card is tappable; routes to /workout/[id]

CARD METRIC HIERARCHY for running (HR is primary)
1. PRIMARY: HR zone (e.g., "Z3–Z4", "Z4 sustained")
2. SECONDARY: Duration (~60 min)
3. TERTIARY (varies by subtype/terrain):
   - Easy / long: pace range or "by feel", vert if trail
   - Tempo / threshold: target pace range, interval structure below divider
   - Hills / intervals: structured segments, vert
   - Trail surfaces vert prominently; road surfaces pace prominently

PLANNED vs LOGGED states (every card has both)
- Planned (default, before logging): shows target metrics
- Logged: shows actuals alongside or replacing targets, with a small
  done indicator. For tempo/threshold, the logged readout emphasizes
  time-in-zone (e.g., "42 min in Z4 (target 40)") rather than average HR.

STATES TO DESIGN (all 5 for Today)

State A — DEFAULT
Today has two workouts not yet logged. Use this content:
- Card 1: Tempo Run, trail
  - Sub-label: "— TRAIL · TEMPO"
  - Title: "Tempo Run"
  - Primary: "Z3–Z4 · 60 min · 12 km · +220m"
  - Below divider: "4 × (8 min @ Z3 / 2 min jog)"
- Card 2: Strength A, lower body
  - Sub-label: "— STRENGTH · LOWER"
  - Title: "Strength A"
  - Primary: "~45 min · 5 exercises"
  - Below divider: "Squat 4×6 · RDL 3×8 · Lunge 3×8/leg  +2 more"

State B — REST DAY
Today is a rest day. Peaceful, not a "nothing to do" failure state.
- A single contemplative card or section showing:
  "— REST · Recovery is the work. See you tomorrow."
- Optionally: a small "tomorrow preview" card hinting at what's coming
  ("Tomorrow: 32 km long run · fuel up tonight")

State C — TODAY ALREADY LOGGED
Both workouts logged-done. Show:
- Each card in its logged state with planned + actual side by side
  (e.g., "Target 60 min · Done 62 min, 42 in Z4 / 18 in Z3")
- A small confident emerald checkmark cluster
- Log buttons replaced with an "Edit log" link
- The today section gets a subtle "— LOGGED" badge

State D — MID-REGENERATION
A regeneration is in flight (5–15 seconds, async Claude API call).
- Banner at top of the Today section: "— UPDATING YOUR PLAN · Reading
  your last 14 days…" with a subtle animated dot pattern (only one,
  no scattered micro-interactions elsewhere)
- Log buttons disabled
- Cards dim slightly

State E — EMPTY (first-time user, no plan yet)
A new sign-up landed on /, no plan exists yet.
- Single-screen state directing to /wizard:
  "— WELCOME · Tell us about your race."
- Primary emerald CTA: "Set up your training plan →"
- Subtle TopoBackground motif anchoring the brand

DATA TO USE (realistic ultrarunner training for UTMB 2026)
- Race: UTMB 2026 (171.5 km, 10,040 m vert, cutoff 46:30)
- Athlete is 18 weeks out, BUILD phase, week 6 of 18
- Today: Tue 17 May 2026
- This week: Mon easy 8km / Tue tempo 12km + strength A /
  Wed easy 10km / Thu hills 14km / Fri rest /
  Sat long 32km / Sun easy 12km
- Weekly volume: 88 km running + 2 strength sessions
- Phase progress badge: showing 6 of 18 in BUILD

DESIGN NOTES
- All numerals are Geist Mono, tabular
- Every section label uses the em-dash mono uppercase convention with
  tracking-[0.2em] (this is the signature microcopy move — apply it
  consistently)
- Mobile: generous tap targets (min 44pt), no horizontal scrolling
  except the weekly strip
- Desktop: centered, max ~720px. A 2-column layout (cards left, weekly
  strip + plan strip right) is acceptable if it improves hierarchy
- Dark mode is required for every state — pull from the auth pages'
  dark mode treatment
- The "Log done" CTA is the most-tapped button in the entire app —
  make it tactile, reassuring, and the most visually weighty element
  on the screen (after the workout cards themselves)
- Avoid: purple gradients, Inter typeface, hover-heavy micro-
  interactions, web-only patterns (the app migrates to React Native in v3)

DELIVERABLE
- All 5 states (A–E)
- Each state × mobile + desktop × light + dark = 4 frames per state
- 5 × 4 = 20 frames total
- Group frames by state so I can scan them side-by-side
- If you propose alternate motifs for Physio / Cross-training /
  Mobility, surface them as a separate "primary-type motif family"
  artifact alongside the main deliverable
```

---

## How to use this prompt

1. Open claude.ai/design and ensure your design system is set up (it should
   already be — auth components, AGENTS.md, VERT_DESIGN_BRIEF.md, and the brand
   notes are attached at design-system setup).
2. Paste the prompt above as your first message in the design canvas.
3. Let Claude Design generate. Expect 20 frames; this is a substantial pass.
4. Review the output and iterate. Surgical follow-up prompts work better than
   restarts. Examples:
   - "Tighten the heading letter-spacing to tracking-[-0.02em], weight 500."
   - "The tempo card's interval structure feels cramped. Give it more breathing room."
   - "Make the mid-regeneration animated dots match the pacing of a heartbeat."
5. When the home screen is locked in, the next screens to design (in order) are:
   workout drill-down / log page → regeneration result/diff → Plan tab →
   Journal tab → Profile tab → wizard polish → onboarding flow.

## What to look for in the result (sanity-check the canary signals)

- Section labels: uppercase Geist Mono, em-dash prefix, tracking-[0.2em]
- Primary CTA: emerald-500 with a soft emerald glow shadow, trailing ArrowRight
- Headings: font-medium with tracking-[-0.02em], never font-bold
- Numerals everywhere: Geist Mono, tabular
- Dark mode actually exists and is on-brand (not just inverted colors)
- Mobile version is usable one-handed, thumb-zone for log CTAs
- Motifs: topographic ridges on Running cards, barbell silhouette on Strength,
  both at low opacity (~16–20%), both fading in from the right
- Bottom tab bar visible on all states (except possibly mid-regeneration if
  that feels right)
- The "— PLAN" slim stat strip sits above the tab bar showing WK VOL · VERT · PHASE

## If the system didn't propagate

If section labels come back in default sentence case or the primary CTA is the
wrong shade of green, the design system setup didn't fully take effect. Reply
with a single surgical correction:

> Match the visual language from components/auth/auth-split.tsx: emerald-500
> primary, Geist Sans + Geist Mono, uppercase mono section labels with em-dash
> prefix and tracking-[0.2em], headings font-medium with tracking-[-0.02em],
> full dark mode support. Regenerate the previous frames with these tokens.
