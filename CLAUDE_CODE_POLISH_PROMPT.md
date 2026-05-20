# Claude Code prompt — Polish, brand, tests, error boundaries

The smaller-but-important items. Brand centralisation, Vitest setup, per-route
error boundaries, smoke-test of the end-to-end auth flow. ~1–2 days of work.

---

```
Wrap up the v1 build with brand centralisation, testing infrastructure,
error resilience, and end-to-end verification.

TASK 1 — BRAND CENTRALISATION
Create lib/brand.ts with:

```typescript
// "Vert" is a working name. The brand will change before v2 public
// launch. Reference BRAND_NAME everywhere the app shows its name in
// user-facing surfaces. When the rename happens, update this file
// and the change propagates throughout the app.
export const BRAND_NAME = "Vert";
export const BRAND_TAGLINE = "Adaptive training for endurance athletes";
```

Then find every hardcoded "Vert" string and replace with the constant:

- app/_components/today/icons.tsx (VertLogo wordmark text) — change the
  hardcoded "VERT" to `{BRAND_NAME.toUpperCase()}` so the SVG text uses
  the constant. Note: the VertLogo SVG ridge GEOMETRY stays — that's the
  visual mark, decoupled from the wordmark.
- app/profile/page.tsx (footer "VERT · 2026 BLOCK") — use
  `${BRAND_NAME.toUpperCase()} · 2026 BLOCK`
- app/layout.tsx (metadata.title and metadata.description) — use
  `${BRAND_NAME} — ${BRAND_TAGLINE}` or similar
- Any other "Vert" string in copy (search the codebase: `grep -ri "vert"
  --include="*.tsx" --include="*.ts"` excluding node_modules)

Do not rename file paths, component names, or class names that contain
"Vert" (e.g. VertLogo.tsx, .vert-* CSS classes). Those are internal
identifiers; only user-facing strings should use BRAND_NAME.

TASK 2 — VITEST SETUP
Install: npm install -D vitest @vitest/ui

Add to package.json scripts:
- "test": "vitest run"
- "test:watch": "vitest"
- "test:ui": "vitest --ui"

Create vitest.config.ts at the repo root pointing at the project's tsconfig.

Write unit tests for the pure functions that are most likely to grow
complex:

- lib/plan-derive.ts: test buildPlanWeeks for the canonical 18-week
  block, edge cases (race date is today, plan is empty, plan spans
  more than one phase). Test the phase inference helpers.
- lib/units.ts (created in the Form Wiring prompt): test all
  conversion functions both directions, edge cases (0, very large
  numbers, string vs number inputs)
- lib/utils.ts: test addDays, daysBetween, weekStart for DST,
  end-of-year, leap years
- lib/claude.ts formatters (formatHistory, formatProfile, formatRace,
  formatJournal, buildUserPrompt): give them sample inputs, verify
  the output is the expected string structure. Snapshot tests are fine
  here — these are about ensuring the prompt doesn't silently change.
- lib/journal.ts type discrimination: verify the discriminated unions
  parse correctly for each entry type.

Test file naming: alongside source (lib/plan-derive.test.ts).

Aim for 60–80% coverage on lib/, no coverage requirement on components
(UI tests come later via Playwright).

TASK 3 — PER-ROUTE ERROR BOUNDARIES
Add error.tsx files for the substantive route segments:

- app/error.tsx already exists — verify it has reasonable copy
- app/(auth)/error.tsx — for sign-in/sign-up errors
- app/wizard/error.tsx — wizard errors should preserve form state
  when possible; if not possible, copy should say "Your inputs are
  preserved — try again."
- app/regen/error.tsx — falls back to a "Regeneration failed" with
  Try Again button
- app/journal/error.tsx
- app/profile/error.tsx
- app/plan/error.tsx
- app/workout/[id]/error.tsx

Each error.tsx is a client component receiving { error, reset } props.
Use the "athletic-vocabulary" error framing from PROJECT_BRIEF.md:
"REST DAY" pattern. E.g., for /regen/error.tsx:
"— REGENERATION · REST DAY — Looks like our servers are having a rest
day. Your plan is safe and unchanged. Give us a minute — we'll be
back at it shortly." plus Try Again CTA.

For other error pages, adapt the framing:
- Wizard: "— SETUP · PAUSED — Something went wrong setting up your
  plan. Your inputs are saved — try again."
- Workout/[id]: "— SESSION · NOT FOUND — This workout isn't in your
  plan. Head back to Today."

Include a small debug info line in mono at the bottom of each:
`ERROR · [route] · REQ #${randomShortId}` — useful for support.

