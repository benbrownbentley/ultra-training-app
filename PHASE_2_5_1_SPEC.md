# Phase 2.5.1 — Kickoff + Advance Refactor — Implementation Spec

_Drafted: 2026-05-22. Author: Claude + Ben. Status: design — not yet implemented._

> **Purpose.** Surgical refactor of the chunked-generation orchestrator that shipped in Phase 2.5. The chunking architecture itself is correct — plans now generate completely through race day, no tail-drop. But the orchestrator runs all phases synchronously inside `previewPlan` / `submitWizard`, so the user sees a 4-minute button spinner instead of the per-phase progress UI that Phase 2.5's spec called for. This phase splits the orchestrator into a fast `kickoffGeneration` (returns jobId after ~10s) and a polled `advanceJob` (runs one phase per call), letting the client orchestrate the loop. The UX matches what was originally promised; plan quality and generation logic stay identical.
>
> **Why this happened.** The root cause was in my Phase 2.5 spec, not Claude Code's implementation. `CHUNKING_SPEC.md` §3.6 described the orchestrator as "spawn meta-plan, then loop through phases" without separating the action that *returns the jobId fast* from the action that *runs the phase loop*. The implementation faithfully ran the whole loop inside the action — correct per spec, wrong per intent. The client never receives a jobId until the entire pipeline finishes, so the polling progress UI never gets to render.
>
> **Scope cap.** This is a refactor, not a new feature. No new Claude calls, no new tool schemas, no new database tables, no env var changes. The Phase 2.5 surface (orchestrator types, `plan_generation_jobs` table, `GeneratingPhaseState` component, `validateMetaPlan` / `validatePhaseChunk` validators) all stays. We're rewiring how the server actions return and how the client drives the loop.

---

## 1. Current state (what's wrong)

After Phase 2.5 deploy on 2026-05-22, the regen flow looks like:

1. User clicks Regenerate in the sheet
2. Sheet button shows "Regenerating…" (a button-level spinner)
3. **`previewPlan` server action fires** and awaits the entire orchestrator pipeline:
   - Calls `generateMetaPlan` (~10s)
   - Inserts `plan_generation_jobs` row
   - Calls `runPhasesAndCommit` which **loops through every phase synchronously**, awaiting each `generatePhase` (~20-60s each)
   - Calls the final validator + `commit_plan_preview` RPC
   - Returns after ~4 minutes total
4. Sheet finally closes
5. Router pushes to `/regen?preview=<id>` showing the diff

The `GeneratingPhaseState` component, the `/regen?job=<id>` route, the `getGenerationJobStatus` polling endpoint — all of these exist and are wired correctly. They just never render in practice because step 3 doesn't return a jobId until everything is done.

The wizard flow has the same problem: `submitWizard` awaits the full pipeline, so the wizard's `GeneratingState` rotates its 4-line text for ~4 minutes before the wizard transitions to `DoneState`.

The job row IS getting updated incrementally as each phase completes (good — the `update plan_generation_jobs set completed_phases = …` calls run after each phase). So if you opened a SECOND browser tab to `/regen?job=<id>` mid-pipeline, the polling progress UI would actually work. The bug is that the FIRST tab — the one that fired the action — is blocked awaiting the full return.

---

## 2. Target state (what the UX should be)

After Phase 2.5.1, the regen flow looks like:

1. User clicks Regenerate in the sheet
2. Sheet button shows "Regenerating…"
3. **`previewPlan` server action fires** and awaits only `kickoffGeneration`:
   - Calls `generateMetaPlan` (~10s)
   - Inserts `plan_generation_jobs` row
   - Returns `{ ok: true, jobId }` after ~10–15s
4. Sheet closes, router pushes to `/regen?job=<id>`
5. `GeneratingPhaseState` component mounts
6. Component calls `advanceJob(jobId)` to run phase 1 (BASE). ~20–60s.
7. When `advanceJob` returns with the updated job state showing BASE complete, component re-renders progress ("BASE phase ✓ · BUILD phase generating…") and immediately fires `advanceJob` again for BUILD.
8. Repeat for PEAK, TAPER.
9. Final `advanceJob` call runs the assembled-plan validator + commits via `commit_plan_preview` RPC. Returns `{ status: "complete", previewId }`.
10. Component routes to `/regen?preview=<previewId>` showing the diff.

