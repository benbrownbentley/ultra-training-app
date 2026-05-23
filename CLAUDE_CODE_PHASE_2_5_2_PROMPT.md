# Claude Code Prompt — Phase 2.5.2 (Generating-Screen Polish + Meta-Plan Trim)

Paste everything below the line into Claude Code in Warp. Self-contained.

This is a focused polish PR — estimated **one Claude Code session**. Six items bundled together because they all touch the same surfaces (generating UX, meta-plan call, metrics logging). No new architectural patterns, no big design decisions — execute against the spec.

---

## Your task

Implement **Phase 2.5.2** of the Vert roadmap — generating-screen polish based on Ben's post-Phase-2.5.1 production feedback. Six items in one PR:

1. **Trim the meta-plan prompt** to its decision-relevant inputs. Shaves ~5–7s off the kickoff (15s → 8–10s).
2. **Optimistic routing.** Sheet closes immediately on click; building page shows kicking-off state until meta-plan lands. Requires splitting kickoff into two server actions.
3. **Phase-aware rotating flavour text** on `GeneratingPhaseState`. Five lines per phase, cycling while that phase is active.
4. **Honest timing copy.** Replace "USUALLY 5–15 SECONDS" with "USUALLY 3–5 MINUTES". Pair with elapsed timer.
5. **More prominent elapsed timer.** Larger, higher contrast, pulse the colon so the per-second tick is visible.
6. **Cache-hit instrumentation.** Log `cache_read_input_tokens` so Ben can audit prompt caching after the next regen.

Plus two deferred Phase 2.5.1 code-review fixes that Ben signed off on bundling here:
- Comment in `runFinalize`'s validation-failure path documenting the edge case where Resume won't help.
- `advanceJob` returns `workoutCount` so `GeneratingPhaseState` can skip the extra `getGenerationJobStatus` refetch per phase.

The full design lives in `PROJECT_BRIEF.md` → "Phase 2.5.2 — Generating-screen polish" and "Prompt-caching audit" sections. That document is the source of truth.

## Required reading (in this order, before any code changes)

1. `AGENTS.md` — coding standards.
2. `PROJECT_BRIEF.md` — read these sections specifically:
   - "Phase 2.5.2 — Generating-screen polish (next, ~3 hr work)" — the full design for this PR.
   - "Prompt-caching audit (concurrent, ~5 min)" — what the cache instrumentation needs to surface.
   - "Phase 2.5.1 shipped 2026-05-22" (in the Phase 2.5 narrative) — context on what just landed.
