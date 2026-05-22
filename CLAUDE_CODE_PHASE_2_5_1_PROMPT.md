# Claude Code Prompt — Phase 2.5.1 (Kickoff + Advance Refactor)

Paste everything below the line into Claude Code in Warp. Self-contained — read the spec, then refactor.

This is a smaller piece of work than Phase 2.5 — estimated **one focused session**. No new schema, no new Claude calls, no new env vars. It's a surgical refactor that splits the synchronous orchestrator into a fast kickoff action and a polled advance action so the client can drive per-phase progress UI.

---

## Your task

Implement **Phase 2.5.1** of the Vert roadmap — the architectural fix that makes Phase 2.5's per-phase progress UX actually render. The full design is in `PHASE_2_5_1_SPEC.md` at the repo root. That document is the source of truth.

**Context (read first):** Phase 2.5 shipped on 2026-05-22 and successfully fixed the plan-quality issue (no more tail-drop missing-20-days). However, the orchestrator runs all phases synchronously inside `previewPlan` / `submitWizard`, so the sheet button shows a "Regenerating…" spinner for ~4 minutes per regen. The `GeneratingPhaseState` progress UI never renders in practice because no jobId is returned mid-pipeline. Phase 2.5.1 is the fix.

**This is a refactor, not a new feature.** The Claude calls, validators, tool schemas, `plan_generation_jobs` table, and `[plan-gen-metrics]` logging all stay identical. What changes is *how* the server actions return and *who* drives the phase loop (server → client).

## Required reading (in this order, before any code changes)

1. `AGENTS.md` — coding standards. No `any`, JSDoc on exports, Vitest for `lib/` business logic.
2. `PROJECT_BRIEF.md` — read two sections:
   - "Phase 2.5 — Chunked plan generation" (deployed notes) — context on what shipped and what regressed.
   - "Phase 2.5.1 — Kickoff + advance refactor (UX fix)" — high-level description of this work.
3. `PHASE_2_5_1_SPEC.md` — **the full design doc**. Sections 3 (Architecture) and 4 (Implementation steps) are the most load-bearing.
4. `CHUNKING_SPEC.md` — read briefly for context on the existing chunking architecture you're refactoring. Pay attention to §3.6 (orchestrator), §3.7 (polling), §3.8 (UI flow) — those describe the *intended* design that Phase 2.5.1 finally delivers.
5. `lib/plan-generation-orchestrator.ts` end-to-end — particularly `runGenerationPipeline` (around line 110) and `runPhasesAndCommit` (around line 218). You're extracting three helpers from these.
6. `app/actions.ts` — `previewPlan`, `submitWizard`, `createJournalEntry`, `advanceJob` (already exists? check), `getGenerationJobStatus`. The action layer is what's being rewired.
7. `app/_components/regen/RegenerateSheet.tsx` — current submit handler that routes to `/regen?preview=<id>` after the full pipeline. Needs to route to `/regen?job=<id>` after kickoff instead.
8. `app/wizard/_components/WizardClient.tsx` — current `submit()` function that awaits the full pipeline. Needs to transition to the phase-progress screen after kickoff instead.
9. `app/_components/<phase-progress-location>/GeneratingPhaseState.tsx` — the component that currently polls but never gets a jobId fast enough to do anything. Needs to drive the advance loop client-side.
10. `app/regen/page.tsx` — verify the `?job=<id>` branch is wired correctly.

## Implementation steps

Follow §4 of `PHASE_2_5_1_SPEC.md` in order. 25 numbered steps across 7 step groups. The work is dependency-ordered so you can land it incrementally if you want.

### Sequence summary (full detail in spec §4):

1. **Extract orchestrator helpers (steps 1–6):** pull `runKickoff` / `runOnePhase` / `runFinalize` out of `runGenerationPipeline` and `runPhasesAndCommit`. Keep the old functions reachable for tests by rewriting them as compositions of the new helpers. Verify existing tests still pass — this is a no-op refactor at the public API.
2. **Add `advanceJob` server action (steps 7–9):** new action in `app/actions.ts` that runs one phase per call. Internally: SELECT job, find next pending phase, call `runOnePhase` OR `runFinalize` (if no pending phases left), return updated status. RLS-scoped. `[plan-gen-metrics]` emission stays per-phase, just from the new call site.
3. **Rewire `previewPlan` and `submitWizard` (steps 10–12):** they now call only `runKickoff` and return `{ ok: true, jobId }` after ~10–15s. `createJournalEntry`'s regen-after path routes to `/regen?job=<id>` instead of `/regen?preview=<id>`.
4. **Update client surfaces (steps 13–16):** RegenerateSheet routes to `/regen?job=<id>` immediately on kickoff success. WizardClient transitions to a new `generating-phases` step that renders `GeneratingPhaseState`. `GeneratingPhaseState` itself becomes the client-side orchestrator (drives the advance loop via sequential `await advanceJob(jobId)` calls).
5. **Update error / resume paths (steps 17–18):** Resume buttons in both `GeneratingErrorState` (wizard) and `StateError` (regen) re-enter the advance loop, picking up from `completed_phases`. The resume action returns the same `{ ok: true, jobId }` shape so the same UI handles it.
6. **Tests (steps 19–21):** extend orchestrator tests to cover the three new helpers separately. Add a test for `advanceJob` (mock the helpers, verify next-phase selection + failure handling). Smoke test for the client-side advance loop in `GeneratingPhaseState` (React Testing Library, mock server actions, verify the loop fires once per phase).
7. **Manual smoke (steps 22–25):** local wizard run end-to-end, local regen end-to-end, forced phase failure with Resume working, lint + test + build clean.