Same final destination, same plan, but the user sees real progress signal throughout the ~4-minute wait instead of a frozen button.

Wizard flow is identical except step 4 transitions in place to `GeneratingPhaseState` instead of routing to `/regen?job=<id>`.

---

## 3. Architecture

### 3.1 Server actions

Three new exported server actions in `app/actions.ts`. Two are renames/extractions of existing behavior; one is genuinely new.

**`kickoffGeneration(args)`** — new action. Wraps the meta-plan + job-insert step.

```ts
export async function kickoffGeneration(
  args: GenerationKickoffArgs,
): Promise<{ ok: true; jobId: number } | PlanGenFailure>;
```

Internally calls the existing `runKickoff` orchestrator helper (extracted from `runGenerationPipeline`). Returns the jobId to the caller. Wall-clock budget: ~10–15s.

Replaces what `previewPlan` and `submitWizard` currently call. Both of those actions become thin wrappers that gather inputs and call `kickoffGeneration`.

**`advanceJob(jobId)`** — new action. Runs ONE phase per call.

```ts
export async function advanceJob(
  jobId: number,
): Promise<
  | { ok: true; status: "pending" | "complete"; completedPhases: GenerationPhase[]; previewId?: number }
  | PlanGenFailure & { jobId: number }
>;
```

Internally:
1. SELECTs the job row (RLS-scoped to current user).
2. Identifies the next phase: first entry in `meta_plan.phases` whose name isn't in `completed_phases`.
3. If a pending phase exists → calls `runOnePhase` (new helper). Returns updated job state.
4. If no pending phase remains → calls `runFinalize` (new helper). Returns `{ status: "complete", previewId }`.
5. If anything fails → marks job failed, returns `PlanGenFailure` with `jobId` so the client can offer Resume.

Wall-clock per call: ~20–60s (one phase) or ~2s (finalize step).

**`getGenerationJobStatus(jobId)`** — already exists. Stays as-is. Used as a fallback poll if the client wants to re-sync state (e.g., after a tab refocus, or to verify a phase actually completed if `advanceJob` got cut off mid-call).

### 3.2 Orchestrator helper functions

Inside `lib/plan-generation-orchestrator.ts`, extract three helpers from the current `runGenerationPipeline` / `runPhasesAndCommit` body:

**`runKickoff(args)`** — meta-plan + job insert.

```ts
async function runKickoff(args: RunGenerationArgs): Promise<
  { ok: true; jobId: number; metaPlan: MetaPlan } | RunGenerationFailure
>;
```

Steps:
1. Cancel any prior pending jobs for this user (existing `cancelAllPendingJobs`).
2. Call `generateMetaPlan`. On failure, return failure.
3. Enrich the meta-plan with `weeks` counts (existing `enrichPhaseWeeks`).
4. Validate the meta-plan against the validator (`validateMetaPlan`). On failure, return failure.
5. INSERT the job row with `status: pending`, `completed_phases: []`, `partial_workouts: []`.
6. Return `{ ok: true, jobId, metaPlan }`.

**`runOnePhase(args, jobId, phaseToRun)`** — single phase generation + row update.

```ts
async function runOnePhase(
  args: RunGenerationArgs,
  jobId: number,
  phaseToRun: PhaseMetadata,
  metaPlan: MetaPlan,
  completedPhases: GenerationPhase[],
  partialWorkouts: GeneratedWorkout[],
  priorSummaries: GenerationSummary[],
): Promise<
  | { ok: true; completedPhases: GenerationPhase[]; workouts: GeneratedWorkout[]; summaries: GenerationSummary[] }
  | RunGenerationFailure & { jobId: number }
>;
```

Steps:
1. Build prior-phase summaries (existing `buildPriorPhaseSummaries`).
2. Call `generatePhase` with the phase + prior context. On failure, mark job failed, return failure with jobId.
3. Validate the phase chunk (`validatePhaseChunk`). On failure, mark job failed, return failure with jobId.
4. Append phase workouts + summary to the accumulators.
5. UPDATE the job row with new `completed_phases` and `partial_workouts`.
6. Return `{ ok: true, completedPhases, workouts, summaries }`.

**`runFinalize(args, jobId, allWorkouts, allSummaries)`** — final validation + commit.

