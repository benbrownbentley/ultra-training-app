# Phase 2.5 — Chunked Plan Generation — Implementation Spec

_Drafted: 2026-05-22. Author: Claude + Ben. Status: design — not yet implemented._

> **Purpose.** Phase 2.5 of the 5-phase plan (see `PROJECT_BRIEF.md` → "Phase plan revised 2026-05-21"). Replaces the single-Claude-call plan-generation flow with a multi-call pipeline that (1) produces complete, high-quality plans reliably by keeping per-call output within Claude Haiku 4.5's coherence sweet spot, and (2) gives users real progress signal during the 60–90s wait.
>
> **Why this is needed, in plain terms.** Two failure modes have surfaced in production since Phase 2 shipped:
>
> 1. **Claude drops the tail.** On 14-week structured-output generations, Claude (Haiku 4.5) reliably produces the first ~80 workouts cleanly and then either silently omits the last 20 days, makes shape errors that the validator catches, or both. The auto-retry-once fixes most quality bugs but cannot recover from systematic tail-drop — both attempts produce `missing_dates` errors covering the same final stretch.
> 2. **The user thinks the app froze.** When generation kicks off from the regen sheet, the user sees only a button spinner for 60–90 seconds. The wizard's atmospheric `GeneratingState` is slightly better (rotating text) but its footer text "USUALLY 5–15 SECONDS" is now wrong post-Phase-2, and the 4-line rotation visibly loops during real generation.
>
> Chunking by periodization phase fixes both: smaller per-call outputs (each chunk is one phase, ~30–45 workouts) keep Claude focused, and per-phase progress (`— BASE PHASE ✓ · BUILD PHASE generating…`) replaces the rotating-text illusion with real progress signal.
>
> **What is NOT the reason for this work.** Earlier framing treated this as a Vercel Hobby 60s timeout fix. That framing was wrong — Vercel Hobby's max duration is 300s as of Feb 2026 ([Vercel Functions Limits docs](https://vercel.com/docs/functions/limitations)), so we have plenty of wall-clock headroom. Wall-clock isn't the constraint; output coherence is.

---

## 1. Current state (what we're replacing)

The current `generateTrainingPlan` in `lib/claude.ts` (~line 1347) makes one Claude API call that emits the entire plan in a single `submit_training_plan` tool invocation. The system prompt instructs Claude to apply periodization (BASE / BUILD / PEAK / TAPER) across the date window, but the model is responsible for producing every workout from start date through race day in one structured response.

In production this works fine for plans up to ~8 weeks. Beyond that, Claude's output quality degrades — the first 80 workouts are clean, but the last ~20 days routinely come out either missing, malformed (kind mismatch, invalid enum values), or both. See `PROJECT_BRIEF.md` → "Phase 2 deployed 2026-05-22" for the empirical evidence from the 2026-05-22 20:09 regen log.

The current UX during generation:

- **Wizard:** atmospheric full-screen `GeneratingState` (`app/wizard/_components/GeneratingDoneStates.tsx`) with 4 rotating status lines + pulse dots + a "USUALLY 5–15 SECONDS" footer that is now wrong.
- **Regen sheet:** the sheet stays open with a button-level spinner on the Regenerate button for the duration. No full-screen progress UI. The full-screen `StateGenerating` (`app/_components/regen/StateGenerating.tsx`) only renders if the user clicks "Try Again" from a prior error — not on the first regen attempt.

---

## 2. Design principles

1. **Periodization phases drive chunks.** BASE / BUILD / PEAK / TAPER. Natural unit. Phase boundaries already exist conceptually in the system prompt; chunking just makes them load-bearing.
2. **Each chunk is independently complete.** Each phase's workouts must cover every date in that phase. No gaps. The orchestrator stitches phase outputs together; nothing else fills in.
3. **Step 0 ("meta-plan") is cheap and small.** Returns just the phase breakdown — no per-workout detail. Lets the orchestrator know what chunks to spawn and how to label progress.
4. **Per-chunk calls see prior chunks' summaries, not full detail.** Context window stays manageable. The "what did BASE look like" passed into the BUILD call is a compact summary (weekly volume, key sessions), not the verbatim 30-workout array.
5. **Progress UX is first-class, not bolted on.** The chunking architecture exists in part to enable phase-name progress. The Generating screen reflects the orchestrator's state machine directly.
6. **Resume from last successful chunk on failure.** Don't waste 2 minutes of successful generation because one phase tripped. Persist partial state; surface a Retry that picks up where we left off.
7. **Auto-retry-once stays intact, per chunk.** The existing retry mechanic applies to each phase call independently. If BASE retries successfully, BUILD doesn't suffer for it.
8. **Validator runs per chunk AND across the stitched result.** Each chunk validates against its own phase window; the final assembled plan validates against the full start-to-race window (date coverage end-to-end, race-day run, no past dates).
9. **The wizard and regen flows share the orchestrator.** Same underlying pipeline. Only the UI shell differs.