## Key design points to lock in

These were resolved in the spec; do not re-litigate them:

- **Server actions are sequential, not parallel.** `advanceJob` is called once per phase from the client. The client awaits each call before firing the next. This is intentional — phases need ordering (BUILD depends on BASE summaries, PEAK on BUILD, etc.).
- **Client owns the loop.** Not the server. The server actions stay short (each call fits well under Vercel's 300s budget). The client's `useEffect` + `useTransition` pattern drives the sequence.
- **`advanceJob` is idempotent.** It checks `completed_phases` before running. Re-firing for an already-completed phase picks the NEXT pending phase. Safe under React StrictMode dev double-mounting + accidental double-clicks.
- **No new database schema.** The existing `plan_generation_jobs` table works for this.
- **Legacy `generateTrainingPlan` stays.** Feature flag `PLAN_CHUNKING_ENABLED` still controls chunking on/off. Deletion happens in Phase 2.6 cleanup.
- **`[plan-gen-metrics]` log lines stay.** Just emit them from the new `runOnePhase` location. One line per phase per regen — same shape, same prefix.

## What you must NOT do

- Do not change any Claude tool schemas (`META_PLAN_TOOL`, `submit_training_plan` / PLAN_TOOL). They're correct as-is.
- Do not change any validators (`validateMetaPlan`, `validatePhaseChunk`, `validateGeneratedPlan`). They're correct as-is.
- Do not change the `plan_generation_jobs` schema. No migration needed.
- Do not delete `generateTrainingPlan` or any other legacy code. Phase 2.6 handles that.
- Do not implement Server-Sent Events or streaming responses. Spec is explicit on this.
- Do not introduce `any` types. The new `advanceJob` return shape needs a proper discriminated union.
- Do not touch Phase 3 backlog items (week-numbering bug, log/unlog toggle, password polish, etc.).
- Do not break existing tests. The orchestrator helper extraction should be a no-op at the public API of `runGenerationPipeline` / `runPhasesAndCommit`. Existing tests should pass without modification.

## Quality bar (per AGENTS.md)

- Comments explain **why**, not what. JSDoc on every new exported function.
- TypeScript strict; no `any`.
- New Vitest tests for each new helper + the `advanceJob` action.
- Component smoke test for `GeneratingPhaseState`'s loop.
- When the PR is ready, suggest Ben review in Cowork (per AGENTS.md item 11) before merging.

## Verification before declaring done

Per AGENTS.md item 5:

- `npm run lint` — zero errors.
- `npm run build` — succeeds.
- `npm run test` — full suite passes (count should go up by 5–10 tests).

## Done definition

- All implementation steps in spec §4 completed.
- Local smoke (wizard run, regen, forced failure with Resume) all pass.
- The regen sheet closes within ~10–15 seconds of clicking Regenerate (not the current ~4 minutes).
- `/regen?job=<id>` renders `GeneratingPhaseState` with phase progress updating live (`— BASE PHASE ✓ · BUILD PHASE generating…`) as each phase completes.
- PR description includes: link to `PHASE_2_5_1_SPEC.md`, summary of the refactor, screenshots of the new progress UI mid-generation showing at least one phase transition (e.g., BUILD just completed → PEAK now running), the deploy steps (which are minimal — code-only refactor, no migration, no env var changes).
- Suggest Ben do a code review in Cowork before merging.

## Operational deploy notes for Ben (not your work)

When this PR merges:

1. **Vercel auto-deploys** on push to whatever branch is configured. No new env vars to set, no migration to run.
2. **Existing `PLAN_CHUNKING_ENABLED` env var stays.** Chunking is still gated by the same flag. Phase 2.5.1 only changes how the chunked path behaves; the flag still controls chunking vs. legacy.
3. **No data migration needed.** Any in-flight `plan_generation_jobs` rows from before this deploy are still valid; the new advance loop picks them up correctly via `getGenerationJobStatus` on page mount.

You — Claude Code — don't need to do any of the above. Document them in the PR description so Ben knows what to do after merge.

Good luck. The spec has the answers — when in doubt, re-read the relevant section before improvising.