3. `PHASE_2_5_1_SPEC.md` — read briefly for context on the kickoff/advance architecture you're polishing.
4. `lib/claude.ts` — specifically `generateMetaPlan` (the meta-plan call you're trimming) and `META_PLAN_SYSTEM_PROMPT`. Also `callClaudeOnce` for cache instrumentation.
5. `lib/plan-generation-orchestrator.ts` — `runKickoff`, `runOnePhase`, `runFinalize`. You'll split `runKickoff` into two parts.
6. `app/actions.ts` — `previewPlan`, `submitWizard`, `advanceJob`. They'll get new return shapes and a new `precreateGenerationJob` action.
7. `app/_components/generating/GeneratingPhaseState.tsx` — the component you're adding kicking-off state, rotating text, and timer-prominence updates to.
8. `app/_components/regen/RegenerateSheet.tsx` — the regen sheet's submit handler.
9. `app/wizard/_components/WizardClient.tsx` — the wizard's submit handler.
10. `app/wizard/_components/GeneratingDoneStates.tsx` — `GeneratingState`. Apply matching footer copy updates here even though this component goes away in Phase 2.6.
11. `lib/plan-gen-metrics.ts` and its test — you'll extend the metrics shape with cache-read fields.
12. `supabase/migrations/` — you'll add a small migration to relax the `plan_generation_jobs.status` check constraint to allow a new `kicking-off` value.

## Implementation steps

Follow `PROJECT_BRIEF.md` → "Phase 2.5.2 — Generating-screen polish" → "Implementation order" — 11 numbered steps. Some details below for the trickier parts.

### Step 1 — Trim the meta-plan prompt

`generateMetaPlan` currently fans in the full athlete profile + journal context + history same as `generatePhase`. The meta-plan's job is just to decide periodization phase boundaries — it doesn't generate per-workout content. Pull only the decision-relevant subset:

**Keep:**
- Race date and current date (defines the window)
- Race intent (`competitive` / `moderate` / `relaxed` — affects PEAK length)
- Coarse fitness signal — `weekly_volume_km`, `longest_run_distance`, `weekly_hours_current`, `fitness_rating`
- Severe injury notes (just `injury_notes`, not the full journal)
- Total available weeks
- Race elevation gain + terrain (affects whether to include hike-focused phases)

**Drop from meta-plan call only** (keep on per-phase calls):
- Detailed athlete profile fields (equipment, cross-training preferences, sleep/stress baseline, time-of-day, strength frequency, body weight, age, sex, chronic conditions, training days, long-run-days, quality-days, outdoor terrain)
- Recent journal entries (bodies, full context)
- Workout history
- Other races (B/C — these matter for phase content, not phase boundaries)

Define a new `META_PROFILE_FIELDS` subset somewhere accessible (or just inline the trimming in `generateMetaPlan`). Keep `META_PLAN_SYSTEM_PROMPT` mostly unchanged — it's about periodization rules, not data scope.

**Important framing in code comments:** this is NOT a "stop collecting data" change. The wizard keeps collecting everything; per-phase calls still need all of it. We're just sending less to the specific Claude call that needs less. Per-phase calls (`generatePhase`) are completely unchanged.

### Step 2 — Split kickoff into two server actions

Current `runKickoff` does: cancel-prior-pending → meta-plan → insert job row → return jobId.

Split into:

**`precreateGenerationJob(args)`** — fast (~50ms). Cancel-prior-pending + insert job row with `status: "kicking-off"`, empty `meta_plan: null` (or `{}`), no workouts yet. Return `{ ok: true, jobId }`. Lives in `lib/plan-generation-orchestrator.ts`.

**`runMetaPlanForJob(jobId)`** — slow (~10s). Loads the job row, runs the meta-plan call, validates it, UPDATEs the job row with the meta-plan + flips status to `pending`. Returns `{ ok: true, metaPlan } | RunGenerationFailure`. Also in the orchestrator module.

Then in `app/actions.ts`:
- New action `precreateGenerationJob` exported. Wraps the helper with `requireUser()` + same context fan-in.
- New action `runMetaPlanForJob(jobId)` exported. Wraps the helper.
- `previewPlan` and `submitWizard` no longer await meta-plan inline. They call `precreateGenerationJob` and return `{ ok: true, jobId }` after ~50ms.
- The client (sheet + wizard) routes to `/regen?job=<id>` immediately on `precreate` success.
- The `GeneratingPhaseState` component, on mount, kicks off `runMetaPlanForJob(jobId)` if the job's status is `kicking-off`.

`advanceJob` already handles the `pending` → run-next-phase loop; that's unchanged.

### Step 3 — Migration for the `kicking-off` status

Single-line migration:

```sql
-- Phase 2.5.2: allow a transient 'kicking-off' status while the meta-plan
-- call runs in the background after the precreate action returns. See
-- PROJECT_BRIEF.md → Phase 2.5.2.

alter table plan_generation_jobs
  drop constraint if exists plan_generation_jobs_status_check;

alter table plan_generation_jobs
  add constraint plan_generation_jobs_status_check
  check (status in ('kicking-off', 'pending', 'complete', 'failed', 'cancelled'));
```

Use the next migration timestamp (currently `20260526000018` or wherever the sequence is — Claude Code can pick the right one based on existing files in `supabase/migrations/`).

### Step 4 — `GeneratingPhaseState` handles kicking-off state

When the component mounts and the job's status is `kicking-off`:

1. Render a pre-meta-plan UI variant: same atmospheric topo background, "— DESIGNING YOUR TRAINING ARC" eyebrow (or similar), pulse dots, no phase rows yet.
2. Fire `runMetaPlanForJob(jobId)` immediately on mount.
3. When the action returns with `ok: true`, the job's status is now `pending` and `meta_plan` is populated. Transition the UI to show the phase rows.
4. The existing advance loop then takes over.

On meta-plan failure, fire `onFailed` with the failure code. Same UX as a phase failure.

### Step 5 — Phase-aware rotating flavour text

Add a new `PhaseRotatingTagline` component (or extend `PhaseLine`) that renders 5 lines per phase, cycling every ~3s while that phase is active.

Exact copy from the brief:

```ts
const PHASE_FLAVOUR: Record<GenerationPhase, string[]> = {
  base: [
    "Mapping your aerobic foundation.",
    "Setting cutback weeks.",
    "Sizing the long run progression.",
    "Honouring your recovery days.",
    "Reading recent volume.",
  ],
  build: [
    "Adding race-specific intensity.",
    "Placing the first quality sessions.",
    "Balancing hard days with easy days.",
    "Spacing tempo and threshold work.",
    "Watching for recent injury signals.",
  ],
  peak: [
    "Sharpening race fitness.",
    "Sequencing peak-week sessions.",
    "Holding volume, raising intensity.",
    "Protecting the long run.",
    "Tuning brick sessions.",
  ],
  taper: [
    "Locking in fitness, shedding fatigue.",
    "Cutting volume thoughtfully.",
    "Keeping intensity, dropping duration.",
    "Planning your shakeout days.",
    "Easing into race readiness.",
  ],
};
```

The lines should fade in/out as they rotate. Match the legacy `GeneratingState`'s 4-line CSS animation pattern (`vert-fade-rotate` class with staggered `animationDelay`). Position: under the active phase line, mono small (~11–12px), zinc-500/600 muted.

The active phase changes as phases complete. When BASE completes and BUILD becomes active, the flavour text crossfades to BUILD's 5 lines. Implementation note: keying the rotating text element on `phase.phase` will cause React to unmount/remount when the active phase changes, triggering CSS animation reset — clean enough.

### Step 6 — Honest timing copy + prominent elapsed timer

Replace the bottom-right corner timer with a center-bottom paired line:

```
1:43 elapsed · usually 3–5 minutes
```

Styling:
- Position: `bottom-9` left/right auto-centered (`left-1/2 -translate-x-1/2`)
- Font: mono 13–14px, zinc-500/600 for the elapsed number (slightly more contrast than the "usually" half)
- Pulse the colon: the `:` in `1:43` gets a subtle `vert-pulse-colon` animation (or reuse `vert-pulse-dot` with `text-emerald-500`) so the user sees a per-second tick

Apply the same "USUALLY 3–5 MINUTES" copy update to the wizard's `GeneratingState` footer in `GeneratingDoneStates.tsx` (replacing "USUALLY 5–15 SECONDS"). The component is doomed in Phase 2.6 but until then it should match.

### Step 7 — Cache-hit instrumentation

In `lib/claude.ts` `callClaudeOnce` (or in the metric-emission helpers it calls), capture `usage.cache_read_input_tokens` and `usage.cache_creation_input_tokens` from the Anthropic response. Add them to the `PlanGenMetrics` shape in `lib/plan-gen-metrics.ts`:

```ts
export interface PlanGenMetrics {
  tokens_in: number;
  tokens_out: number;
  cache_read_input_tokens: number;   // NEW
  cache_creation_input_tokens: number; // NEW
  duration_s: number;
  // ... rest unchanged
}
```

Update `buildPlanGenMetrics` to accept + emit them. Update `lib/plan-gen-metrics.test.ts` with one or two tests covering the new fields.

**What we expect after deploy:** on a fresh regen, the first phase call (or meta-plan call) shows `cache_creation_input_tokens > 0` and `cache_read_input_tokens = 0`. Subsequent phase calls show `cache_read_input_tokens > 0` (close to the system-prompt size) and `cache_creation_input_tokens = 0`. If we see zero cache reads on phases 2–4, that's a diagnostic signal that something is invalidating the cache key — we'd address in a follow-up PR.

### Steps 8 + 9 — Phase 2.5.1 deferred review fixes

**8a.** In `lib/plan-generation-orchestrator.ts` `runFinalize`, add a comment on the validation-failure path:

```ts
// EDGE CASE: if the assembled-plan validator fails here (rare —
// indicates an inter-phase gap that the per-phase validator didn't
// catch), Resume from this point would re-run runFinalize against
// the same workouts and fail the same way. The user effectively
// needs a fresh regen, not a resume. Worth tracking if we see this
// in production logs; the per-phase validators should catch most
// gap cases before we reach here.
```

**8b.** Update `advanceJob`'s success return shape in `app/actions.ts` to include `workoutCount`:

```ts
return {
  ok: true,
  status: "pending",
  completedPhases: phaseResult.completedPhases,
  workoutCount: phaseResult.workouts.length, // NEW
  previewId: null,
};
```

Then in `GeneratingPhaseState`'s loop, use the returned `workoutCount` directly and skip the `getGenerationJobStatus` refetch between phases. Save 4 DB reads per regen — small win.

### Step 10 — Tests

- Update `plan-generation-orchestrator.test.ts` with tests for `precreateGenerationJob` (separately from `runKickoff`) and `runMetaPlanForJob`. Mock the meta-plan call.
- Update `plan-gen-metrics.test.ts` to cover the new cache-read fields.
- Add tests for the phase-aware flavour text mapping (`PHASE_FLAVOUR` lookup, one assertion per phase that the 5 lines are returned correctly).
- Update `GeneratingPhaseState` smoke test for the kicking-off → pending transition (mock `runMetaPlanForJob` to return success, verify the component transitions).
- Existing tests should still pass without modification.

### Step 11 — Manual smoke

Local dev with feature flag on:

1. Click Regenerate. **Sheet should close in under 2 seconds** (the precreate action's ~50ms).
2. Route should immediately be `/regen?job=<id>`.
3. Building page first shows the "— DESIGNING YOUR TRAINING ARC" kicking-off state for ~8–10s while meta-plan runs.
4. Building page transitions to show the 4 phase rows + flavour text rotating under the active phase.
5. Flavour text rotates every 3s with the right lines for the active phase.
6. Elapsed timer ticks visibly at center-bottom; the colon pulses.
7. As each phase completes, the checkmark appears and the flavour text crossfades to the next phase's lines.
8. Total wall-clock ~3–5 minutes; final routing to the regen preview diff.

Also verify the failure path: simulate a meta-plan failure (temporarily edit `generateMetaPlan` to throw) → friendly error UX renders → Resume CTA visible.

## What you must NOT do

- Do not change `generatePhase` or per-phase prompt logic. The trim applies to `generateMetaPlan` only.
- Do not modify the `plan_generation_jobs` table schema beyond the single-line status check constraint update.
- Do not implement parallel phase generation. That's deferred to Phase 5.
- Do not implement differential `why` caps. That's also deferred to Phase 5.
- Do not refactor anything outside the scope of these six items.
- Do not introduce any `any` types.

## Quality bar (per AGENTS.md)

- Comments explain why, not what. JSDoc on every new exported function.
- TypeScript strict; no `any`.
- New Vitest tests for the new helpers + components.
- shadcn/ui primitives where applicable (probably not needed for this PR).
- When the PR is ready, suggest Ben review in Cowork before merging.

## Verification before declaring done

- `npm run lint` — zero errors.
- `npm run build` — succeeds.
- `npm run test` — full suite passes (count should go up by ~5–8 tests).
- Local manual smoke (sheet → kicking-off → phase progress → done) works end-to-end.

## Done definition

- All 11 implementation steps complete.
- Sheet closes in under 2 seconds of clicking Regenerate.
- Building page renders kicking-off state, then phase progress, with rotating flavour text per phase and a prominent center-bottom elapsed timer.
- The `[plan-gen-metrics]` log line now includes `cache_read_input_tokens` and `cache_creation_input_tokens` fields.
- PR description includes: link to `PROJECT_BRIEF.md` Phase 2.5.2 section, summary of the six items, screenshot of the new building page mid-regen with the rotating text + prominent timer visible, the deploy steps (one migration to run, no env vars).
- Suggest Ben review in Cowork before merging.

## Operational deploy notes for Ben (not your work)

After merge:

1. **Vercel auto-deploys** on push to main.
2. **Apply the new migration to production Supabase** — same pattern as previous migrations (Dashboard SQL Editor or `supabase db push`).
3. **No env var changes.** `PLAN_CHUNKING_ENABLED` keeps its current value.
4. **Test once on prod:**
   - Click Regenerate. Sheet should close in under 2 seconds.
   - Building page shows the kicking-off state, transitions to phase progress, rotating text changes per phase.
   - After regen completes, check Vercel logs for the `[plan-gen-metrics]` lines — should now include `cache_read_input_tokens`. On phases 2–4, that field should be non-zero (confirms caching is working). If zero, paste the log lines back to Ben for diagnosis.

Good luck. The spec has the answers — when in doubt, re-read the relevant section before improvising.
