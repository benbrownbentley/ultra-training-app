# Inspiration Notes — Vert.run & Ascent Training

_Reviewed: 2026-05-18 — for Ben's review before adding to PROJECT_BRIEF.md_

---

## TL;DR — three things to read first

1. **Naming conflict.** "Vert" is the established brand of Vert.run (130K+ users, trail/ultra niche). Continuing to use it for a public product is going to cause trademark and SEO problems. Recommend renaming.

2. **Direct competitor exists and uses Claude.** Ascent Training (ascenttraining.app) is the same concept as ours: AI-powered adaptive endurance training, explicitly built on Claude AI, multi-sport (run/bike/triathlon). They're in pre-launch beta with a Spring 2026 release. This doesn't kill the project, but it means we're not first and we should think about differentiation.

3. **The space is validated.** Two viable products in adjacent niches confirms the problem is real and people will pay for it. Vert.run is at $9.90–$33/mo and has 130K paying users. That's a healthy signal.

---

## Competitive snapshot

| | Vert.run | Ascent Training | Our Project |
|---|---|---|---|
| **Stage** | Mature, 130K users | Pre-launch beta (Spring 2026) | Learning build |
| **Niche** | Trail / ultramarathon | Multi-sport endurance (run/bike/tri) | TBD |
| **AI?** | "AI Coach" tier ($9.90) | Yes — Claude AI explicitly | Yes — Claude API |
| **Human coaches?** | Yes ($33 tier + marketplace) | No | No (probably) |
| **Adapts to missed workouts** | Yes | Yes | Yes (planned) |
| **Integrations** | Garmin, Coros, Apple, Strava, ITRA | Strava, Garmin, Apple Health | TBD |
| **Signature metric** | "Mountain Index" | CTL/ATL/TSB (standard) | None yet |
| **Differentiator** | Real human coaches + pro-athlete plans | Apple Health depth + community-driven dev | TBD |
| **Pricing** | $9.90 / $33 / $120-yr tiers | Not disclosed | N/A |

---

## Combined feature inspiration — ranked by fit for our project

### Tier 1 — Strong fit, recommend adopting in some form

**1. A signature proprietary metric.**
Vert has the "Mountain Index" — a single number that headlines progress. It's both a UX win (one thing for users to obsess over) and a marketing/PR moat. Ascent uses standard CTL/ATL/TSB, which is more credible to advanced athletes but boring to newcomers. We could thread the needle: surface a friendly headline metric ("Endurance Index" or similar) that's internally calculated from real metrics.

**2. "Explain the why" coaching pattern.**
Ascent puts this front-and-center: "Ask anything: 'Why tempo today?' 'Race strategy?'" This is a natural Claude API use case and a real differentiator from rigid plan apps like TrainingPeaks. *Worth designing into the core UX from v1, not bolting on later.*

**3. Adaptive replanning on missed workouts.**
Both apps demo the same scenario: "I missed my long run yesterday because of work" → AI replans automatically. This is the table-stakes feature for "adaptive" training apps. We've already scoped this — Ascent's chat mockup is a useful UX reference for *how* to present the adaptation conversationally.

**4. Race priority system (A/B/C).**
Ascent's "Multi-Event Planning with A/B/C priority" is a well-known framework from coaching literature. Lets a user say "Boston Marathon is my A race, the half in April is B." The AI then peaks the user for the A race and treats B/C as tune-ups. Good v2 feature — probably out of scope for v1, but worth noting in the data model so we don't paint ourselves into a corner.

**5. Onboarding via data sync, not a questionnaire.**
Ascent's flow: connect Strava/Garmin/Apple Health → AI analyzes history → produces a plan. This is *far* better UX than a 20-question wizard. Even if we start with a wizard for v1, we should plan to add a Strava connection that prefills the wizard.

### Tier 2 — Good fits, lower priority

**6. Plan templates / "train like an athlete" library.**
Vert has plans by named pros (Pau Capell, Hillary Allen, etc.). For us, this could be unbranded templates: "Sub-3 marathon," "First 50K," "Recover from injury." Useful for onboarding (give the user a starting point before deep personalization) and for marketing pages.

