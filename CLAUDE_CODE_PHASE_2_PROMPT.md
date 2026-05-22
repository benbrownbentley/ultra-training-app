# Claude Code Prompt — Phase 2 (Structured Plan Tool Output)

Paste the everything-below-the-line block into Claude Code in Warp. It is self-contained and points at the design doc.

---

## Your task

Implement Phase 2 of the Vert roadmap. The full design is already written in `PHASE_2_SPEC.md` at the repo root — that document is the source of truth. Read it end-to-end before writing any code.

Phase 2 replaces the free-text `workouts.details` column with a structured `planned_detail jsonb` column (mirroring the existing `actual_detail` pattern from migration 013), adds a Claude-generated per-workout `why` field, and adds a `source` column for future device-sync attribution.

Everything ships in **one PR** — schema migration, RPC update, generation logic, renderer cut-over, and tests all land together.

## Required reading (in this order, before any code changes)

1. `AGENTS.md` — coding standards, comments, tests, no-`any` rule, shadcn/ui discipline.
2. `PROJECT_BRIEF.md` — current state of v2, the 5-phase plan (Phase 2 is what you're doing), and the deferred items in §8 of the spec that you should NOT pull in.
3. `PHASE_2_SPEC.md` — the full design doc. The four key calibration decisions from 2026-05-22 are in §9 and are non-negotiable:
   - Strict discriminator: `kind` lives on both the outer workout and inside `planned_detail`.
   - `why` is capped at ≤500 characters.
   - `details` column is dropped in the same migration that adds `planned_detail` — with a backfill `{ notes: <original text> }` so legacy rows still render.
   - `source` enum is just `{manual, device}`, no brand-specific values.
4. `supabase/migrations/20260522000013_workout_actuals.sql` — read this for the `actual_detail jsonb` precedent you're mirroring on the planned side.
5. `supabase/migrations/20260522000014_preserve_custom_on_regen.sql` — read this so you understand the `commit_plan_preview` RPC you'll be updating.
6. `lib/claude.ts` (the `PLAN_TOOL` definition around line 226, the `SYSTEM_PROMPT` constant, `GeneratedWorkout` type around line 84, and `formatHistory` / `formatStrengthActuals`).
7. `lib/workout-content.ts` end-to-end — the renderer-side consumer you're replacing.

## Implementation order

Follow §6 of the spec ("Cut-over plan — single Phase 2 PR"). Don't skip ahead. The 20 steps are listed in dependency order — schema first, generation next, renderers last, tests throughout.

### Step 1 — Database

Create `supabase/migrations/20260522000017_planned_detail.sql` containing the SQL in spec §5.1. It must be transactional (BEGIN/COMMIT) and do all four things in order:

1. Add `planned_detail jsonb`, `why text`, `source text` (with check constraint `source in ('manual', 'device')`, default `'manual'`).
2. Backfill `planned_detail = jsonb_build_object('notes', details)` for every existing row.
3. Drop the `details` column.
4. Add the column comments from spec §5.1.

Then update the `commit_plan_preview` RPC per spec §5.2 — drop `details` from the INSERT list, add `planned_detail`, `why`, `source`. Use a `CREATE OR REPLACE` in the same migration file or a paired migration.

### Step 2 — Generation (Claude tool schema)

Update `lib/claude.ts`:

- Replace `PLAN_TOOL` (line 226) with the new schema from spec §4. Each workout must declare `kind` twice (strict discriminator) — once on the outer object, once inside `planned_detail`.
- Update `GeneratedWorkout` interface (line 84) to drop `details` and require `planned_detail: PlannedDetail` plus `why: string`.
- Update `LoggedWorkout` (line 19) to use `planned_detail` instead of `details`. `formatHistory` and `formatStrengthActuals` need to be rewritten to read from the structured shape — see spec §6 step 5.
- Add a "Structured output requirements" section to `SYSTEM_PROMPT` explaining the per-type shapes, the 500-char `why` cap, and what makes a good `why` (reference the phase, the placement in the week, the recent adherence signal). Use the existing METHODOLOGY section as a tone reference.

### Step 3 — Validation

Update `lib/plan-validation.ts`:

- Add a zod schema for `PlannedDetail` as a discriminated union on `kind`. Each variant matches spec §4.2.
- Extend `validateGeneratedPlan` to call the zod schema on every workout. Validation failures should plug into the existing `auto-retry-once` mechanism (see PROJECT_BRIEF.md → "Decisions made 2026-05-20" → "Auto-retry-once on validation failure"). Do NOT change the retry shape — extend the validator, not the retry.
- Add a length check: `why.length <= 500`. Validation error if exceeded.

### Step 4 — Server actions

Update `app/actions.ts`:

- `previewPlan` and `commitPlan` pass `planned_detail` and `why` through to the RPC.
- `attachPlannedExercises` reads `planned_detail.exercises` directly for `gym` kind. The old `deriveWorkoutContent`-based path is deleted.
- `AddActivitySheet` (server-side handler) builds a minimal `planned_detail` of just `{ notes: <user text> }` for user-added custom activities. Extending the sheet UI to capture structure is OUT of scope — that's a deferred follow-up.

### Step 5 — Renderer cut-over

Rewrite `lib/workout-content.ts → deriveWorkoutContent` to read directly from `planned_detail`:

- Full structured payload → return its fields directly mapped to the existing `WorkoutContent` shape (`Segment`, `Exercise`, `RoutineItem`, `PhysioExercise`).
- Legacy backfilled row (only `notes` present, no other fields) → return a minimal `WorkoutContent` with `description = notes`, empty arrays for segments/exercises/routine/physioExercises. The existing "empty STRUCTURE block" path takes over in the UI.
- Delete the legacy regex parsers (`parseRunningSegments`, `parseStrengthExercises`, `parseRoutine`) — they're no longer reachable.
- Delete `STUB_WHY` and `STUB_DESCRIPTION` lookups — `why` is now per-row, sourced from the column.

Update every consumer listed in spec §6 steps 10–16:

- `app/workout/[id]/page.tsx` — pass `planned_detail` + `why` to `deriveWorkoutContent`; drop the raw `{workout.details}` block.
- `app/_components/today/WorkoutCard.tsx` — render a short readout from `planned_detail` instead of dumping `details`.
- `app/_components/today/WeekStrip.tsx` — replace the regex match with a structured read.
- `app/_components/today/TodayPageClient.tsx:131` — same swap for the `tomorrow` summary.
- `app/_components/workout/extract-metrics.ts` — read totals directly from `planned_detail`. Delete the regex paths.

### Step 6 — Tests

Add or update Vitest specs per spec §7:

- `lib/claude.test.ts` — assert the new tool schema's shape; mock Claude responses with structured payloads (one per kind: run, gym, hike, cross, physio, mobility); verify `formatHistory` correctly summarizes structured planned data into text lines for the prompt.
- `lib/plan-validation.test.ts` — happy path per kind; failure path per kind (missing required field, wrong discriminator); 500-char `why` cap enforced.
- `lib/workout-content.test.ts` — replace text-parsing cases with structured-input cases; one test per primary type confirming the structured-to-renderer mapping; add a "legacy backfilled row" test confirming `{ notes: "..." }` renders as a minimal card without throwing.

All tests must pass: `npm run test`.

### Step 7 — Verification before declaring done

Per AGENTS.md item 5, run before declaring complete:

- `npm run lint` — must pass with zero errors.
- `npm run build` — must complete successfully.
- `npm run test` — full suite must pass (current count is 118; expect higher after adding Phase 2 tests).

## What you must NOT do

- Do NOT implement any items from spec §8 (Deferred). Specifically: no prescribed-vs-actual delta computation, no GIN index on `planned_detail`, no per-type column promotion, no historical backfill beyond the minimal `{ notes }` shape, no `source` activation in the UI.
- Do NOT change the `auto-retry-once` mechanic in `generateTrainingPlan`. Extend the validator only.
- Do NOT add Strava/Garmin/Apple Health/Wahoo/Coros/etc. to the `source` enum. It's `{manual, device}`, full stop. (See spec §3.3.)
- Do NOT split this into multiple PRs. One PR, one migration, one deploy. (See spec §3.5.)
- Do NOT introduce any `any` types. All new types must be explicit, especially the discriminated union for `PlannedDetail`.
- Do NOT touch any Phase 3 backlog items (forgot-password, log/unlog toggle, wizard width, dark-mode legibility, etc.). Those are next session's work.

## Deploy notes (for Ben to handle, not you)

After your PR merges and Vercel deploys:

1. The migration must be applied to production Supabase. Ben will run it via the Supabase SQL editor or `npx supabase db push` (whichever is configured).
2. Ben will then immediately open the app and hit Regenerate on the regen sheet — this populates `planned_detail` with full structured data for all future-dated rows. The brief "minimal cards" window between migration and regenerate is expected and documented.
3. Ben will spot-check one workout of each kind (run / gym / hike / cross / physio / mobility) on the drill-down page to confirm structured rendering.

You do not need to do any of the above — they are operational steps for Ben in Warp/Supabase, not implementation work.

## Quality bar (per AGENTS.md)

- Comments explain **why**, not what. Every exported function gets a JSDoc.
- TypeScript strict mode stays on; no `any`.
- Tests are required for business logic in `lib/`. Snapshot tests are OK for renderer mapping; do NOT snapshot-test trivial UI.
- shadcn/ui primitives where applicable (this work is mostly server-side, so probably no new components).
- When the PR is opened, suggest Ben do a code review in Cowork before the next phase begins (per AGENTS.md item 11).

## Done definition

The PR is complete when:

- All 20 steps in spec §6 are implemented.
- `npm run lint`, `npm run test`, `npm run build` all pass.
- A manual smoke test from your local dev environment confirms: wizard → plan generation → every workout in the new plan has `planned_detail` populated and non-null `why` text; drill-down renders the structured shape correctly for each kind; regen sheet → preview → accept also writes structured data via the RPC.
- The PR description includes: (a) link to `PHASE_2_SPEC.md`, (b) the one-line summary of what changed, (c) the deploy steps from "Deploy notes" above so Ben knows what to do after merge.

Good luck. The spec has the answers — when in doubt, re-read the relevant section before improvising.
