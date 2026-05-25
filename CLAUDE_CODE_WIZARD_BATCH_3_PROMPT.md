# Claude Code Prompt — Wizard Polish Batch (Commit 3 of 3)

Paste everything below the line into Claude Code in Warp. Self-contained.

---

## Your task

Implement **Commit 3** of the wizard polish batch — two changes that pair together as one commit on the existing branch `wizard-polish-batch`. The branch already has two commits landed by the Cowork agent:

- `1c78c42 feat: wizard layout & visual fixes` (items #1–4 — max-width, dark-mode contrast, +Add race buttons, day-chip checkmark spacer)
- `36cdc75 feat: wizard copy & convention audit` (items #6, #8, #10–12 — drop `· OPTIONAL` suffixes, extend strength to 5×, training-time helper copy, Skip-for-now on every step without required fields)

After this commit, the branch will be ready to push and open as a PR.

This work closes out **Phase 3 wizard polish** from the 2026-05-21 smoke-test findings + 2026-05-22 wizard flags. Items #1–6, #8, #10–12 already shipped on the same branch. This commit handles **#5, #7, #9**.

Full context lives in `PROJECT_BRIEF.md` → "Phase 3 — Remaining UX polish" → "Smoke-test findings (2026-05-21)" + "Wizard consistency findings (2026-05-21, continued)" + the 2026-05-22 entries.

## Required reading (in this order, before any code changes)

1. `AGENTS.md` — coding standards: well-commented code, no `any`, JSDoc on exports, shadcn/ui discipline, mobile-first responsive.
2. `PROJECT_BRIEF.md` → Phase 3 section, specifically:
   - "Smoke-test findings (2026-05-21)" — item: `'Generating your plan' flavour text` (this is #5)
   - "Wizard consistency findings (2026-05-21, continued)" — item: `Disabled-Continue needs a reason` (this is #9)
   - 2026-05-22 wizard flags — item: `Self-rated fitness field is too easy to miss` (this is #7)
3. `app/wizard/_components/WizardChrome.tsx` — the wizard shell. The disabled-Continue logic lives here (the `disabled` prop on the primary button); the inline validation messages will need to be plumbed through from `WizardClient.tsx`.
4. `app/wizard/_components/WizardClient.tsx` — `canAdvance` logic per step. Today this is a single boolean per step computed in `StepWrapper`. To surface per-field reasons, this needs to become a structured object (see below).
5. `app/wizard/_components/steps.tsx` — `FitnessStepBody` (the field with the prominence issue) and `RaceFieldGroup` + `AboutYouStepBody` (the steps with required fields that need inline validation).
6. `app/wizard/_components/form-bits.tsx` — `RangeField` + `FieldBlock` + `HelperText`. You'll likely add an `error` prop to `FieldBlock` and a new `FieldError` component.
7. `app/_components/generating/GeneratingPhaseState.tsx` — for the #5 verification check. The 2026-05-22 → 2026-05-25 hotfixes (commits `be2fbd1`, `fdff20c`, `01ca304`) already addressed flavour-text rotation timing and contrast. Read the file and confirm the smoke-test complaints ("low contrast, rotates too fast, cross-fade overlaps") no longer apply. If they don't, no code change needed for #5 — just note it in the commit body.

## Decisions already made (don't re-litigate)

These were settled with Ben in the Cowork planning session — implement them directly:

- **Required-field convention:** required fields use the green `*` via `FormSectionLabel`'s `required` prop. Already applied to: race name, race date, distance, age. Don't add or remove `required` props in this commit unless you find a truly-required field that's missing one.
- **Inline disabled-Continue validation:** the reason for a disabled Continue button appears inline under the blocking field (NOT as a tooltip on the button, NOT as a banner above the action bar). Standard form-validation UX.
- **Self-rated fitness prominence:** bigger label + larger slider thumb + visible step labels under the track (the 5 fitness levels rendered as small captions tied to slider positions). NOT a conversion to 5 chip buttons.

## Part 1 — Self-rated fitness prominence (item #7)

### The problem

`FitnessStepBody` in `steps.tsx` renders SELF-RATED FITNESS as a `RangeField` with the same tiny mono label every other field uses. During testing, Ben repeatedly scrolled past it without realising it was an interactive control. The field directly informs Claude's prescription, so missing it degrades plan quality. From `project_wizard_self_rated_fitness.md`.

### What to change

In `FitnessStepBody` only (don't touch other `RangeField` usages elsewhere unless it's a shared component change that benefits them too):

1. **Promote the label.** Replace the `FieldBlock` wrapper for the fitness field with a custom prominence treatment, or extend `FieldBlock` to accept a `prominent` prop. The promoted label should:
   - Use a heading-style size (around 14–16px instead of 10px)
   - Keep the mono uppercase styling and 0.2em letter-spacing (matches the rest of the app's visual language)
   - Maintain the existing emerald-7 / emerald-400 color treatment from the wizard eyebrow if it fits — this signals "important section"
   - Have noticeably more vertical whitespace above (so it visually separates from the previous field as a section break, not a line break)
2. **Enlarge the slider.** The current `RangeField` is the default browser range. Increase the slider's visual weight:
   - Larger thumb (target ~24px) — easier mobile tap target, more visually prominent
   - Thicker track
   - Keep the emerald accent color
   - Implementation note: native `<input type="range">` styling is platform-specific. You can either inline `accent-color` plus pseudo-element overrides via Tailwind's `[&::-webkit-slider-thumb]:size-6` etc., OR introduce a small custom Slider component. Either is fine — pick whichever produces cross-browser consistency without much extra weight.
3. **Show step labels under the track.** Render the 5 fitness levels (`FITNESS_LABELS` from `wizard-types.ts`) as small captions positioned under each slider notch:
   - Mobile: stack them readably or show only the current selection label below the slider in a larger/clearer treatment (since 5 captions under a small track will get cramped on a phone)
   - Desktop: try to render all 5 with the current one bolded/highlighted in emerald
   - The existing readout (`{data.fitnessRating} · {FITNESS_LABELS[data.fitnessRating - 1]}`) is fine to keep as the live confirmation; consider promoting it to a larger size right under the slider for added clarity

### Why not chip buttons

Ben considered converting to 5 large chip buttons but kept the slider for two reasons: (1) slider preserves the "spectrum" feel of a 1–5 rating (it's a scale, not a category), and (2) the change should be additive to existing visual language. Keep slider; make it impossible to miss.

### What NOT to do

- Don't make this a separate step / route. It belongs in the existing FITNESS step.
- Don't change `wizard-types.ts` — the data shape stays the same (a number 1–5).
- Don't apply the prominence treatment to other range-style fields (e.g., STRESS BASELINE). Stress is contextual; fitness is critical. Different importance, different treatment.
- Don't add validation to this field — it has a default of 3 and is always set.

## Part 2 — Inline disabled-Continue validation (item #9)

### The problem

In `WizardClient.tsx`'s `StepWrapper`, `canAdvance` is a single boolean per step. When false, `WizardChrome` renders Continue as `disabled` with no inline reason. Users from the 2026-05-21 smoke test got stuck wondering "what's wrong?" and had to manually scan back up the form. Mentioned in PROJECT_BRIEF.md → "Wizard consistency findings (2026-05-21, continued)" — `Disabled-Continue needs a reason`.

### Required validation rules (current state from the code)

These are the rules `canAdvance` currently encodes — keep them, and add a per-field reason for each:

- **Races step:**
  - Race name: required (non-empty after trim)
  - Race date: required (non-empty) AND in the future
  - Distance: required (non-empty after trim)
- **About step:**
  - Age: required AND > 0

The "in the future" check on race date is an addition (currently `canAdvance` only checks non-empty). Add it: training for a past race makes no sense, and the smoke test specifically called out this validation as an example use case.

### What to build

This is the biggest part of this commit. Aim for clean separation between validation rules and rendering:

1. **Define the validation shape.** A step's validation result is a map of field-key → error message (or no error). Something like:
   ```ts
   type FieldErrors<K extends string> = Partial<Record<K, string>>;
   ```
   Each step's validator returns this. The step "is valid" if the map is empty.

2. **Per-step validators.** Inside `WizardClient.tsx` (or factored to a small `lib/wizard-validation.ts` module if it gets long — your call), write pure functions that take the relevant `WizardPayload` slice and return field errors:
   ```ts
   function validateRaceStep(race: WizardRaceInput): FieldErrors<...>;
   function validateAboutStep(data: WizardPayload): FieldErrors<...>;
   ```
   `canAdvance` becomes `Object.keys(errors).length === 0`.

3. **Touched-field tracking.** Validation messages should NOT appear on fresh page load — that would yell at the user before they've done anything wrong. The standard pattern:
   - Track a set of "touched" fields per step (in `useState`)
   - A field becomes touched on blur (user typed/picked then moved away) OR when the user clicks the disabled Continue button (which marks ALL required fields touched at once so every error surfaces)
   - Only render a field's error message if the field is touched
   - Reset the touched set when the user moves to a new step

4. **Plumb the messages down.** `FieldBlock` in `form-bits.tsx` needs an `error?: string` prop. When set, render the message under the input in a red/amber tone matching the existing error styling (look at the error rendering near the bottom of `StepWrapper` for the color treatment — `text-red-700 dark:text-red-300`, `border-red-200 dark:border-red-900/60`). The message should be small (12–13px), not screaming.

5. **Make the disabled Continue button accessible.** Wire `aria-describedby` from the button to the first error message so screen-reader users get a reason too. (Bonus, not blocker — but cheap to add and #AGENTS.md cares about accessibility implicitly through shadcn/ui's defaults.)

### Suggested error copy

Keep messages friendly and specific. Examples:

- Race name empty: "We need a name to refer to this race."
- Race date empty: "Pick a race date."
- Race date in the past: "Race date must be in the future."
- Distance empty: "Add the race distance."
- Age empty/zero: "Age is required so the plan can scale appropriately."

Voice should match the rest of the wizard — friendly, athlete-vocabulary, no exclamation points, no emoji.

### What NOT to do

- Don't show the message immediately on first render. Wait for the user to interact (blur the field OR click the disabled Continue).
- Don't show it for fields the user hasn't visited yet (e.g., on a fresh races step, the user shouldn't see "Pick a race date" before they've even seen the field — though clicking Continue surfaces all of them at once, which is fine).
- Don't validate optional fields. The convention is `*` = required, no asterisk = optional. Optional fields can't be "invalid" in this batch (a future commit could add format validation, e.g., target-time format — but not now).
- Don't break the existing `error` rendering at the bottom of `StepWrapper` — that catches generation/API errors and uses similar red styling. The two are distinct: API errors at the bottom, validation errors inline.

## Part 3 — #5 verification (no code change expected)

Read `app/_components/generating/GeneratingPhaseState.tsx` and confirm the original smoke-test complaints about the flavour text — "low contrast, rotates too fast, cross-fade overlaps" — no longer apply after the 2026-05-22 → 2026-05-25 hotfixes (`be2fbd1`, `fdff20c`, `01ca304`).

If everything looks good, note this in the commit message body (e.g., "Item #5 verified — 2026-05-25 hotfix series addressed all three complaints"). If there's still a problem, surface it to Ben before changing anything — it might be a smaller fix or might warrant a separate spec.

## Final verification

Before committing:

```bash
npx tsc --noEmit                # must pass with exit 0
npm test                        # full vitest suite
npm run lint                    # if configured
npm run dev                     # local smoke pass
```

Local smoke pass should cover at minimum:

1. Fresh wizard run on Welcome → Races step. Click Continue with empty form — every required field's error should appear inline, Continue stays disabled.
2. Fill name + distance, leave date — only date's error surfaces. Fill a past date — "must be in the future" error appears. Fill a future date — error clears, Continue enables.
3. Skip Continue and just blur out of each field — error appears only on blur of empty required fields.
4. Reach the Fitness step. Self-rated fitness should be visually prominent (you can't miss it; the step label is big, the slider is big).
5. Reach the About step. Age has the same inline-validation behaviour.
6. Dark mode pass — toggle theme, check the error message contrast and the new prominent fitness label.
7. Run through the generating screen end-to-end and confirm the flavour text reads cleanly (no overlaps, readable contrast).

## Commit message template

```
feat: wizard fitness prominence + inline validation

Phase 3 polish batch — items #5, #7, #9.

- Promote SELF-RATED FITNESS field in the wizard's FITNESS step to a
  high-prominence section: larger label, larger slider thumb, step
  labels rendered under the track so the field reads as a clear
  interactive control rather than a line break. Closes the
  smoke-test finding that users repeatedly scrolled past it without
  noticing it was an input.

- Add inline disabled-Continue validation. canAdvance now returns a
  per-field error map; FieldBlock takes an `error` prop and renders
  the message under the input in red. Touched-field tracking keeps
  errors from showing on fresh load — they appear when the user
  blurs a field empty or clicks the disabled Continue button.
  New rule: race date must be in the future.

- Verified item #5 (generating flavour text) — the 2026-05-22 to
  2026-05-25 hotfix series (be2fbd1, fdff20c, 01ca304) already
  addressed low contrast / fast rotation / cross-fade overlap. No
  code change needed.

Files touched: WizardChrome.tsx, WizardClient.tsx, steps.tsx,
form-bits.tsx, [optionally] lib/wizard-validation.ts.

Closes wizard portion of Phase 3 polish (items #1-#12 from the
2026-05-21 smoke-test findings + 2026-05-22 wizard flags). Item #13
(auto-login after email verify) is auth-flow scope and queued for
the separate auth-gaps PR.
```

## When you're done

1. Commit on the existing `wizard-polish-batch` branch.
2. Push the branch to origin.
3. Open a PR titled `Phase 3 wizard polish — items #1-#12` against `main`. Suggested body:
   ```
   Three commits on this branch close out the wizard portion of Phase 3:

   - Layout & visual fixes (max-width, dark-mode contrast, race-button affordance, day-chip checkmark spacer)
   - Copy & convention audit (drop · OPTIONAL suffixes, extend strength to 5×, training-time helper copy, Skip-for-now on every step without required fields)
   - Fitness prominence + inline disabled-Continue validation

   Closes 12 items from the 2026-05-21 smoke-test findings and 2026-05-22 wizard flags. Auto-login-after-email-verify (#13) is auth-flow scope; it'll land in a separate auth-gaps PR.
   ```
4. Hand the PR URL back to Ben for review/merge.
