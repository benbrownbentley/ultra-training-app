# Tech Debt

Items deferred from code review or development sessions. Work through these before each major version ships.

---

## 🔴 Fix before v2 launches (security / correctness)

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

### TD-007 — Password reset flow
**What:** The "Forgot?" link in `components/auth/auth-split.tsx` goes to `href="#"` — a dead link. Needs a `/forgot-password` page that calls `supabase.auth.resetPasswordForEmail()` and a `/reset-password` page that handles the email link callback.
**Why deferred:** No users yet. Must exist before v2 public launch.

---

## 🔵 Nice to haves (address opportunistically)

### TD-005 — Add Zod validation on Claude API response
**What:** `generateTrainingPlan()` in `lib/claude.ts` casts the tool response directly to `GeneratedWorkout[]` without runtime shape validation. If the model returns malformed output, the error surfaces as a confusing DB insert failure rather than a clear schema mismatch.
**File:** `lib/claude.ts` → `generateTrainingPlan()`

### TD-006 — Make `layout.tsx` metadata dynamic
**What:** `title: "Ultra Training — Squamish 50K"` and `description` are hardcoded. Should be derived from the user's actual race data once multi-user exists.
**File:** `app/layout.tsx`
**When:** v2 or v3, once race data is user-scoped.

---

_Last updated: 2026-05-16 | Source: v1 code review_
