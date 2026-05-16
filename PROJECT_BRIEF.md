# Ultra Marathon Training App — Project Brief

_Last updated: 2026-05-16_

---

## The problem

Existing training plans don't work for Ben: they get stuck in Excel sheets, are hard to follow
day-to-day, and don't adapt as the runner's situation changes during training. Ben has built many
plans that died this way.

## The vision

A web app that generates an adaptive ultra marathon training plan — daily gym + running — and
modifies itself as the user logs progress, using an LLM to generate, regenerate, and refine.

## Users

- **v1:** Just Ben (single user, no auth)
- **v2+:** Public sign-ups, each user gets their own private plans

---

## Product decisions (locked in during kickoff session, 2026-05-15)

- **Entry point:** An intake wizard collects race goal + athlete profile + constraints before
  generating a plan. This replaces the earlier "hardcoded plan" step.
- **Activity scope:** Endurance sports only. Ultra running in v1. Marathon / ironman / ultra
  cycling added in a future version using the same data model.
- **Workout explanations:** Static glossary for workout types + Claude-generated per-workout
  "why" explaining the purpose of each specific session (Option C of three considered).
- **Physio notes:** Structured input (diagnosis, restrictions, prescribed exercises) in v1.
  Physio as a separate user role with its own login is a v3 feature.
- **Drag-and-drop rescheduling:** Stretch goal for v1. Deferred to v2 if it adds complexity.
- **LLM strategy:** Anthropic Claude is the default for v1 and v2. Fine-tuning / SLM /
  open-source alternatives are parked in the future backlog.
- **Analytics:** PostHog wired in for v2.

---

## Tech stack

| Layer          | Choice                    | Why                                                        |
|----------------|---------------------------|------------------------------------------------------------|
| Framework      | Next.js + TypeScript      | Modern React framework; file-based routing; industry standard |
| Styling        | Tailwind CSS              | Utility-first; fast iteration; modern defaults             |
| Components     | shadcn/ui                 | Free, high-quality primitives built on Tailwind            |
| Database + Auth| Supabase                  | Postgres + auth + storage in one; generous free tier       |
| LLM            | Anthropic API (Claude)    | Plan generation and regeneration                           |
| Hosting        | Vercel                    | Free tier; auto-deploys from GitHub; built by the Next.js team |
| Version control| GitHub                    | Industry standard                                          |
| Dev tool       | Claude Code               | Terminal-based agentic coding for the build phase          |

---

## Intake wizard — field spec

The wizard runs once per plan (or when the user wants to generate a new one).
These are the inputs Claude uses to generate a personalised plan.

**Race details**
- Distance, elevation, terrain

**Race goal** (optional)
- Target finish time (soft input — courses vary too much to be precise)
- Competitive vs. relaxed intent / effort level

**Athlete profile**
- Current fitness base
- Previous endurance experience (first ultra? marathons? veteran ultrarunner?)
- Injury history
- Current injuries

**Equipment & environment**
- Gym access and available equipment (treadmill, indoor trainer, weights, etc.)

**Life context**
- Weekly time available for training
- Upcoming trips or events that will disrupt training
- Upcoming races
- Sleep and stress baseline (free text in v1; may structure later)

**Preferences**
- Cross-training preferences (cycling, etc.)
- Other commitments to work around

---

## Roadmap

### v1 — Personal MVP (single user, just Ben)
Goal: a deployed app that's actually useful for one ultra marathon training cycle.

- [ ] Hello World deployed on Vercel
- [ ] Intake wizard: race + athlete profile + constraints
- [ ] Plan generation via Claude API from wizard inputs
- [ ] Calendar view + list view with drill-down on each workout
- [ ] Workout-type glossary + per-workout "why" from Claude
- [ ] Daily tracker (mark done / skipped, log notes)
- [ ] Skip workout → prompt "shift plan or leave?"
- [ ] Report new injury mid-cycle → regenerate plan
- [ ] Structured physio notes input (diagnosis, restrictions, exercises)
- [ ] General adjustment notes (free text)
- [ ] Manual regenerate button
- [ ] Database connection (Supabase persistence)
- [ ] (Stretch) Drag-and-drop workouts between days

### v2 — Public launch
Goal: anyone can sign up and use it.

- [ ] Auth via Supabase (email + Google)
- [ ] Multi-user isolation — each user's plans are private
- [ ] Onboarding flow for new users
- [ ] Drag-and-drop (if deferred from v1)
- [ ] PostHog analytics wired in
- [ ] Basic landing / marketing page

### v3 — Mobile polish + role expansion
Goal: feels native on phone; supports a coach/physio role.

- [ ] PWA installable to home screen
- [ ] Offline workout viewing
- [ ] Push notifications for daily workout reminders
- [ ] Mobile-first responsive review of every screen
- [ ] Physio user role: separate login, can add structured notes directly
- [ ] Additional endurance sports (marathon, ironman, ultra cycling) using same data model

### Future / parking lot

- Wearable integrations (Strava, Garmin, Apple Health)
- Social features (share plans, follow other runners)
- Coach mode (one coach managing multiple athletes)
- Monetization (premium tier, white-label for coaches)
- Periodization templates (block, polarized, pyramidal)
- LLM alternatives (fine-tune Claude / own SLM / open-source models)

---

## Build order

Every step ends with a live deploy so the loop becomes routine.

1. Hello World deployed on Vercel
2. Intake wizard UI (static, no backend yet)
3. Database connection (Supabase) — schema + migrations
4. Claude API generates a plan from wizard inputs
5. Calendar + list view of the generated plan
6. Workout logging — write completions, skips, notes to DB
7. Plan regeneration from accumulated logs
8. Auth + multi-user (v2)
9. Mobile / PWA polish (v3)

---

## Out of scope (for now)

- Native iOS/Android apps
- Social features (sharing plans, leaderboards, comments)
- Wearable integrations (Strava, Garmin, Apple Health)
- Payment / paywall
- Coach mode
- Non-endurance sports

---

## Setup completed (2026-05-15)

- [x] GitHub account + repo created
- [x] Vercel connected to GitHub (auto-deploys on push)
- [x] Supabase account created
- [x] Anthropic API key created (stored locally in `.env.local`, never committed)
- [x] Node.js, Warp, Git, VS Code, Claude Code installed (Claude Code v2.1.143 verified)
- [x] Next.js + TypeScript + Tailwind scaffolded
- [x] Notion project workspace set up

---

## Key notes for agents

- The Anthropic API key is in `.env.local` — never commit it, never hardcode it.
- Warp's inline agent is separate from Claude Code — Claude Code is the full dev agent.
- Notion is used as a human-readable project hub. The canonical source of truth for
  product decisions and build status is this file.
