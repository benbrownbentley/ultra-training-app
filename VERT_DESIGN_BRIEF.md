# Vert — Design Brief for Claude Design

_Last updated: 2026-05-17_

This is a prompt-ready brief to take into Claude Design (claude.ai/design). Paste the whole thing
as the first message, then prompt Claude Design screen-by-screen using the inventory at the bottom.

The goal is **wireframes/mockups that act as a roadmap for build, not production-ready code.**
Output target: clear visual designs in the Vert aesthetic that I can review, iterate, and then
hand to v0.dev or Claude Code to implement in Next.js + shadcn/ui.

---

## 1. What Vert is

Vert is an **adaptive endurance training app**. A user enters a race goal and fitness baseline
in an intake wizard, Claude generates a personalised daily training plan (running + gym), the
user logs workouts day-by-day, and the plan regenerates as data accumulates or as life changes
(injury, travel, race shifts).

The differentiator vs. existing apps (Strava, TrainingPeaks, Final Surge): the plan **adapts
intelligently** instead of being a static spreadsheet that dies in week three.

- **v1 user:** ultrarunners (50K → 100mi) training for a specific race
- **v2 user:** any endurance athlete signing up publicly
- **Tone:** serious about training, but not bro-y. Calm, considered, athlete-respecting.
  Closer to Patagonia than Nike. Closer to UltraSignup than Strava.

---

## 2. Design principles

1. **Mobile-first in intent.** Users log workouts on their phone, often outdoors, often sweaty.
   Tap targets generous, text readable in sunlight, the most-used action ("log this workout")
   never more than one tap away on the home screen.
2. **Calm density.** Endurance athletes want to see the week at a glance without feeling
   overwhelmed. Lean on whitespace and typographic hierarchy, not on chrome and panels.
3. **The plan is the hero.** Everything else (settings, history, glossary) is secondary.
   Today's workout is the first thing on the home screen, always.
4. **Adaptive ≠ magic.** When the plan regenerates, show the user *why* it changed.
   Never make the AI feel like a black box.
5. **Distinctive, not generic.** Avoid the "AI slop" SaaS aesthetic (purple gradients on
   white, Inter everywhere, Stripe-clone cards). Lean toward something that feels like it
   was designed by someone who runs ultras.

---

## 3. Visual direction — established by the auth pages

**This aesthetic is already in the codebase.** It was designed for the sign-in / sign-up
screens (`components/auth/auth-split.tsx` + supporting components) and should be inherited
and extended for every screen Claude Design produces. Do not invent a parallel design
language. Open these files for ground truth:

- `components/auth/auth-split.tsx` — split-panel layout, copy voice, microcopy conventions
- `components/auth/topo-background.tsx` — topographic ridge SVG (reusable across screens)
- `components/auth/elevation-profile.tsx` — elevation chart SVG (reusable as a motif)
- `components/auth/vert-logo.tsx` — logo and wordmark
- `app/globals.css` — CSS variables, theme tokens, dark mode

**Mood:** Trail at dawn meets a serious athlete's race-prep dashboard. Confident, calm,
considered. Closer to UltraSignup or Patagonia than to Strava or Nike.

**Typography (locked in — already configured)**
- **Body / headings:** Geist Sans (`var(--font-geist-sans)`), weight 400/500/600.
  Headings use `font-medium` (500) with tight tracking (`tracking-[-0.02em]`) — not bold.
- **Labels, data, numerals, microcopy:** Geist Mono (`var(--font-geist-mono)`). Always
  uppercase for labels with wide tracking (`tracking-[0.2em]` for section labels,
  `tracking-[0.12em]` for the wordmark, `tracking-[0.18em]` for data labels).
- **Display-size copy** uses `text-[42px]` or `text-[30px]` with `font-medium` and
  `leading-tight` or `leading-[1.05]`. Tight line-heights. Tight letter-spacing on the
  larger sizes.
- **Numerical data** uses Geist Mono at sizes around `text-[22px]` with `font-medium` and
  `tracking-[-0.01em]`. Always tabular.

**Color palette (locked in)**
- **Primary brand:** Emerald-500 `#10b981` (this is *the* Vert green — use it consistently).
- **Trail-panel gradient (dark surfaces):** `from-[#052e1f] via-[#064e3b] to-[#065f46]`
  (deep forest gradient). Used as the "hero" dark surface on auth — reuse for other
  immersive surfaces (e.g. the regeneration result screen).
- **Accent text on dark:** emerald-200, emerald-300, emerald-50 (lightest body text on the
  trail panel).
- **Accent text on light:** emerald-700.
- **Backgrounds (light mode):** zinc-50 / `oklch(1 0 0)` for surfaces, near-black
  `oklch(0.145 0 0)` for text.