---

## 3. Architecture

### 3.1 Pipeline overview

```
                ┌───────────────────────┐
   User submits │  Wizard / Regen Sheet │
                └────────────┬──────────┘
                             │
                             ▼
                ┌───────────────────────┐
                │ Step 0 — Meta-plan    │  ~10s
                │ Claude returns phase   │
                │ breakdown only.        │
                └────────────┬──────────┘
                             │
                             ▼
                ┌───────────────────────┐
                │ Persist meta-plan to  │
                │ plan_generation_jobs  │
                │ (new table)            │
                └────────────┬──────────┘
                             │
                             ▼
                ┌───────────────────────┐
   per phase    │ Step N — Phase chunk  │  ~20–60s each
   ◀──────────  │ Claude generates the   │
                │ workouts for *this*    │
                │ phase only.            │
                └────────────┬──────────┘
                             │
                             ▼
                ┌───────────────────────┐
                │ Append to job, mark   │
                │ phase complete         │
                └────────────┬──────────┘
                             │       (loop until all phases done)
                             ▼
                ┌───────────────────────┐
                │ Final validation +    │
                │ commit via            │
                │ commit_plan_preview    │
                └────────────┬──────────┘
                             │
                             ▼
                  Today / Regen preview
```

### 3.2 New types and module structure

**`lib/plan-generation-orchestrator.ts`** — new module. Exports the orchestrator entry point that the wizard and regen flows call.

```ts
export type GenerationPhase = "base" | "build" | "peak" | "taper";

export interface PhaseMetadata {
  phase: GenerationPhase;
  weekStartIso: string;   // ISO date of phase's first week
  weekEndIso: string;     // ISO date of phase's last week (inclusive)
  weeks: number;          // convenience: phase length in weeks
  workoutCount?: number;  // populated after phase generation
}

export interface MetaPlan {
  phases: PhaseMetadata[];
}

export interface PhaseGenerationResult {
  phase: GenerationPhase;
  workouts: GeneratedWorkout[];        // existing shape from lib/claude.ts
  summary: GenerationSummary;          // coach-voice summary for this phase
}

export interface JobState {
  jobId: number;                       // plan_generation_jobs.id
  metaPlan: MetaPlan;
  completedPhases: GenerationPhase[];  // which phases have landed
  workouts: GeneratedWorkout[];        // running concatenation
  status: "pending" | "complete" | "failed";
}
```

**`lib/claude.ts`** — split `generateTrainingPlan` into two new exported functions:

```ts
/**
 * Step 0 — generate the periodization meta-plan (phases only, no workouts).
 * Fast Claude call (~5–10s). Returns the phase breakdown the orchestrator
 * uses to spawn per-phase calls.
 */
export async function generateMetaPlan(args: GenerateMetaPlanArgs): Promise<MetaPlan>;

/**
 * Step N — generate the workouts for one specific phase. Sees the meta-plan
 * + compact summaries of any prior-completed phases. Output is bounded by
 * phase length (~30–45 workouts per call).
 */
export async function generatePhase(args: GeneratePhaseArgs): Promise<PhaseGenerationResult>;
```

The existing `generateTrainingPlan` becomes a *legacy* function — keep it in place but no longer wire it to the wizard / regen actions. The orchestrator calls `generateMetaPlan` + `generatePhase` in sequence. `generateTrainingPlan` can be deleted once we're sure the chunked path is stable in production (suggest deferring deletion to a Phase 2.6 cleanup PR).

