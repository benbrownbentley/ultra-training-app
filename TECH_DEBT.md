# Tech Debt

Items deferred from code review or development sessions. Work through these before each major version ships.

---

## 🔴 Fix before v2 launches (security / correctness)

### TD-011 — Unskip button on Today card is a no-op (regression) — ✅ RESOLVED 2026-05-26
**What:** The Unskip button on a skipped Today card was wired to `onClick={onSkip}` (`app/_components/today/WorkoutCard.tsx:379`), which called `setStatus("skipped")` — the card is already skipped, so the click did nothing. No `onUnskip` handler existed.
**Why deferred:** Surfaced by Ben's smoke test on 2026-05-25 after the Phase 3 polish batch merged. Real regression introduced by that batch (`782fcae` or `85a205e` — likely the latter when the skipped variant was reorganized for the C15 + ADD NOTE work).
**Resolved:** Fixed on branch `phase-3-polish-round-2` (Phase 3 polish round 2). Added `onUnskip` + `onAddNote` props to `CardFooter`; the skipped variant's Unskip button now calls `setStatus("pending")` — the un-skipped status per `lib/plan.ts:8` (`WorkoutStatus = "pending" | "completed" | "skipped"`), **not** `"scheduled"` as the original fix note guessed. Silent revert (no toast); the card re-renders as the `upcoming` variant with Log done / Skip restored.

### TD-001 — Migrate `lib/supabase.ts` to `@supabase/ssr`
**What:** The read client uses `createClient` from `@supabase/supabase-js` directly. For Supabase Auth in v2, both the browser and server clients need to use `@supabase/ssr` (`createBrowserClient` / `createServerClient`) so session cookies are handled correctly.
**Why deferred:** This is part of the v2 auth architecture — doing it in isolation risks getting it wrong. Design it in the auth planning session, then implement as the first step of v2.
**Reference:** `AGENTS.md` already has the correct code patterns for both clients.

### TD-002 — Add RLS write policies to all tables
**What:** Supabase RLS is enabled but only `for select` policies exist. All writes currently bypass RLS via the service-role key. For v2, users need INSERT/UPDATE/DELETE policies scoped to their own `user_id`.
**Why deferred:** Needs to be designed alongside the v2 data model (every table gets a `user_id` column). Part of the auth planning session.

### TD-003 — Add Zod runtime validation to all server actions
**What:** Server actions (`submitWizard`, `logWorkout`, `regeneratePlan`) accept typed inputs but do no runtime validation. TypeScript types disappear at runtime — malformed or malicious inputs reach the DB unchecked.
**Why deferred:** Requires installing Zod, defining schemas for all action payloads, and adding parse calls. Real effort — deserves a focused session, not a quick patch.
**Files to touch:** `app/actions.ts`, potentially a new `lib/schemas.ts`.

---

## 🟡 Fix before next major feature

### TD-004 — Protect `submitWizard` with a transaction
**What:** The wizard submission does: delete race → insert race → delete profile → insert profile. If any insert fails after a delete, data is lost with no recovery path.
**Why deferred:** Proper fix requires a Supabase RPC (stored procedure) to wrap operations in a transaction. Not a one-liner.
**File:** `app/actions.ts` → `submitWizard()`

---

## 🟡 Fix before public launch

### TD-007 — Password reset flow — ✅ RESOLVED 2026-05-27
**What:** The "Forgot?" link in `components/auth/auth-split.tsx` goes to `href="#"` — a dead link. Needs a `/forgot-password` page that calls `supabase.auth.resetPasswordForEmail()` and a `/reset-password` page that handles the email link callback.
**Why deferred:** No users yet. Must exist before v2 public launch.
**Resolved:** Shipped in the auth-flow polish batch on branch `auth-flow-polish` (commit `610d29b`; PR opened from `auth-flow-polish` → `main`). The dead `href="#"` now points at `/forgot-password`. Two routes: `/forgot-password` (`requestPasswordReset`, anti-enumeration) and `/reset-password` (client-side `verifyOtp` to establish the recovery session, then `completePasswordReset` to set the new password). Both compose the new shared `AuthShell`; middleware allows both unauthenticated and keeps `/reset-password` reachable during the recovery session. The remaining four batch items (show/hide toggle, password strength rules, email-collision fix, auto-login after verify) shipped in the same PR — see `PROJECT_BRIEF.md` → "Auth-flow batch (2026-05-27)".