```ts
async function runFinalize(
  args: RunGenerationArgs,
  jobId: number,
  allWorkouts: GeneratedWorkout[],
  allSummaries: GenerationSummary[],
  metaPlan: MetaPlan,
): Promise<
  { ok: true; previewId: number } | RunGenerationFailure & { jobId: number }
>;
```

Steps:
1. Call the assembled-plan `validateGeneratedPlan` (catches inter-phase gaps).
2. On failure → mark job failed, return failure.
3. If `trigger === "wizard"`: call `commit_plan_preview` RPC directly (wizard skips the preview screen).
4. If `trigger === "regen"`: insert a `plan_previews` row, return the previewId for the diff page.
5. UPDATE the job row to `status: complete`, `completed_at: now()`.
6. Return `{ ok: true, previewId }`.

The existing `runGenerationPipeline` and `runPhasesAndCommit` functions stay reachable for tests + the resume path, but they're no longer called from the action layer. They become composition wrappers: `runGenerationPipeline = runKickoff → loop runOnePhase → runFinalize`. The action layer (`kickoffGeneration` and `advanceJob`) calls the individual helpers directly.

### 3.3 Client orchestration (the loop)

`GeneratingPhaseState` becomes the orchestrator on the client. Pseudocode:

```tsx
function GeneratingPhaseState({ jobId }: { jobId: number }) {
  const router = useRouter();
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<PlanGenErrorCode | null>(null);
  const [isAdvancing, startAdvance] = useTransition();

  // On mount: fetch current status, then start advancing.
  useEffect(() => {
    let cancelled = false;
    async function loop() {
      // Sync to current state in case we're resuming mid-pipeline.
      const initial = await getGenerationJobStatus(jobId);
      if (cancelled) return;
      if (!initial.ok) { setError("unknown"); return; }
      setJob(initial);

      let current = initial;
      while (!cancelled && current.status === "pending") {
        const result = await advanceJob(jobId);
        if (cancelled) return;
        if (!result.ok) { setError(result.code); return; }
        setJob(result);
        current = result;
      }
      if (current.status === "complete" && current.previewId != null) {
        router.push(`/regen?preview=${current.previewId}`);
      }
    }
    loop();
    return () => { cancelled = true; };
  }, [jobId, router]);

  if (error) return <GeneratingErrorState code={error} onResume={...} />;
  return <PhaseProgressUI job={job} />;
}
```

Key points:

- **Sequential, not parallel.** Each `advanceJob` waits for the previous one to return. Phases run in order. Simpler reasoning, correct behavior.
- **Cancellation on unmount.** If the user navigates away, the `cancelled` flag stops the loop. The next `advanceJob` call doesn't fire. The job row stays in whatever state the last completed phase left it. A future visit to `/regen?job=<id>` would resume.
- **No external polling needed for the main path.** Each `advanceJob` return updates state. Optional: an explicit `getGenerationJobStatus` poll on tab focus / visibility change for robustness — but not required for the basic flow.
- **Resume on error.** The error state has a button that re-runs the loop (re-fires `advanceJob` from the failed phase). The orchestrator's resume logic already supports picking up from `completed_phases`.

### 3.4 Wizard flow

`WizardClient` already has a `submit()` function that calls `submitWizard` and transitions through `generating` → `generating-error` → `done` states based on the result. Update it so:

1. `submit()` calls the new (renamed) `submitWizard` that returns `{ ok: true, jobId }` quickly instead of awaiting the whole pipeline.
2. On `{ ok: true, jobId }` → transition to a new `generating-phases` step (replaces the current `generating` step for the chunked path).
3. The `generating-phases` step renders `GeneratingPhaseState` (same component used by the regen flow) with the jobId.
4. When `GeneratingPhaseState` completes, it calls back into the wizard via a `onComplete` prop (or via router navigation to `/`). Wizard transitions to `done` step.
5. The existing `generating-error` step stays — it now handles errors from any phase, not just the initial pipeline.

The wizard's atmospheric `GeneratingState` component (with rotating text) becomes legacy code — kept around for the feature-flag-off path, deleted in Phase 2.6 cleanup.

### 3.5 Regen sheet flow

`RegenerateSheet`'s submit handler currently does:

```ts
const r = await previewPlan(notes);
if (!r.ok) { onClose(); router.push(`/regen?error=...`); return; }
onClose();
router.push(`/regen?preview=${r.previewId}`);
```