- **Backgrounds (dark mode):** zinc-950 / `oklch(0.145 0 0)` for surfaces, off-white
  `oklch(0.985 0 0)` for text.
- **Borders:** zinc-200 (light), zinc-800 (dark) — soft, never harsh.
- **Destructive / injury / error:** existing `--destructive` token (red-leaning oklch).
- **Full dark mode is required.** Every screen must work in both themes — the auth pages
  already do this and the CSS variables are wired up.

**Layout patterns established**
- **Split panel** for hero screens (auth uses 1.05fr / 1fr at `lg:` and above; collapses
  to single column on mobile). The left panel is the immersive dark forest surface; the
  right is the clean light form surface. Consider this pattern for the wizard, the
  regeneration result, and potentially the workout drill-down.
- **Section labels** are uppercase mono with an em-dash prefix and wide tracking:
  `— NEW ATHLETE`, `— RETURNING`, `— CHECK YOUR INBOX`. This is *the* signature
  microcopy move. Reuse it: `— TODAY`, `— THIS WEEK`, `— LOGGED`, `— SKIPPED`,
  `— REGENERATING`, etc.
- **Data tile pattern** — `LABEL` (mono, uppercase, wide tracking, emerald-300 on dark) /
  `VALUE` (mono, large, tabular) / `unit` (mono, small, dimmer). Used in the race-stats
  block on the trail panel. Reuse for workout summary tiles, weekly load, etc.

**Decorative motifs (reusable across screens)**
- **Topographic ridge background** (`TopoBackground` component) — soft sine-wave ridge
  lines. Use sparingly on dark immersive surfaces (auth trail panel, regeneration result
  hero, empty states). Already a component — just import it.
- **Elevation profile chart** (`ElevationProfile` component) — small static line+area
  chart. Currently decorative on auth; could become a real data visual showing weekly
  load, course elevation for the target race, or workout intensity.

**Buttons & inputs (already established)**
- Inputs: `h-11`, shadcn `Input` primitive, no custom one-offs.
- Primary CTA: `bg-emerald-500 text-emerald-950 shadow-[0_6px_18px_rgba(16,185,129,0.25)]
  hover:bg-emerald-400`, height `h-11`, font-semibold, with a trailing `ArrowRight` icon
  by default. Tactile, weighty, with a soft emerald glow.
- Secondary / OAuth: outline variant, same height, with provider icon on the left.

**Copy voice (established by auth)**
- Confident and brief. Headings are commands or warm welcomes: "Lace up.", "Welcome back.",
  "Confirm your email.", "Train for the distance that scares you."
- Athlete vocabulary, but never bro-y. "Block" (training block), "vert" (vertical gain),
  "lace up", "first ultra".
- Placeholder text contributes to the world: `athlete@trail.run` not `you@example.com`.
- Em-dash em-dash em-dash. Used in section labels and inline.
- No exclamation points. No emoji. No "Let's go!"

**Motion**
- Subtle, purposeful, on-load only. A staggered reveal of weekly-strip cards is welcome.
  Avoid hover-on-every-card micro-interactions. This is a tool, not a portfolio site.

**What this means for Claude Design prompts**
When prompting Claude Design for each screen, tell it explicitly: *"Match the visual
language established in components/auth/auth-split.tsx — emerald-500 primary, Geist
Sans + Geist Mono, uppercase mono labels with em-dash prefix and wide tracking
(0.2em), tight-letterspaced medium-weight headings, full dark mode support,
optionally use the TopoBackground and ElevationProfile components as decorative
motifs."* Attach the auth screen as a reference image if Claude Design supports it.

---

## 4. Tech & system constraints

- Will be built in **Next.js 16 + Tailwind 4 + shadcn/ui + TypeScript**.
- Components must be expressible in shadcn primitives extended via Tailwind. Don't propose
  components that would require ejecting shadcn or a custom design system from scratch.
- All numerical data comes from Supabase Postgres (race, athlete_profile, workouts tables).
- Plan generation and regeneration are async server actions calling the Anthropic Claude API.
  Loading states must accommodate "this could take 5–15 seconds."
- The app is currently a Next.js PWA. v3 migrates to React Native (Expo). Avoid any design
  choice that depends on something only a web browser can do (custom cursors, hover-heavy
  interactions, complex CSS-only effects).

---

## 5. Screen inventory

Each screen below has: **purpose**, **key elements**, **states**, **data shown**.
Generate one screen per Claude Design prompt — don't try to one-shot the whole app.

### A. Landing / marketing page (v2 — not yet built)
- **Purpose:** Convince an endurance athlete who's never heard of Vert to sign up.
- **Key elements:** Hero with one-line value prop ("A training plan that adapts as you do."),
  a single screenshot or animated mock of the home screen, three-bullet "how it works",
  social proof slot (testimonials placeholder), sign-up CTA, footer.
