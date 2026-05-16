# Ultra Marathon Training App — Project Brief

_Last updated: 2026-05-15_

## The problem
Existing training plans don't work for Ben: they get stuck in Excel sheets, are hard to follow day-to-day, and don't adapt as the runner's situation changes during training. Ben has built many plans that died this way.

## The vision
A web app that generates an adaptive ultra marathon training plan — daily gym + running — and modifies itself as the user logs progress, using an LLM to generate, regenerate, and refine.

## Users
- **v1:** Just Ben (hardcoded, no auth)
- **v2+:** Public sign-ups, each user gets their own private plans

## Core features
- Generate a personalized training plan via Claude (LLM)
- Daily workout view (today's gym + run)
- Workout logging (completed, skipped, notes/feel)
- Adaptive regeneration — plan evolves based on logged data
- Mobile-friendly responsive web app (PWA later, no native app)
- User accounts (v2)

## Out of scope (for now)
- Native iOS/Android apps
- Social features (sharing plans, leaderboards, comments)
- Wearable integrations (Strava, Garmin, Apple Health)
- Payment / paywall

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js + TypeScript | Modern React framework; file-based routing; industry standard |
| Styling | Tailwind CSS | Utility-first; fast iteration; modern defaults |
| Database + Auth | Supabase | Postgres + auth + storage in one; generous free tier |
| LLM | Anthropic API (Claude) | Plan generation and regeneration |
| Hosting | Vercel | Free tier; auto-deploys from GitHub; built by the Next.js team |
| Version control | GitHub | Industry standard |
| Dev tool | Claude Code | Terminal-based agentic coding for the build phase |

## MVP (v1 — just for Ben)
1. Enter race goal (date, distance) and current fitness baseline
2. Generate plan via Claude API
3. View today's workout + this week's plan
4. Log completed workouts with notes
5. Regenerate plan based on logs

## Roadmap
- **v1** — Single user (Ben), MVP features above, deployed live
- **v2** — Auth + multi-user, public sign-ups, private plans per user
- **v3** — Mobile polish (PWA install, offline support, push notifications)
- **Future** — Wearable integrations, social features, monetization

## Build order
Every step ends with a live deploy so the loop becomes routine.
1. Hello World deployed on Vercel
2. Static training plan display (hardcoded data)
3. Database connection (Supabase) — load plan from DB
4. Workout logging — write to DB
5. Claude API generates a plan
6. Plan regeneration from accumulated logs
7. Auth + multi-user (v2)
8. Mobile/PWA polish (v3)

## Accounts to create before we start coding
- [ ] GitHub
- [ ] Vercel (sign in with GitHub)
- [ ] Supabase
- [ ] Anthropic API key (console.anthropic.com)
- [ ] Install Node.js (LTS), VS Code, Git
- [ ] Install Claude Code
