# Claude Code prompt — Regen flow rewrite (preview + commit)

The most architecturally significant change before v1 ships. Splits the current
single-shot `regeneratePlan()` into **preview** (generate without writing) and
**commit** (the Accept CTA persists the new plan).

Paste this to Claude Code as one focused session. ~1–2 days of work.

---

```
Rewrite the plan regeneration flow to support a preview-then-accept pattern.

CURRENT STATE
- `app/actions.ts` exports `regeneratePlan(notes?)` which generates AND commits
  in one shot — Claude is called, new workouts replace the old ones in the
  database, journal entries flip to consumed=true, all immediately.
- `app/regen/page.tsx` is a visual-only prototype that toggles between 5
  design states via `?state=generating|result|minor|accepted|error`. There's
  no real data flow.
- `app/_components/regen/RegenerateSheet.tsx` exists but isn't wired to the
  real flow.

TARGET STATE
- Two distinct server actions: `previewPlan(notes?)` generates and stores the
  candidate plan in a *pending* state without touching the active plan;
  `commitPlan(previewId)` swaps the pending plan in atomically.
- The Regenerate sheet, when triggered, calls `previewPlan()` and routes to
  `/regen?preview=<id>`.
- `/regen` reads the pending preview, shows the diff between current and
  preview, and presents Accept / Regenerate again / Keep current plan.
- Accept calls `commitPlan(previewId)`. Regenerate again opens the sheet
  again (and discards the current preview when a new one is generated).
  Keep current plan discards the preview and routes back to Today.
- The 5 designed states (generating, result, minor change, accepted, error)
  remain — they're now driven by real data flow, not query params.

DATABASE CHANGES NEEDED
Add a migration: `supabase/migrations/2026MMDD_plan_previews.sql`
- New table `plan_previews` (id bigserial PK, user_id uuid FK, created_at,
  workouts jsonb (array of generated workout objects), notes text nullable,
  status text default 'pending' check status in ('pending', 'accepted',
  'discarded'), generation_summary jsonb nullable for the diff metadata).
- RLS enabled with user-scoped read/write policies matching the existing
  pattern in `20260516000005_v2_user_isolation.sql`.
- Index on (user_id, created_at desc) for finding the user's latest pending
  preview quickly.

LIB CHANGES
- Add `lib/preview.ts` with:
  · `getLatestPendingPreview(userId)` — fetches the most recent pending row
  · `discardOldPreviews(userId)` — marks all pending previews as discarded
    (call before inserting a new preview so users only have one in flight)
  · `computePlanDiff(currentDays, previewWorkouts)` — pure function that
    returns the diff shape used by `StateResult`. Type the output so the
    design's change badges (SHIFTED / REDUCED / ADDED) and the WEEK BY WEEK
    diff rows can render directly.
- Update `lib/regen-context.ts` if needed so it can also be called during
  preview (it currently exists for the sheet's "Recent context" section).

ACTION CHANGES IN `app/actions.ts`
- Replace `regeneratePlan(notes?)` with:
  · `previewPlan(notes?: string): Promise<{ previewId: number }>`
    — call `generateTrainingPlan()` exactly as today, but instead of
    deleting + inserting into `workouts`, store the result as a row in
    `plan_previews` with status='pending'. Call `discardOldPreviews` first
    so the user has at most one pending preview at a time. Don't touch
    `workouts` or `journal_entries` yet.
    Return the new preview id.
  · `commitPlan(previewId: number): Promise<void>`
    — load the preview row, verify user_id ownership and status='pending',
    then do the existing delete+insert into workouts using the preview's
    workouts payload. Mark the preview row status='accepted'. Flip
    journal_entries.consumed=true for all unconsumed (this was previously
    in regeneratePlan — moves here so journal flips only happen on commit).
    Revalidate /, /plan, /journal.
  · `discardPreview(previewId: number): Promise<void>`
    — set status='discarded'. No data changes.
- Update `createJournalEntry` so the `regenAfter: true` branch calls
  `previewPlan()` instead of `regeneratePlan()`, and redirects to
  `/regen?preview=<id>` instead of `/`.

ROUTE CHANGES — `app/regen/page.tsx`
- Remove the `?state=` query-param prototype entirely.
- Accept `?preview=<id>` as the param. If absent, redirect to /.
- Server-side: fetch the preview row by id (with user_id check), fetch the
  current active plan, compute the diff, determine whether it's a "minor
  change" (e.g. <3 workouts changed could be a heuristic), and render the
  appropriate state component with real data.
- Top-level state machine: while the preview is still null (the
  previewPlan call is in flight from the caller), show StateGenerating
  with the rotating mono status lines. Once the preview row exists, show
  StateResult (or StateMinor if the change is small). After commit, show
  StateAccepted briefly then redirect to /. On error during preview or
  commit, show StateError.
- StateGenerating should auto-poll for the preview every 1–2 seconds for
  up to ~20 seconds, then show an error if nothing's there.
- StateError needs a try-again CTA that calls previewPlan() again with the
  same notes.

COMPONENT CHANGES
- `app/_components/regen/RegenerateSheet.tsx`: wire the Regenerate CTA to
  call `previewPlan(notes)` and `router.push('/regen?preview=' + id)`.
  Cancel just closes the sheet. Show a small loading state on the button
  while the action is in flight.
- `app/_components/regen/StateResult.tsx`, `StateMinor.tsx`: accept the
  diff data as a prop instead of using hardcoded placeholders. Render the
  FROM YOUR COACH summary card (the preview row should include a
  generation_summary field — if it's empty for now, fall back to a
  computed default).
- `StateGenerating.tsx`, `StateAccepted.tsx`, `StateError.tsx`: rotate
  status copy via interval, accept callback props for the Try Again and
  Continue actions.

CLAUDE PROMPT UPDATE (lib/claude.ts)
- Update the SYSTEM_PROMPT: drop "Use metric units throughout" hardcode.
  Make units explicit per-call by appending a unit instruction to the
  user prompt based on profile.unit_system, AND have the system prompt
  say "Use the units specified in the user prompt — never hardcode metric."
- After the workouts array is returned, populate a `generation_summary`:
  a short structured object with `summary` (1–2 sentences for the FROM YOUR
  COACH card) and `changes` (an array of high-level moves for the badges:
  e.g. {type: 'shifted', text: 'Sat long → Thu'}).
- The simplest way: extend the submit_training_plan tool schema to require
  the summary + changes alongside the workouts array. Have Claude fill it
  in as part of the same tool call. Store the whole result in the preview
  row's workouts and generation_summary jsonb columns.

ENTRY POINTS THAT TRIGGER PREVIEW
Find every place that previously called `regeneratePlan()` and update:
- The REGEN affordance on Today (already wired to RegenerateSheet — sheet
  now triggers previewPlan)
- The "Regenerate plan" button on Plan tab (same wiring)
- The "Regenerate again" button on the regen result page (same wiring,
  but should also discard the current preview first)
- The "Save & regen" CTA on Journal entry forms (createJournalEntry's
  regenAfter branch — already updated above)
- The auto-trigger after submitting an injury report (same as above)

ACCEPTANCE CRITERIA
1. User taps REGEN on Today → Regenerate sheet opens with context list →
   types optional notes → taps Regenerate → routes to /regen → sees
   StateGenerating while preview is generated → diff view appears →
   taps Accept → workouts are replaced, journal entries flip to consumed,
   user is back on Today seeing the new plan.
2. Same flow but user taps "Keep current plan" → preview is discarded,
   workouts/journal unchanged, user back on Today.
3. Same flow but Claude API fails → StateError appears with Try Again
   that re-runs the preview.
4. Multiple previews can't accumulate: triggering a second preview
   while the first is pending discards the first.
5. Two users in parallel can't see each other's previews (RLS verification).

CONSTRAINTS FROM AGENTS.md
- Business logic in lib/, NOT in components or actions
- Server Components by default; "use client" only where needed
- No next/* imports in lib/
- Use shadcn/ui primitives for any new UI (Dialog, Sheet are likely needed)
- Zod runtime validation for the new server actions' inputs

CONSTRAINTS FROM PROJECT_BRIEF.md
- "Adaptive ≠ magic" — when the plan regenerates, the diff is the
  product. Make it clear and trustworthy.
- "Plan never auto-commits" — explicit accept only. This refactor IS
  that principle.
- The "FROM YOUR COACH" framing on the summary card is established;
  the JSON shape for generation_summary should support it directly.

FILES TO TOUCH (estimated)
- supabase/migrations/2026MMDD_plan_previews.sql (NEW)
- lib/preview.ts (NEW)
- lib/claude.ts (update tool schema + system prompt + return shape)
- app/actions.ts (replace regeneratePlan with previewPlan + commitPlan +
  discardPreview; update createJournalEntry)
- app/regen/page.tsx (full rewrite)
- app/_components/regen/RegenerateSheet.tsx (wire to previewPlan)
- app/_components/regen/StateGenerating.tsx
- app/_components/regen/StateResult.tsx
- app/_components/regen/StateMinor.tsx
- app/_components/regen/StateAccepted.tsx
- app/_components/regen/StateError.tsx
- app/page.tsx (no change to the page itself, but the REGEN
  affordance and sheet trigger now route to /regen?preview=)

VERIFICATION CHECKLIST WHEN DONE
- Run npm run lint and npm run build, fix all errors
- Apply the new migration to local Supabase, verify the RLS policies
- Manually test the happy path: REGEN → sheet → Regenerate → see
  preview → Accept → back on Today with new plan
- Test the discard path: REGEN → preview → Keep current plan → back
  on Today, plan unchanged
- Test the error path (kill the network mid-generation, see StateError)
- Test the multi-trigger path (start two previews in quick succession,
  verify only one persists)
```

---

## Notes for review afterwards

When Claude Code finishes, review:

- The migration carefully — getting RLS wrong on a new user-data table is bad.
- The diff computation in `lib/preview.ts` — make sure `computePlanDiff` is
  pure (no Supabase calls), takes the current and preview as arguments,
  returns a typed shape.
- The polling logic on StateGenerating — make sure it doesn't loop forever
  on a hung preview generation.
- The `commitPlan` action's atomicity — the delete + insert + journal flip
  should ideally all happen, or none of them. Wrap in a transaction if
  Supabase supports it, otherwise be explicit about the failure mode.