Becomes:

```ts
const r = await previewPlan(notes); // now returns { ok: true, jobId } after ~15s
if (!r.ok) { onClose(); router.push(`/regen?error=...`); return; }
onClose();
router.push(`/regen?job=${r.jobId}`); // KEY CHANGE: route to job page, not preview page
```

The `/regen/page.tsx` already handles `?job=<id>` by rendering `GeneratingPhaseState`. So once the sheet routes there, the existing chunking UI takes over.

### 3.6 What stays the same

- The `plan_generation_jobs` table schema. No migration needed.
- The Claude tools (`META_PLAN_TOOL`, `submit_training_plan`). No tool schema changes.
- The validators (`validateMetaPlan`, `validatePhaseChunk`, `validateGeneratedPlan`). No validator changes.
- The legacy `generateTrainingPlan` function. Stays behind the feature flag, untouched.
- The `[plan-gen-metrics]` log lines. Still emitted per phase, just from the `advanceJob` call site instead of inside `runPhasesAndCommit`.
- The `resumeGenerationJob(jobId)` action. Stays — it's now effectively a wrapper around "start the advance loop from `/regen?job=<id>`" since the client-side loop handles resume naturally.

---

## 4. Implementation steps (one PR)

Surgical. Estimate one focused Claude Code session.

### Step 1 — Extract orchestrator helpers
1. Open `lib/plan-generation-orchestrator.ts`. Locate `runGenerationPipeline` and `runPhasesAndCommit`.
2. Extract `runKickoff` (steps 1–6 from current `runGenerationPipeline` body).
3. Extract `runOnePhase` (one iteration of the for-loop inside `runPhasesAndCommit`).
4. Extract `runFinalize` (the assembled-plan validation + commit logic at the end of `runPhasesAndCommit`).
5. Rewrite `runGenerationPipeline` and `runPhasesAndCommit` as compositions of the three helpers (so existing tests still work).
6. Verify all existing tests still pass — this should be a no-op refactor at the public API.

### Step 2 — Add `advanceJob` server action
7. In `app/actions.ts`, add the new `advanceJob(jobId)` action. Implementation per §3.1.
8. Make sure RLS scoping is correct — every SELECT/UPDATE on `plan_generation_jobs` filters by `user_id` (defense in depth alongside RLS policies).
9. Wire `[plan-gen-metrics]` emission from inside `runOnePhase` so we still get per-phase log lines.