TASK 4 — END-TO-END SMOKE TEST OF V2 AUTH (manual, document the steps)

Add docs/SMOKE_TEST_V2.md with a step-by-step checklist:

1. Sign-up with a new email (use a Mailinator address or similar)
2. Verify email confirmation flow works
3. Land on /wizard, complete it end-to-end (race + B/C + fitness +
   experience + about + health + schedule + equipment)
4. See plan generating state, see today screen
5. Log a workout done
6. Tap REGEN, type a note, verify preview generates, accept it,
   verify journal entries flip to "SEEN"
7. Navigate to Plan, Journal, Profile — verify all pages render
   with real data
8. Edit athlete profile — change weekly volume, save, verify
9. Edit a race — change priority from A to B, save, verify
10. Add a B race, save, verify it shows in calendar
11. Sign out from Profile → Account
12. Sign in again — verify session restored, today screen still shows
    the user's plan
13. Open a fresh browser/incognito, sign up with a SECOND account
14. Verify the second account sees NO data from the first (isolation)
15. From account 1, regen the plan — verify journal entries flip
    correctly, no leakage to account 2
16. Delete account 2 from Profile → Account → Delete account flow
17. Verify account 2 can no longer sign in

Run through this checklist locally first, then on production after
deploy. Document any failures in PROJECT_BRIEF.md's
"V2 finishing work" section.

TASK 5 — PLAYWRIGHT E2E HAPPY PATH (after smoke test passes)

Install: npm install -D @playwright/test
Run: npx playwright install

Create e2e/wizard-and-log.spec.ts that automates the core happy path:

- Sign up with a unique email each run
- Complete the wizard (programmatically fill all fields)
- Land on Today, verify a plan is shown
- Mark today's workout done
- Trigger a regen with a note
- Verify the preview appears, accept it
- Verify the workout is marked DONE on today

This is the "if anything is regressing, this catches it" test. Add it
to CI via GitHub Actions if you have a CI setup, otherwise run it
locally before each deploy.

TASK 6 — DOCUMENTATION

Update PROJECT_BRIEF.md:
- Move "Pre-v2 hygiene flagged but not yet done" items to "Resolved"
  if any of the above tasks complete them (specifically: Playwright E2E
  if you do the Playwright task, smoke test if you complete that)
- Update the "Current state" section to reflect what's now wired
- Update the "v1 polish" backlog — remove items that are now done

Update CLAUDE.md / AGENTS.md if you introduced any new patterns that
future agents should know about (e.g., the preview+commit pattern from
the regen flow rewrite, the lib/units.ts conversion layer, the lib/brand.ts
centralisation).

CONSTRAINTS
- Tests should run fast (<10 seconds total for the unit suite)
- Don't add coverage thresholds yet — that's a v2 hygiene item
- Don't mock Supabase in tests; the pure lib/ functions don't need a
  database. Component tests can come later.

VERIFICATION CHECKLIST
- npm run lint, npm run build, npm run test all green
- BRAND_NAME constant is the only "Vert" in user-facing copy
  (grep for hardcoded strings to confirm)
- Trigger each error scenario (kill network, send a bad workout id,
  etc.) and verify the right error.tsx renders with the right framing
- Walk through SMOKE_TEST_V2.md end to end on local; document any
  failures
- Playwright test passes locally
```

---

## Order of execution

The four prompts can be done in this order:

1. **Regen flow rewrite** first — most architecturally significant, and other
   work assumes the preview+commit pattern exists
2. **Missing routes** second — once the regen flow stabilises, these are
   independent pieces that can be done in parallel sessions
3. **Form wiring** third — depends on missing routes being scaffolded (the
   account preferences route is one of the targets)
4. **Polish** last — brand, tests, error boundaries, smoke tests. After this
   you can hand the app to friends.

Estimated total: ~1 week of focused work for prompts 1–3, then another
3–4 days for the polish prompt depending on how thorough you want to be on
tests.