- **States:** Logged-out only. Logged-in users get redirected to `/`.
- **Tone:** Quietly confident. No exclamation points. No "revolutionize your training."

### B. Sign-in / sign-up (built, needs design polish)
- **Purpose:** Get a user authenticated with as little friction as possible.
- **Key elements:** Email + password fields, Google OAuth button, switch between sign-in
  and sign-up, password reset link.
- **States:** Default, loading (after submit), error (bad credentials / weak password /
  email taken), success (redirect imminent).
- **Tone:** Same as landing. Sparse.

### C. Intake wizard (built — `/wizard`, needs design polish)
- **Purpose:** Collect everything Claude needs to generate a personalised plan, without
  exhausting the user. Currently multi-step.
- **Key elements per step:**
  1. **Race details** — distance, elevation, terrain, race date
  2. **Race goal** (optional) — target finish time, competitive vs. relaxed intent
  3. **Athlete profile** — current fitness base, previous endurance experience, injury history
  4. **Current injuries** — structured input (diagnosis, restrictions, prescribed exercises)
  5. **Equipment & environment** — gym access, available equipment
  6. **Life context** — weekly time available, upcoming trips/races, sleep/stress baseline
  7. **Preferences** — cross-training preferences, other commitments
- **Wizard chrome:** progress indicator (dots or thin bar), back/next buttons, "save and
  exit" affordance, step titles that explain *why* the step matters in one sentence.
- **States:** Empty (first-time), in-progress (returning to a draft — stretch goal),
  generating plan (the final submit triggers a 5–15s Claude call — needs a great loading
  state, probably a multi-line "writing your plan…" affordance with rotating context).
- **Edge:** "Edit setup" entry point from home returns the user here pre-filled.

### D. Home — today + weekly strip (built — `/`, needs design polish)
- **Purpose:** The single most-used screen. Answer "what am I doing today, and where am I
  in the week?" in under 2 seconds.
- **Key elements:**
  - Today's workout(s) front-and-center — workout type, distance/duration, key targets
    (pace, HR zone, elevation), one-tap "Log done" and "Skip" actions
  - 7-day weekly strip — a horizontal row of day cards (M T W T F S S), each showing
    workout type icon + key metric, with prev/next/today nav
  - Quick-status pill at top: weeks until race, current training phase
    (base/build/peak/taper)
  - "Edit setup" and "Regenerate plan" affordances, but visually de-emphasised
- **States:**
  - **Empty** (no plan yet) — redirect to `/wizard` (already implemented)
  - **Rest day** — peaceful state, not a "nothing to do" feel
  - **Multiple workouts today** (run + gym) — stacked, with a visual distinction
  - **Today already logged** — done state with a subtle celebration affordance
  - **Mid-regeneration** — disable log buttons, show "updating your plan" banner
- **Mobile:** This is the primary mobile use case. Optimise for one-thumb operation.

### E. Workout drill-down (built — `/workout/[id]`, needs design polish)
- **Purpose:** Everything a user needs to know about a single workout before they do it,
  and a clear log action when they're done.
- **Key elements:**
  - Workout title + type
  - Date + day-of-week
  - Full details: distance, duration, elevation, pace/HR targets, structured intervals
    if applicable, gym sets/reps if it's a strength workout
  - "Why this workout" — Claude-generated paragraph explaining the purpose of *this specific
    session in the context of the user's plan* (not generic). Backlog feature.
  - Link to workout-type glossary entry
  - Log actions: "Mark done", "Mark skipped", "Add notes"
  - If logged: the logged state with notes shown, plus "Edit log" affordance
- **States:** Upcoming, today, logged-done, logged-skipped, missed (in the past, unlogged).

### F. Skip prompt — shift or leave? (backlog)
- **Purpose:** When a user marks a workout skipped, ask whether the rest of the plan should
  shift to accommodate (push the missed long run to Saturday) or leave the plan as-is
  (user did something else and is back on track tomorrow).
- **Key elements:** Modal/sheet. Clear two-option choice with a one-line explanation of
  each. Optional notes field ("why skipped — was tired / sick / injured / busy").
- **States:** Default, loading (if "shift" triggers a regeneration), confirmation.
- **Tone:** Non-judgmental. Skipping a workout is normal training.

### G. Modification / general notes (backlog)
- **Purpose:** A persistent free-text journal the user can use to record context Claude
  should consider on the next regeneration ("traveling next week", "feeling overtrained",
  "felt great today, ready for more volume").
- **Key elements:** Note list (date-sorted, newest first), add-note input, each note shows
  date + text + whether it's been "seen" by the next regeneration.
- **States:** Empty (first-time), populated, mid-regeneration (notes about to be consumed).

