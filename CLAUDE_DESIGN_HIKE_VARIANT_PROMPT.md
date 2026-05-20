# Claude Design prompt — Hike variant (Cross-training subtype with richer treatment)

Delta prompt to add to the existing Claude Design session. Adds a Hike-flavored
variant of the Cross-training card and drill-down page that gives hiking the
treatment it deserves for an ultrarunner audience.

---

```
Add a HIKE variant for the Cross-training card and workout drill-down page,
giving it a richer treatment closer to a long-run card. Same primary type
(Cross-training) and same general skeleton as established, but with
adaptations for what matters in a training hike.

WHY THIS VARIANT EXISTS

A training hike with 1,500m of vert over 4 hours is real training, not
recovery. The default cross-training card treatment (cycling, swimming)
emphasizes duration + perceived effort, which undersells what a vert hike
means to an ultrarunner training for UTMB. The Hike subtype emphasizes
vert, time-on-feet, and optional fueling — closer to a long-run card.

HIKE CARD (Today screen variant)

Same skeleton as other Cross-training cards (em-dash mono sub-label,
sans-serif title, mono data line, tap chevron), with these adaptations:

- Sub-label: "— CROSS-TRAINING · HIKE"
- Title: variable ("Trail Hike", "Vert Hike", "Recovery Hike") — the
  design should handle this gracefully without truncation
- Primary data line: "Z1–Z2 · ~4 hr · 18 km · +1,500m"
  Vert is given visual prominence (font-weight 500 in mono, larger size
  than other tokens, or a slight emerald tint) — it's the most important
  metric for a training hike
- Below the data line (above the divider), for hikes >3 hours: a fueling
  reminder secondary line: "Fuel ~80g carbs/hr · 1.5L water"
- Background motif: use the TOPOGRAPHIC RIDGE motif (the one used on
  Running cards), not the cycling wheel or swimming wave. The Hike is
  a trail activity and inherits the trail visual language. Same opacity
  (~16–20%), fading in from the right.

HIKE DRILL-DOWN PAGE (workout detail variant)

Same page structure as the other drill-down variants (back link → header
→ title → metrics → STRUCTURE → WHY → glossary link → LOG → NOTES →
sticky log actions). Adaptations:

- Title: "Trail Hike"
- Description: "Time on feet at vert. Hill-strength stimulus without
  the impact of running."
- Metrics row tiles: DURATION · DISTANCE · VERT · EFFORT · HR (optional)
  Vert tile gets the same visual prominence as on the card
- STRUCTURE: single block for most hikes, e.g., "4 hr · steady uphill
  effort · walking pace on climbs, easy jog on flats and descents"
  (For more structured Vert Hikes with specific climbs, structure
  can be broken into segments like Running)
- WHY (sample Claude output): "Your race profile has 10,040m of vert —
  most of it climbed at hiking pace. Today's hike conditions the legs
  for sustained climbing under fatigue, builds calf and glute endurance,
  and lets you practice mountain-pace fueling without the impact load
  of running. The vert matters more than the distance today."
- Glossary link: "Read more about training hikes →"
- LOG section fields:
  · Duration / time-on-feet — required input
  · Vert — numeric input, prominent
  · Distance — optional (some hikes are loops without distance tracking)
  · Avg HR — optional (Z1–Z2 typical for steady hikes; less critical
    than for tempo work, hence not required)
  · Perceived effort — 1–10 slider
  · Notes — free-text for terrain / weather / conditions

CONTENT TO USE

Sample data for State A (default, planned, not yet logged):
- Title: Trail Hike
- Description: "Time on feet at vert. Hill-strength stimulus without
  the impact of running."
- Metrics: DURATION ~4 hr · DISTANCE 18 km · VERT +1,500m · EFFORT Easy · HR Z1–Z2 (optional)
- Structure: single block — "4 hr · steady uphill effort · walking
  pace on climbs"
- Why: see sample above

DESIGN NOTES

- Topographic motif on the Hike card (NOT the cycling wheel or swimming
  wave) — Hike inherits the trail visual language from Running
- Vert is the most-prominent metric on Hike cards. On Running cards it's
  tertiary; on Hike cards it's primary alongside duration
- Fueling reminder appears only on hikes >3 hours, mirroring the long
  run card pattern
- The card title can vary ("Trail Hike", "Vert Hike", "Recovery
  Hike") based on subtype intent — design the card to handle variable
  titles without breaking layout
- Same em-dash mono section labels, Geist Sans + Geist Mono, emerald-500
  primary CTA
- Dark mode required

DELIVERABLE

Card variant on Today:
- 1 frame: Default Hike card (planned, not yet logged, with fueling
  reminder visible because it's a 4-hour hike) — mobile, light + dark
  = 2 frames

Drill-down LOG variant:
- 1 frame: Hike workout detail page, State A (default, not yet logged) —
  mobile, light + dark
  = 2 frames

Total: 4 frames.

If you have capacity, also produce a "Recovery Hike" card variant (2 hr,
+400m, no fueling line) to demonstrate the lighter end of the spectrum
— that's 2 additional frames (mobile, light + dark).
```

---

## How to use this prompt

1. Continue your existing Claude Design session.
2. Paste the prompt above as a new message.
3. Expect 4 frames (6 if Claude Design also produces the Recovery Hike variant).

## What this gives you

A clear differentiation between a Hike that's real training (4 hours, 1500m vert,
emphasized vert metric, fueling reminder) and a Hike that's recovery (2 hours,
modest vert, no fueling). Both still live under Cross-training as a subtype, so
the taxonomy stays at 5 primary types, but the visual treatment scales to match
the training significance.

If usage data ever shows hike-as-cross-training is the dominant pattern, we can
promote Hike to its own primary type in v2 without restructuring the data model.