### Step 3 — Rewire `previewPlan` and `submitWizard`
10. Update `previewPlan`: replace the `runGenerationPipeline` call with `runKickoff`. Return `{ ok: true, jobId }` instead of `{ ok: true, previewId, jobId }`. (The `previewId` won't exist yet — it comes from the final `advanceJob` call.)
11. Update `submitWizard`: same change. Return `{ ok: true, jobId }` early.
12. Update `createJournalEntry`'s regen-after path: same — route to `/regen?job=<id>` instead of `/regen?preview=<id>`.

### Step 4 — Update client surfaces
13. Update `RegenerateSheet.tsx`: route to `/regen?job=<id>` on kickoff success.
14. Update `WizardClient.tsx`: add the `generating-phases` step. Transition to it on `submitWizard` success. Render `GeneratingPhaseState` with the jobId. Transition to `done` step when the component completes.
15. Update `GeneratingPhaseState` to drive the advance loop client-side per §3.3 pseudocode. The component now owns the loop, not the server.
16. Verify `/regen/page.tsx`'s `?job=<id>` branch still routes correctly to `GeneratingPhaseState`. Should already work post-Phase-2.5.

### Step 5 — Update error / resume paths
17. The `GeneratingErrorState` (wizard) and `StateError` (regen) Resume buttons currently call `resumeGenerationJob(jobId)`. Behavior is the same — the resume path picks up from the failed phase via the same advance loop. Verify nothing breaks.
18. If the resume path was awaiting the full pipeline post-failure, change it to behave identically to kickoff: return early with the jobId, let the client-side loop drive.

### Step 6 — Tests
19. Update existing orchestrator tests in `lib/plan-generation-orchestrator.test.ts`:
   - Add tests for `runKickoff` happy path + failure modes.
   - Add tests for `runOnePhase` happy path + failure modes.
   - Add tests for `runFinalize` (assembled-plan validation + commit).
   - Keep the existing `runGenerationPipeline` / `runPhasesAndCommit` tests — they exercise the composition.
20. Add a test for `advanceJob` in a new specs file or extend an existing one. Mock the orchestrator helpers; verify the action picks the right next phase, handles failure correctly, returns `complete` when the last phase finishes.
21. Add a smoke test for the client-side advance loop in `GeneratingPhaseState`. Use React Testing Library or similar; mock the server actions; verify the loop fires `advanceJob` once per phase and re-renders progress between calls.

### Step 7 — Manual smoke
22. Local dev: full wizard run with feature flag on. Verify the wizard transitions to the phase-progress screen within ~15s, then progresses through all four phases visibly, then lands on the done state.
23. Local regen: open the regen sheet, click Regenerate. Verify the sheet closes within ~15s, routes to `/regen?job=<id>`, shows phase progress, then routes to `/regen?preview=<id>`.
24. Forced failure: temporarily edit `generatePhase` to throw on BUILD phase. Verify the user sees the friendly error state with a Resume button. Click Resume. Verify it picks up at BUILD and completes the rest of the pipeline.
25. Run `npm run lint`, `npm run test`, `npm run build`. All clean.

---

## 5. What could go wrong (and the mitigation)

**Risk: Client-side loop races.** If the user double-clicks Resume, or `useEffect` runs twice in dev mode (StrictMode does this), `advanceJob` could fire twice for the same phase. Mitigation: `advanceJob` is idempotent because it checks `completed_phases` before running. If phase BASE is already in `completed_phases`, advanceJob picks the NEXT pending phase. No duplicate phase generations.

**Risk: Tab close mid-pipeline.** User closes browser during phase BUILD. The current `advanceJob` finishes server-side (Vercel doesn't kill a function just because the client disconnects). The job row gets updated. Subsequent phases don't fire because no one's calling `advanceJob`. Mitigation: the next visit to `/regen?job=<id>` (or a "Resume" link on Today) picks up the loop from the current `completed_phases`. Already supported by the orchestrator.

**Risk: Stale job row from a prior cancelled generation.** A user clicks Regenerate, cancels mid-pipeline, then clicks Regenerate again. `runKickoff` already calls `cancelAllPendingJobs` first, so the prior row is marked cancelled before a new one is inserted. No collision.

**Risk: `advanceJob` taking longer than expected.** If a single phase legitimately takes > 60s (e.g., PEAK on a long-window plan), Vercel's 300s budget per call still covers it. No timeout concern.

**Risk: The legacy `runGenerationPipeline` and the new client-driven loop drift over time.** Mitigation: deferred to Phase 2.6 cleanup, which deletes `runGenerationPipeline` and the feature flag once chunking has burned in.

---

## 6. Done definition

- All Vitest tests pass with the new specs + the existing ones unchanged.
- `npm run lint` clean. `npm run build` clean.
- Local smoke (wizard, regen, forced failure with Resume) all work end-to-end.
- The regen sheet closes within ~15s of clicking Regenerate. The `/regen?job=<id>` page renders `GeneratingPhaseState` with visible per-phase progress that updates as each phase completes.
- PR description includes: link to this spec, screenshots of the new progress UI in action, the deploy steps (which are minimal — code-only refactor).

## 7. Deferred / out of scope

- No changes to `plan_generation_jobs` schema, validators, Claude calls, system prompts, or the feature flag.
- No SSE / streaming responses — polling-by-explicit-call stays.
- No background-job infrastructure (Inngest, QStash, waitUntil) — that's v3+ scope.
- Legacy `generateTrainingPlan` deletion stays in Phase 2.6.
- The week-numbering fencepost bug (race day labeled "WK 13/14" with no week 14) stays in Phase 3 polish — separate concern, single line fix in `lib/plan-derive.ts:128`.

---

## 8. Status

- [x] §1 Current state diagnosed
- [x] §2 Target state described
- [x] §3 Architecture (actions, helpers, client loop, wizard, regen, what stays)
- [x] §4 Implementation steps (one PR, 7 step groups)
- [x] §5 Risk register
- [x] §6 Done definition
- [x] §7 Deferred
- [ ] Spec reviewed by Ben
- [ ] PR opened
- [ ] PR merged + deployed
- [ ] Verified end-to-end on prod (sheet closes fast, progress UI renders, plan completes)