### H. Injury reporting (backlog)
- **Purpose:** Structured input that triggers a plan regeneration accounting for the injury.
- **Key elements:** Diagnosis (free text or autocomplete of common running injuries),
  affected body part(s), severity (mild/moderate/severe), pain on a 1–10 scale, restrictions
  ("no running for 2 weeks", "no impact"), prescribed exercises (free text, optional),
  expected return-to-running date (optional). Submit triggers a regeneration.
- **States:** Empty, partially filled (validate before submit), submitting (regeneration in
  progress), confirmed.
- **Tone:** This is a moment of distress. Calm, reassuring, brief.

### I. Physio notes (backlog)
- **Purpose:** Structured input from the user's physio that informs plan generation.
  In v1 the user enters these themselves; in v3 the physio gets their own login.
- **Key elements:** Diagnosis, restrictions (structured list), prescribed exercises with
  frequency/sets/reps, physio name + date (for record-keeping).
- **States:** Empty, populated (list of historical physio notes), editing a note.

### J. Workout-type glossary (backlog)
- **Purpose:** A static reference page explaining workout types (tempo, long run, intervals,
  hill repeats, easy / Z2, strength A/B, etc.) — what it is, what it does for the body,
  how to execute it well.
- **Key elements:** Searchable/filterable list of workout types. Each entry is a card with
  name, one-line definition, deeper explanation, "see example workout" link if any of the
  user's actual workouts use it.
- **States:** Default, search-active, individual entry view.

### K. Plan overview / calendar view (currently a weekly strip — opportunity to expand)
- **Purpose:** Zoom out from this week to see the full training block (e.g. 16-week build
  to race day). Useful for context but not the primary daily-use screen.
- **Key elements:** Month or block-level grid, training phase shading (base → build → peak
  → taper), race day marker, click-through to any individual workout. (Stretch) drag-and-drop
  workouts between days.
- **States:** Default, drag-in-progress (stretch), mid-regeneration.
- **Note:** This is a v2 nice-to-have, not v1 critical. Worth designing so we have a target.

### L. Settings / profile (not yet built)
- **Purpose:** Edit account info, unit preferences (km vs mi), notification preferences,
  data export, account deletion.
- **Key elements:** Account section (email, password change, connected providers like Google),
  preferences (units, locale, dark mode toggle), data (export plan as CSV/JSON, delete
  account), about (version, support link).
- **States:** Default, edit-in-progress, confirmation modals for destructive actions.

### M. Regeneration result / diff (backlog — important)
- **Purpose:** After a regeneration runs, show the user *what changed and why* before
  accepting it. The killer feature of "adaptive" is wasted if it's invisible.
- **Key elements:** Summary at top ("Shifted long run from Sat to Sun because of travel
  note", "Reduced weekly volume 15% due to injury report"), week-by-week diff view
  (changed workouts highlighted), accept / discard / regenerate-again actions.
- **States:** Loading (generation in progress), result view, accepted (with subtle
  confirmation), discarded.

---

## 6. Out of scope for first design pass

Don't bother designing these yet — they're future versions or parking lot:
- Social / share / leaderboard screens
- Coach/physio separate roles (v3)
- Wearable integration screens (Strava, Garmin)
- Payment / paywall
- Native mobile-specific affordances (push permission prompts, etc.)

---

## 7. How to prompt Claude Design step-by-step

Suggested order — design these first, in this sequence:

1. **D. Home — today + weekly strip** (most-used screen — design system emerges from here)
2. **E. Workout drill-down** (the second-most-used screen)
3. **C. Intake wizard** (the entry point — needs to feel inviting, not bureaucratic)
4. **M. Regeneration result / diff** (the differentiating moment — make this great)
5. **F. Skip prompt** (small but important UX moment)
6. **H. Injury reporting** (a structured form done well)
7. **G. Modification notes** (a journal pattern)
8. **K. Plan overview / calendar view** (zoom-out view)
9. **J. Workout-type glossary** (reference content pattern)
10. **I. Physio notes** (similar to H, reuses patterns)
11. **L. Settings** (last — by now the system is established)
12. **A. Landing page** (do this once the in-app aesthetic is locked in)
13. **B. Sign-in / sign-up** (uses the landing aesthetic)

After designing #1 and #2, **export the design system** Claude Design produces (colors, type,
spacing, components) and feed it back in as system context for every subsequent screen.
This is how we keep the whole app consistent.

---

## 8. Reference inputs to upload

When starting in Claude Design, attach or link:
- This brief
- `PROJECT_BRIEF.md` (full product context)
- `AGENTS.md` (tech constraints + the `frontend_aesthetics` section)
- Optionally: a screenshot of the current shipped home screen
  (`https://ultra-training-app.vercel.app`) so Claude Design has a "before" to react to
- Optionally: 2–3 mood-board images that match the trail/field-notebook aesthetic
  (a topographic map, a Patagonia catalogue page, a UltraSignup race page)
