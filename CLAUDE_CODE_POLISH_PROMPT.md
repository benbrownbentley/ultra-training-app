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
- Any other "Vert" string in copy. Use word-boundary, case-sensitive
  search to avoid matching `convert`, `Vertical`, `revert`, etc.:
  `rg -w "Vert" --type ts --type tsx` (or `grep -rwn "Vert"
  --include="*.tsx" --include="*.ts"` excluding node_modules).

Do not rename file paths, component names, or class names that contain
"Vert" (e.g. VertLogo.tsx, .vert-* CSS classes). Those are internal
identifiers; only user-facing strings should use BRAND_NAME.

TASK 2 — VITEST SETUP
Install: npm install -D vitest @vitest/ui vite-tsconfig-paths

Add to package.json scripts:
- "test": "vitest run"
- "test:watch": "vitest"
- "test:ui": "vitest --ui"

Create vitest.config.ts at the repo root and include `vite-tsconfig-paths`
in the plugins array so `@/*` imports resolve in tests the same way they
do in Next.js. Without this, `import { ... } from "@/lib/plan"` will fail
to resolve in Vitest.

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
  IMPORTANT: use fixed, hand-authored fixture inputs only — no
  `new Date()`, no `Date.now()`, no current-date references. Snapshots
  must be deterministic or CI flakes on day boundaries.
- lib/journal.ts type discrimination: verify the discriminated unions
  parse correctly for each entry type.

Test file naming: alongside source (lib/plan-derive.test.ts).

Aim for 60–80% coverage on lib/, no coverage requirement on components
(UI tests come later via Playwright).

TASK 3 — PER-ROUTE ERROR BOUNDARIES
Add error.tsx files for the substantive route segments:

- app/error.tsx already exists — verify it has reasonable copy
- app/(auth)/error.tsx — for sign-in/sign-up errors. NOTE: a route-group
  error.tsx only catches errors thrown *inside* the group's segments,
  not errors thrown by the group's own layout. If `app/(auth)/layout.tsx`
  throws, the root `app/error.tsx` is what catches it. Plan copy
  accordingly.
- app/wizard/error.tsx — wizard form state currently lives in client
  React state and IS wiped when error.tsx renders. Do NOT promise
  "Your inputs are preserved" unless you also persist a draft to
  localStorage on each step transition. For v1, the honest copy is:
  "— SETUP · PAUSED — Something went wrong. Head back to the start
  and we'll get you set up." Persisting drafts is a v2 hygiene item.
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
- Wizard: "— SETUP · PAUSED — Something went wrong. Head back to the
  start and we'll get you set up." (Do not promise saved inputs unless
  draft persistence is implemented — see note above.)
- Workout/[id]: "— SESSION · NOT FOUND — This workout isn't in your
  plan. Head back to Today."

Include a small debug info line in mono at the bottom of each:
`ERROR · [route] · REQ #${randomShortId}` — useful for support.

TASK 4 — END-TO-END SMOKE TEST OF V2 AUTH (manual, document the steps)

Add docs/SMOKE_TEST_V2.md with a step-by-step checklist:

1. Sign-up with a new email. Do NOT use Mailinator or other public
   throwaway inboxes — anyone can read confirmation links during the
   test window. Use Gmail `+tag` addressing (e.g.
   `your.address+vert-test1@gmail.com`) or a private alias service
   like SimpleLogin or DuckDuckGo Email Protection.
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

CAVEAT: each Playwright run creates a real user in whatever Supabase
project the local `.env.local` points at. Until a separate staging
Supabase project exists (flagged in PROJECT_BRIEF.md deferrals), these
accumulate in the dev/prod-shared database. Add a TODO in the test
file: "Once staging env exists, point Playwright at it. Until then,
periodically purge `*+vert-test*@` users from Supabase Auth dashboard."
Use a recognizable email prefix in every test run so cleanup is easy.

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

## Carry-over items from the prompt 3 (form wiring) review

Fold these into the polish pass:

- **Verify `athlete_profile.user_id` has a unique constraint.** The new
  `upsertProfileColumn` helper uses `onConflict: "user_id"`. If no unique
  index exists, the upsert silently inserts duplicate rows on second call.
  Check existing migrations; if missing, add:
  `alter table athlete_profile add constraint athlete_profile_user_id_key unique (user_id);`
- **Preserve preference columns when the wizard re-runs.** `submitWizard`
  currently does delete-then-insert on athlete_profile, and the
  `profileRow` it builds doesn't include `theme`, `daily_reminder`,
  `regen_complete_notify`, `weekly_summary`. A user who sets Dark theme,
  then re-runs the wizard via `/wizard`, loses their preference. Fix:
  either (a) `select` the existing preference columns before the delete
  and merge into `profileRow`, or (b) switch submitWizard's
  athlete_profile write from delete-then-insert to `upsert`. Option (b)
  is cleaner.
- **Wrap `getAthleteProfile` in React's `cache()`** so the root-layout
  theme lookup and any same-render component reads share one DB roundtrip:
  `import { cache } from "react"; export const getAthleteProfile = cache(async () => { ... });`
  Hot-path optimisation; safe because the cache is per-request.
- **Add a unit test for `lib/units.ts` `formatPace`** specifically
  verifying the metric→imperial conversion lands at the expected value
  (5:00 /km → 8:03 /mi, etc.). The math is right but easy to break
  silently if someone refactors the constants.

## Carry-over items from the prompt 2 (missing routes) review

Fold these into the polish pass alongside the items above:

- **Split `app/_components/profile/AccountClient.tsx` (~600 lines) into focused
  files** under `app/_components/profile/account/`: `ChangeEmailForm.tsx`,
  `ChangePasswordForm.tsx`, `GoogleRow.tsx`, `SignOutAllConfirm.tsx`,
  `FormField.tsx`, `InlineError.tsx`, `InlineSuccess.tsx`. Pure mechanical
  refactor, no behavior change. AGENTS.md says "split if >150 lines."
- **Add a pre-check in `disconnectProvider`** for the "Google is your only
  sign-in method" case: if the user has no password set AND Google is the
  only identity, return a custom error like "Set a password first — Google
  is your only sign-in method." Avoids the cryptic Supabase error.
- **Move the 6-character password minimum to a shared constant** in
  `lib/auth-constants.ts` and reference it from both the client form
  validation and any server-side check. Single source of truth.
- **Show pending-email indicator on the Account page** after change-email
  is submitted: render the new email in the EMAIL DisplayRow above with a
  small "pending confirmation" pill. Otherwise the form clears and the
  user has no visual trace of their request.
- **Add a comment in `changeEmail` / `changePassword`** noting that the
  `signInWithPassword` re-auth call creates a fresh session as a side
  effect. Practically harmless (same user) but worth documenting so future
  changes don't trip on it.
- **Manual smoke tests to add to `docs/SMOKE_TEST_V2.md`**:
  - Change-email happy path (new email + current password → both inboxes
    receive a confirmation → click both → email updates)
  - Sign-out-all-devices (sign in on two browsers, trigger from one,
    verify the second is logged out on refresh)
  - Disconnect Google for an only-Google user (verify the pre-check error
    is friendly, not cryptic)
  - Race calendar past-race treatment (a race with `priority: 'A'` but
    a past date renders as COMPLETED + strikethrough)

## Status

This is the **final implementation prompt** in the v1 build sequence.
Prompts 1–3 (regen flow rewrite, missing routes, form wiring) are
already merged. After polish lands, the app is friend-ready and the next
work stream is v2 hygiene (staging environment, draft persistence in the
wizard, coverage thresholds, Supabase test-user cleanup automation).