### TD-008 — In-app navigation guard for the regen diff
**What:** The 2026-05-25 Phase 3 batch shipped a `beforeunload` warning on the regen result page (B13 from the smoke-test findings). That covers full page navigations (refresh, close tab, type a new URL). It does NOT cover in-app router-driven navigation — back button, bottom tab switch, or any client-side `router.push`. A user clicking "Plan" or "Today" mid-diff still silently loses their previewed plan.
**Why deferred:** Next.js 15 App Router has no built-in route-change blocker. The fix requires: (a) `history.pushState` interception with a custom popstate handler + confirmation modal for the back button, (b) wrapping the bottom tab Links in a guard component that calls the same modal before navigating. ~30 minutes of work but fiddly. Pragmatic call: ship `beforeunload` now, watch behavior, add this guard only if users actually hit the case.
**Files:** `app/_components/regen/RegenPageClient.tsx`, `app/_components/regen/StateResult.tsx`, `app/_components/regen/StateMinor.tsx`, plus a new `useUnsavedNavGuard` hook + tab-link wrapper.

---

## 🔵 Nice to haves (address opportunistically)

### TD-005 — Add Zod validation on Claude API response
**What:** `generateTrainingPlan()` in `lib/claude.ts` casts the tool response directly to `GeneratedWorkout[]` without runtime shape validation. If the model returns malformed output, the error surfaces as a confusing DB insert failure rather than a clear schema mismatch.
**File:** `lib/claude.ts` → `generateTrainingPlan()`

### TD-006 — Make `layout.tsx` metadata dynamic
**What:** `title: "Ultra Training — Squamish 50K"` and `description` are hardcoded. Should be derived from the user's actual race data once multi-user exists.
**File:** `app/layout.tsx`
**When:** v2 or v3, once race data is user-scoped.

### TD-009 — Consolidate duplicated `STRENGTH_FREQ_OPTS` constant
**What:** The wizard and the profile athlete-form each declare their own copy of `STRENGTH_FREQ_OPTS = ["None","1×","2×","3×","4×","5×"]`. The wizard's lives in `app/wizard/_components/wizard-types.ts`; the profile's lives at the top of `app/_components/profile/AthleteForm.tsx`. They drifted before — 2026-05-25 wizard polish batch extended the wizard version to 5× and had to mirror the change to the profile copy manually.
**Why deferred:** Surfaced in the wizard polish batch commit body as a known cleanup target. Low risk but worth a small dedicated refactor PR alongside other small-constant consolidations.
**Fix:** Move `STRENGTH_FREQ_OPTS` (and any other duplicated wizard/profile constants — `TRAIN_DAYS`, `SLEEP_OPTS`, etc.) into a shared `lib/training-constants.ts` module. Both surfaces import from there.
**Pattern precedent (2026-05-27):** the auth-flow batch's `lib/auth-constants.ts` is exactly this shape — a single shared constants module imported by both the client form and the server action, keeping a previously-duplicated rule (password min-length) in sync. Mirror it for `lib/training-constants.ts`. Still open.

### TD-010 — Remove unused `RegenActionBar.tsx` stub
**What:** `app/_components/regen/RegenActionBar.tsx` exists as a static component but the shipping regen flow renders its action bar inline inside `StateResult.tsx` / `StateMinor.tsx`. The stub was polished alongside those for visual consistency during the 2026-05-25 Phase 3 batch but is currently dead code — nothing imports it in the shipping flow.
**Why deferred:** Surfaced during code review of the Phase 3 polish batch. Low priority — just dead code, not a correctness issue.
**Fix:** Delete the file. Search for any stale imports first (`grep -rn RegenActionBar`).

---

_Last updated: 2026-05-26 | Source: Phase 3 polish batch code review; TD-011 closed in Phase 3 polish round 2_