### 3.3 Step 0 — Meta-plan call

**Purpose:** Decide the periodization phase breakdown. Return only the phases (with date ranges), no per-workout content.

**Input:** wizard data (race date, athlete profile, journal context — same as today's `GeneratePlanArgs`), minus the `history` field on the wizard path (no history yet) and including the full `history` on regens.

**Tool schema:** new tool `submit_meta_plan` in `lib/claude.ts`:

```ts
{
  name: "submit_meta_plan",
  description: "Submit the periodization phase breakdown for the training window. No per-workout detail — just the phases and their date ranges.",
  input_schema: {
    type: "object",
    properties: {
      phases: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            phase: { type: "string", enum: ["base", "build", "peak", "taper"] },
            week_start_iso: { type: "string", description: "ISO date YYYY-MM-DD of the first day of this phase" },
            week_end_iso:   { type: "string", description: "ISO date YYYY-MM-DD of the last day of this phase, inclusive" },
            rationale: { type: "string", description: "1-2 sentences explaining the phase boundary choice — shown only in logs / debug, not user-facing" }
          },
          required: ["phase", "week_start_iso", "week_end_iso"]
        }
      },
      meta_summary: {
        type: "string",
        description: "1-2 sentence coach-voice summary of the overall periodization approach. Used as opening copy on the regen result page."
      }
    },
    required: ["phases", "meta_summary"]
  }
}
```

**System prompt (new — much shorter than the full plan generation prompt):**

Concise sub-prompt that covers periodization rules only (BASE / BUILD / PEAK / TAPER allocations, compressed-window handling). No methodology dump on individual workouts.

**Constraints the validator enforces on meta-plan output:**

- At least 1, at most 4 phases.
- Phases ordered chronologically.
- `week_start_iso` of phase N+1 = day after `week_end_iso` of phase N (no gaps, no overlaps).
- First phase's `week_start_iso` = `startDate`.
- Last phase's `week_end_iso` = `raceDate`.
- TAPER phase, if present, is final and ends on `raceDate`.

If any of these fail → auto-retry-once (existing pattern). If retry fails → return typed envelope `{ ok: false, code: "validation_failed" }` and surface the friendly error UX.

**Expected wall-clock duration:** 5–10 seconds. Small structured output.

### 3.4 Step N — Per-phase generation

**Purpose:** Generate every workout for one specific phase. Output is bounded.

**Input:** the meta-plan + the specific phase to generate + compact summaries of prior-completed phases + the existing athlete/race/history/journal context.

**Tool schema:** reuse the existing `submit_training_plan` tool from Phase 2 (`lib/claude.ts` PLAN_TOOL) — same `planned_detail` discriminator, same `why` cap. The only difference is the date window is bounded to the phase, not the full plan.

**System prompt:** existing Phase 2 SYSTEM_PROMPT, with a small addition explaining:

- The athlete's full training window (so Claude has context for race-specificity)
- This phase's specific role (BASE / BUILD / PEAK / TAPER) and what to emphasize
- Compact summaries of prior phases ("BASE was 6 weeks ending 2026-06-14, ~45km/wk average, 1 quality day per week, focus on aerobic foundation. Skipped 3 of 12 strength sessions.")
- The exact date range this chunk is generating workouts for

**Validator extension (`lib/plan-validation.ts`):** add `validatePhaseChunk(args)` — runs the same per-workout validators (planned_detail shape, why length, kind discriminator) plus a phase-specific check that EVERY date in the phase window has at least one workout. Auto-retry-once applies per phase.

**Expected wall-clock duration per phase:** 20–60 seconds depending on phase length. BASE on a long-window plan might be the biggest at 6 weeks → ~54 workouts → ~10k tokens → ~50s.

### 3.5 Job persistence

**New table `plan_generation_jobs`** — tracks orchestrator state so a mid-pipeline failure can be resumed.

```sql
create table plan_generation_jobs (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  trigger         text not null check (trigger in ('wizard', 'regen')),
  meta_plan       jsonb not null,                  -- the Step 0 result
  completed_phases jsonb not null default '[]',    -- array of phase names done
  partial_workouts jsonb not null default '[]',    -- accumulated workouts from completed phases
  notes           text,                            -- regen notes if applicable
  status          text not null default 'pending' check (status in ('pending', 'complete', 'failed', 'cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index plan_generation_jobs_user_status_idx on plan_generation_jobs (user_id, status, created_at desc);
alter table plan_generation_jobs enable row level security;

create policy "Users read own plan_generation_jobs" on plan_generation_jobs
  for select using (auth.uid() = user_id);
create policy "Users insert own plan_generation_jobs" on plan_generation_jobs
  for insert with check (auth.uid() = user_id);
create policy "Users update own plan_generation_jobs" on plan_generation_jobs
  for update using (auth.uid() = user_id);
create policy "Users delete own plan_generation_jobs" on plan_generation_jobs
  for delete using (auth.uid() = user_id);
```

**Lifecycle:**

1. Meta-plan returns → INSERT row with `status: pending`, `meta_plan: {…}`, `completed_phases: []`, `partial_workouts: []`.
2. Each phase completes → UPDATE row with appended phase + workouts.
3. Final phase completes → final validation runs against assembled plan. On success, UPDATE row to `status: complete`, set `completed_at`, run `commit_plan_preview` (existing RPC) to materialize the plan into the `workouts` table.
4. Any phase fails after retry → UPDATE row to `status: failed`, surface friendly error UX with Resume button.
5. User cancels mid-pipeline (browser closes, etc.) → row stays `pending`. A nightly cleanup (deferred — not Phase 2.5 scope) reaps stale `pending` rows older than 24h.

**Cleanup of pending jobs:** when a user starts a NEW generation while a previous job is still `pending`, mark the previous job as `cancelled` first. Same pattern as the existing `discardAllPendingPreviews` helper for `plan_previews`.

### 3.6 The orchestrator

**Entry point (called by wizard / regen actions):**

```ts
export async function runGenerationPipeline(args: {
  user: User;
  race: Race;
  otherRaces: Race[];
  profile: AthleteProfile;
  startDate: string;
  history: LoggedWorkout[];
  journalEntries: JournalContextEntry[];
  notes?: string | null;
  previousSummary?: GenerationSummary | null;
  trigger: "wizard" | "regen";
  // Resume support: when set, picks up an existing pending job instead
  // of starting fresh. The orchestrator skips meta-plan + already-
  // completed phases and runs only the remaining ones.
  resumeJobId?: number;
}): Promise<
  | { ok: true; jobId: number; previewId: number }
  | { ok: false; code: PlanGenErrorCode; requestId: string; jobId?: number }
>;
```

**Behavior:**

1. **If `resumeJobId` is set:** SELECT the job row. If `status !== 'pending'`, return `{ok: false, code: 'unknown'}`. Otherwise resume from `completed_phases`.
2. **Otherwise (fresh start):** cancel any existing pending job for this user. Call `generateMetaPlan`. Validate meta-plan. INSERT new job row.
3. **For each phase in `meta_plan.phases` not in `completed_phases`:**
   - Call `generatePhase` with phase metadata + prior-phase summaries + context.
   - Validate the phase output (per-workout shape + date coverage within phase window).
   - On success: UPDATE the job row with the new phase appended.
   - On failure (after retry-once): UPDATE job to `status: failed`, return `{ok: false, code: 'validation_failed', jobId}`.
4. **After all phases land:** assemble the full workouts array, run the existing full-plan validator (date coverage start-to-race, race-day run, no past dates). Edge case: if Claude's meta-plan and per-phase outputs land cleanly but the assembled plan has a gap at a phase boundary, this catches it.
5. **On full success:** call `commit_plan_preview` with the assembled workouts. UPDATE job to `status: complete`. Return `{ok: true, jobId, previewId}`.

**Failure handling specifics:**

- **Meta-plan failure** — no job row exists yet, return `{ok: false, code, requestId}` immediately. UI shows the existing friendly error state.
- **Per-phase failure** — job row exists with `completed_phases` showing what landed. Return `{ok: false, code, requestId, jobId}`. UI's error state has a "Resume generation" button that calls the orchestrator with `resumeJobId`.
- **Final-validation failure** — rare, indicates an inter-phase gap. UPDATE job to `failed`, return error. Resume would re-run only the failing phase.

### 3.7 Progress signaling

The orchestrator emits progress signals as each phase completes so the UI can update. **Two implementation options:**

**Option A (recommended — simpler):** Polling. The UI calls a separate `getGenerationJobStatus(jobId)` action every 2 seconds while the orchestrator is running. Returns the current state of the job row (`completed_phases`, current `status`). UI re-renders progress based on the response. No server-side push infrastructure needed. Works on Vercel without WebSockets / SSE setup.

**Option B (deferred — more polished):** Server-Sent Events or React Suspense streaming. Generates a continuous stream of progress updates from the orchestrator to the client. Cleaner UX but requires more orchestration. Suggest deferring to a Phase 2.6 polish PR if Option A feels janky in practice.

For Option A, the polling interval (2s) is a reasonable balance: fast enough that "BASE PHASE ✓" feels live, slow enough that polling isn't a load concern (max ~30–60 polls per generation).

### 3.8 UI flow

**Wizard (first plan):**

1. User submits the wizard → `submitWizard` action fires.
2. Orchestrator's first call (`generateMetaPlan`) runs and persists the job. Action returns `{ok: true, jobId}` to the client.
3. Wizard transitions to a new `GeneratingPhaseState` component (replaces `GeneratingState` on the chunked path).
4. `GeneratingPhaseState` polls `getGenerationJobStatus(jobId)` every 2s, renders:
   - Header: "— BUILDING YOUR PLAN"
   - Per-phase status: `— BASE PHASE ✓ · BUILD PHASE ✓ · PEAK PHASE generating… · TAPER PHASE` (dim/muted for not-yet-started phases, accent for in-progress, checkmark for completed)
   - Elapsed timer: `0:43`
   - Pulse-dot animation on the active phase line
5. When polling returns `status: complete`, transition to existing `DoneState` (the "See today's workout" CTA).
6. When polling returns `status: failed`, transition to `GeneratingErrorState` (existing Phase 2.1 component) with a `Resume generation` button that calls `submitWizard` with `resumeJobId: <id>`.

**Regen (existing plan):**

1. User clicks Regenerate in the sheet → `previewPlan` action fires.
2. Same as wizard, but instead of the wizard transitioning, the sheet closes and `router.push(\`/regen?job=${jobId}\`)` routes to a new chunked progress page at `/regen` (existing route, new query param branch).
3. `/regen?job=<id>` renders the same `GeneratingPhaseState` component (polling, same UI).
4. On `status: complete`, the page reads `meta_plan` and the new `previewId` from the job row, and renders the existing regen-result diff UI (`/regen?preview=<id>` flow).
5. On `status: failed`, renders the existing `StateError` with Resume CTA.

The current "atmospheric `StateGenerating` only shows on Try Again" bug is naturally fixed — every regen now routes through the progress page from the moment the meta-plan returns.

### 3.9 Backward compatibility during rollout

**Feature flag (`process.env.PLAN_CHUNKING_ENABLED`):** the orchestrator path runs only when this env var is set. Default to enabled in dev; flip on for prod after a successful local smoke. If chunking has issues in prod, flip back to the legacy single-call path without redeploying.

Implementation: `submitWizard` and `previewPlan` actions check the env var and branch:

```ts
if (process.env.PLAN_CHUNKING_ENABLED === "true") {
  return runGenerationPipeline({...});
} else {
  // Existing single-call path through generateTrainingPlan.
  return legacyGenerate({...});
}
```

Once we've burned in chunking for a few weeks of regular use, delete the flag and the legacy `generateTrainingPlan` function in a Phase 2.6 cleanup PR.

---

## 4. Validator extensions

`lib/plan-validation.ts` gets two new exported functions:

### 4.1 `validateMetaPlan(args)`

```ts
export function validateMetaPlan(args: {
  metaPlan: MetaPlan;
  startDate: string;
  raceDate: string;
}): ValidationIssue[];
```

Issue codes:
- `meta_plan_phase_gap` — phase N+1 doesn't start the day after phase N ends.
- `meta_plan_overlap` — phase N+1 starts before phase N ends.
- `meta_plan_start_mismatch` — first phase doesn't start on `startDate`.
- `meta_plan_end_mismatch` — last phase doesn't end on `raceDate`.
- `meta_plan_invalid_phase_order` — TAPER not last, or BASE not first when present.
- `meta_plan_empty` — no phases returned.

Hooks into the existing auto-retry-once via `buildRetryMessage` extension.

### 4.2 `validatePhaseChunk(args)`

```ts
export function validatePhaseChunk(args: {
  workouts: GeneratedWorkout[];
  phaseStart: string;
  phaseEnd: string;
}): ValidationIssue[];
```

Runs the per-workout validators (delegates to existing logic for `planned_detail_invalid`, `kind_mismatch`, `why_missing`, `why_too_long`) PLUS a date-coverage check bounded to the phase window. Issue code `missing_dates_in_phase` distinguishes from the full-plan `missing_dates`.

### 4.3 `validateAssembledPlan(args)` — uses existing `validateGeneratedPlan`

No new code. The orchestrator calls the existing `validateGeneratedPlan` against the full assembled workouts array after all phases complete. Same error codes, same retry semantics from Phase 2.

---

## 5. Database migration

**`supabase/migrations/<next-timestamp>_plan_generation_jobs.sql`** — additive only. Creates the new table per §3.5. Includes the `commit_plan_preview` RPC update (if any) — but reviewing, no RPC change is needed. The existing RPC takes the assembled workouts JSONB and inserts; the orchestrator builds that JSONB from accumulated phase results.

```sql
-- Phase 2.5: orchestrator job state for chunked plan generation.
-- Additive only — adds plan_generation_jobs without touching existing tables.
-- See CHUNKING_SPEC.md §3.5.

begin;

create table if not exists plan_generation_jobs (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  trigger         text not null check (trigger in ('wizard', 'regen')),
  meta_plan       jsonb not null,
  completed_phases jsonb not null default '[]',
  partial_workouts jsonb not null default '[]',
  notes           text,
  status          text not null default 'pending' check (status in ('pending', 'complete', 'failed', 'cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index if not exists plan_generation_jobs_user_status_idx
  on plan_generation_jobs (user_id, status, created_at desc);

alter table plan_generation_jobs enable row level security;

create policy "Users read own plan_generation_jobs" on plan_generation_jobs
  for select using (auth.uid() = user_id);
create policy "Users insert own plan_generation_jobs" on plan_generation_jobs
  for insert with check (auth.uid() = user_id);
create policy "Users update own plan_generation_jobs" on plan_generation_jobs
  for update using (auth.uid() = user_id);
create policy "Users delete own plan_generation_jobs" on plan_generation_jobs
  for delete using (auth.uid() = user_id);

commit;

comment on table plan_generation_jobs is
  'Orchestrator state for chunked plan generation. One row per generation attempt. See CHUNKING_SPEC.md §3.5.';
```

Use the next-available migration timestamp (currently `20260525000017` is the latest; Phase 2.5 would be `20260526000018` or whatever sequence Ben prefers).

---

## 6. Implementation steps (one PR)

This is a meaty PR — bigger than Phase 2.1. Estimate 2–3 focused Claude Code sessions. Suggested ordering:

**Step 1 — Database**
1. Create the `plan_generation_jobs` migration (§5).
2. Apply migration to local Supabase. Test that RLS scoping works.

**Step 2 — Types and validator**
3. Add `GenerationPhase`, `PhaseMetadata`, `MetaPlan`, `PhaseGenerationResult`, `JobState` types to `lib/plan.ts` (or a new `lib/plan-generation-orchestrator.ts` file — preference: separate file to keep `plan.ts` focused on data shapes).
4. Add `validateMetaPlan` and `validatePhaseChunk` to `lib/plan-validation.ts`. Update `buildRetryMessage` to handle the new error codes.
5. Add Vitest specs for both validators (happy path + each failure mode).

**Step 3 — Claude calls**
6. Add `META_PLAN_TOOL` schema + `generateMetaPlan` function to `lib/claude.ts`. Reuses much of `callClaudeOnce`'s pattern.
7. Add `generatePhase` function — wraps `callClaudeOnce` with a phase-scoped system prompt addendum.
8. Write META_PLAN_SYSTEM_PROMPT — concise periodization-only prompt.
9. Update SYSTEM_PROMPT with a per-phase prompt section that gets prepended in `generatePhase` calls.
10. Add Vitest mocks + fixtures for both new Claude calls.

**Step 4 — Orchestrator**
11. Create `lib/plan-generation-orchestrator.ts` with `runGenerationPipeline`.
12. Implement fresh-start path: meta-plan → loop phases → final validate → commit.
13. Implement resume path: SELECT job → resume from `completed_phases`.
14. Implement cancel-prior-pending-job-on-fresh-start helper.
15. Add Vitest specs for the orchestrator (mock Claude calls, test phase looping, test failure-then-resume).

**Step 5 — Server actions**
16. Add `getGenerationJobStatus(jobId)` action — returns the current job state for polling.
17. Update `submitWizard` to use the orchestrator behind the feature flag.
18. Update `previewPlan` (used by the regen sheet) to use the orchestrator behind the feature flag.
19. Update `createJournalEntry` regen-after path to route to `/regen?job=<id>` instead of `/regen?preview=<id>`.

**Step 6 — UI**
20. Create new `GeneratingPhaseState` component in `app/_components/regen/` (or a shared location). Polls `getGenerationJobStatus`. Renders per-phase progress.
21. Update wizard's `WizardClient` to transition to `GeneratingPhaseState` instead of `GeneratingState` when `submitWizard` returns `{ok: true, jobId}`.
22. Update `RegenerateSheet` to `router.push(\`/regen?job=${jobId}\`)` on success instead of closing the sheet immediately.
23. Update `/regen/page.tsx` to render `GeneratingPhaseState` when `?job=<id>` is present (in addition to the existing `?preview=<id>` and `?error=<code>` branches).
24. Update `RegenErrorPage` / `GeneratingErrorState` to wire the "Resume generation" button to the orchestrator with `resumeJobId`.

**Step 7 — Feature flag + cleanup**
25. Wire the `PLAN_CHUNKING_ENABLED` env var into both action paths.
26. Leave the legacy `generateTrainingPlan` function in place (untouched).
27. Add a note in `PROJECT_BRIEF.md` deferred section: "Delete legacy `generateTrainingPlan` once chunking has burned in for ~4 weeks — Phase 2.6 cleanup."

**Step 8 — Small Phase 2.1 follow-up**
28. Add a `[plan-gen-metrics]` log line on the retry-also-failed throw path in `generateTrainingPlan` (the Phase 2.1 code review's suggestion #1 — bundled in since we're touching `lib/claude.ts` anyway).

**Step 9 — Tests + verification**
29. Run `npm run test` — full suite must pass with the new specs.
30. Run `npm run lint` — clean.
31. Run `npm run build` — succeeds.
32. Manual smoke test on local: wizard → meta-plan → 4 phase generations → assembled plan → render. Then a regen following the same path. Then a forced phase failure (mock a bad Claude response in one phase) → verify Resume picks up correctly.

---

## 7. Testing strategy

**Unit tests (Vitest, must land with the PR):**

- `validateMetaPlan` — happy path + each failure mode (gap, overlap, start mismatch, end mismatch, invalid order, empty).
- `validatePhaseChunk` — happy path + per-workout failures (planned_detail_invalid, kind_mismatch, why_missing, why_too_long) + phase-scoped date coverage (missing_dates_in_phase).
- Orchestrator — mock Claude calls. Test (a) fresh-start happy path generates 4 phases and assembles; (b) phase 2 fails → job row marked failed; (c) resume from phase 2 → only re-runs phase 2 onward; (d) cancel-prior-pending on fresh start.
- `generateMetaPlan` — mock Anthropic SDK. Assert tool schema is correctly shaped; assert response is parsed into `MetaPlan`.
- `generatePhase` — same. Mock SDK, verify per-phase context (prior summaries) is in the prompt.

**Integration smoke (manual, before flipping the feature flag on in prod):**

1. Local dev: fresh wizard run with chunking enabled. Verify all 4 phases land and the assembled plan covers every date.
2. Force a phase 2 failure (temporarily edit `generatePhase` to throw on phase 2). Verify the friendly error state renders with Resume. Click Resume. Verify it picks up at phase 2 and completes.
3. Multi-user isolation: log in as a second account, start a generation, verify the first account's `plan_generation_jobs` rows aren't visible.
4. Cancel-prior-pending: start a generation, immediately start another, verify the first job is marked `cancelled` and only the second proceeds.

**Eval (post-deploy, before flipping flag for non-Ben users):**

- Run 5–10 chunked regens on Ben's real plan, eyeball the assembled plans for:
  - Periodization coherence (do the phase boundaries make sense? does PEAK actually peak?)
  - Inter-phase smoothness (does volume ramp cleanly from BASE into BUILD, or are there visible discontinuities?)
  - Total wall-clock duration (sum of meta-plan + per-phase + commit — should be faster than legacy because Claude isn't fighting itself; expect 60–90s end-to-end)
  - Failure rate (how often does any phase need to retry?)

---

## 8. Open questions worth flagging in §9 before implementation begins

These are calibration points I'd want to confirm with Ben before opening the Step 1 PR. None block the spec.

1. **Polling vs. SSE for progress signal.** I've recommended polling (Option A in §3.7). Simpler, no SSE/WebSocket infrastructure. The 2-second polling cadence feels live without being a load concern. Defer SSE to Phase 2.6 if polling feels janky. Confirm direction.
2. **Feature-flag lifetime.** I've specced `PLAN_CHUNKING_ENABLED` as a transient flag that gets deleted in Phase 2.6 after burn-in. Alternative: keep it as a permanent toggle in case of future emergencies. Permanent flags create maintenance debt — recommend deleting after 4 weeks of stable prod use.
3. **Resume UX wording.** I've specced "Resume generation" as the CTA. Athletic-vocabulary alternatives that could fit the brand voice: "Pick up the run", "Continue", "Back at it". Pick one and use consistently across wizard + regen surfaces. (Default: "Resume generation" — clear, on-brand enough.)
4. **Job retention.** I've not specced a cleanup policy for completed / cancelled jobs. They'll accumulate in `plan_generation_jobs` over time. Suggest a nightly cron (Vercel Cron or pg_cron) that hard-deletes rows older than 30 days where `status IN ('complete', 'cancelled', 'failed')`. Defer the cron itself to Phase 2.6 — for now just let them accumulate; volume per user is low (a few per week).

---

## 9. Resolved design decisions (Ben 2026-05-22)

These were locked in via AskUserQuestion during the design session:

- **Chunks defined by periodization phase** (not fixed-size windows, not hybrid). Phase as the natural unit. The progress UI names phases explicitly.
- **Single screen with per-phase progress** (not generic progress bar, not async-with-banner). The atmospheric "Building base… Building build… Building peak… Building taper" UX Ben specifically called out.
- **Resume from last successful chunk on failure** (not restart-whole-pipeline). Worth the extra persistence-state complexity.
- **Applies to both wizard AND regen flows.** Same orchestrator, same UI primitive.

---

## 10. Deferred from this spec (Phase 2.6+)

- Delete legacy `generateTrainingPlan` function once chunking has burned in (~4 weeks of stable prod use).
- Move from polling to Server-Sent Events for progress signal (if polling feels janky).
- Background-job architecture (Inngest / QStash / Trigger.dev) — true async generation that survives browser close. v3+ scope.
- Nightly cleanup cron for old `plan_generation_jobs` rows.
- Differential `why` length caps by workout kind (already deferred per Phase 2 spec §9 follow-ups — data-dependent, evaluate after enough chunked regens have produced `[plan-gen-metrics]` data).

---

## 11. Status

- [x] §1 Current state mapped
- [x] §2 Design principles
- [x] §3 Architecture (pipeline, types, meta-plan, per-phase, persistence, orchestrator, progress, UI, feature flag)
- [x] §4 Validator extensions
- [x] §5 Migration SQL
- [x] §6 Implementation steps
- [x] §7 Testing strategy
- [x] §8 Open questions
- [x] §9 Resolved decisions
- [x] §10 Deferred items
- [ ] Spec reviewed by Ben
- [ ] Open questions in §8 confirmed
- [ ] Implementation PR opened
- [ ] Feature flag flipped on in prod
- [ ] Legacy `generateTrainingPlan` deleted (Phase 2.6)