**7. Hybrid AI + human-review trust mechanic.**
Vert's PRO tier ($9.90) is AI but every plan is "reviewed by a real human coach within the first 24 hours." Brilliant trust hack — solves "can I trust an algorithm with my training?" cheaply. We can't do this without coaches, but the *pattern* of a review step (even just the user reviewing the plan before it's "active") is worth designing in.

**8. Strava/Garmin/Apple Health from day one in the data model.**
Both apps integrate with all three. We don't need to build all three for v1, but the data model for "completed activity" should support multiple sources (manual, Strava webhook, Garmin import, Apple Health). Easy to get this right early, painful to retrofit.

**9. Free utility microsites.**
Vert has nutrition.vert.run, race.vert.run, and Replit-hosted tools (coach matcher, plan generator). These are free standalone calculators that funnel to the paid app. Cheap SEO play. Future opportunity once we have the main app working — *not v1*.

### Tier 3 — Interesting but probably skip

**10. Human coach marketplace** (Vert). Operations-heavy, not a learning-project fit.

**11. Physical merch / Run Club tier** (Vert). Logistics overhead.

**12. ITRA-style race result verification.** Vert has it for trail/ultra. Would need partner relationships. Cool, not necessary.

---

## Positioning observations

**Both competitors lean hard on the same value props:**
- "Adapts to your life" / "Adapts to recovery"
- "Why behind the workout"
- "Coach in your pocket"
- "Real-time adjustments"

Ascent literally lists the same anti-pitch you've described: "Generic templates that assume you're 'average,' static plans that don't change when life happens, missed workouts = guilt and confusion, expensive coaches ($200–400/month), no one to ask 'why?' at 6am."

**This means our positioning needs to find an angle they're not using.** A few options to think about:

- *Strength + cardio combined.* Vert mentions injury prevention but it's not central. Ascent doesn't touch it. Endurance athletes underdo strength work — there's a real gap.
- *Audio-first or wearable-first UX.* Both competitors are visual/dashboard apps. A "voice in your ear during the workout" angle could differentiate.
- *Pure beginner focus.* Both target people already racing. A "first 5K to first marathon" path for total beginners is underserved.
- *Specific sport.* Cycling-only or swim-only would let us go deeper than multi-sport apps.
- *Habit / consistency over performance.* Most apps optimize for race time. A subset of users just want to "run 3x a week without injury" — different product.
- *Open data / portable plans.* Export to TrainingPeaks/Final Surge formats. Power-user appeal.

You don't need to decide today, but it's worth being intentional about *which* of these (if any) we lean into, because it shapes the wizard, the metrics we surface, and the marketing.

---

## What I'd recommend adding to PROJECT_BRIEF.md (your call)

**Decisions needed:**
- [ ] Rename the project (away from "Vert")
- [ ] Choose a differentiation angle (or explicitly defer)
- [ ] Confirm scope: running only, multi-sport, or sport-agnostic at the data layer

**Design ideas to capture (parking lot, not commitments):**
- [ ] Signature headline metric ("Endurance Index") computed from underlying CTL/ATL/TSB
- [ ] "Explain why" chat surface designed into the workout view from v1
- [ ] Race priority field (A/B/C) on the goal model — even if UI doesn't expose it in v1
- [ ] Activity-source field in the data model from day one (manual/Strava/Garmin/Apple)
- [ ] Plan templates concept for onboarding (post-v1)
- [ ] User "review/approve" step before a generated plan becomes active

**Future roadmap parking lot:**
- [ ] Strava integration (probably first integration after manual logging works)
- [ ] Free utility microsite (e.g., race time predictor) for SEO
- [ ] Strength/injury-prevention module — yes or no?

---

## Open questions for you

1. **Rename:** want me to do a quick name-availability scan (domain + app stores + trademark) on 5–10 candidates? Or hold off until later?
2. **Differentiation angle:** any of the angles above land with you, or do you want to brainstorm more?
3. **Scope:** single sport (running) for v1, or design the data model to be sport-agnostic from the start?

Once you've decided, I'll fold the chosen items into PROJECT_BRIEF.md and Notion.

---

## Sources
- [Vert.run homepage](https://vert.run/)
- [Ascent Training homepage](https://www.ascenttraining.app/)
