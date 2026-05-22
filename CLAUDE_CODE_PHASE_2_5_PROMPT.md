# Claude Code Prompt — Phase 2.5 (Chunked Plan Generation)

Paste everything below the line into Claude Code in Warp. Self-contained — read the spec, then build.

This is bigger than Phase 2.1 — estimated 2–3 focused sessions. Suggest opening as a long-lived branch and pushing incremental commits rather than one monolithic PR.

---

## Your task

Implement **Phase 2.5** of the Vert roadmap — chunked plan generation. The full design lives in `CHUNKING_SPEC.md` at the repo root. That document is the source of truth — read it end-to-end before writing code.

Phase 2.5 replaces the single-call `generateTrainingPlan` with a multi-call orchestrator pipeline:

1. **Step 0 — Meta-plan call** (~5–10s). Claude returns the periodization phase breakdown only (BASE / BUILD / PEAK / TAPER with date ranges).
2. **Step N — Per-phase generation** (~20–60s each). One Claude call per phase. Each emits the workouts for that phase only, bounded to ~30–45 workouts → ~6–9k tokens.
3. **Orchestrator** stitches phase outputs, runs final validation, commits via the existing `commit_plan_preview` RPC.

The work fixes two production problems that surfaced after Phase 2 shipped:

- **Plan completeness.** A 14-week single-call generation reliably drops the last ~20 days of workouts (validator catches `missing_dates`). Chunking by phase keeps Claude in its coherence sweet spot.
- **Progress UX.** Both wizard and regen flows currently show no real progress during the 60–90s generation wait. Per-phase chunks naturally produce phase-name progress (`— BASE PHASE ✓ · BUILD PHASE generating…`).

**What is NOT the reason for this work** (worth saying explicitly because earlier framing was wrong): this is not about Vercel Hobby's 60s timeout. Vercel Hobby's max duration is 300s as of Feb 2026 — confirmed by web-search against `vercel.com/docs/functions/limitations` on 2026-05-22. The `maxDuration = 300` setting in our code is honored on Hobby. Wall-clock is not the constraint; Claude output coherence at scale is.

## Required reading (in this order, before any code changes)

1. `AGENTS.md` — coding standards, no `any`, JSDoc on exports, Vitest tests for `lib/` business logic, shadcn/ui discipline.
2. `PROJECT_BRIEF.md` — three sections specifically:
   - "Phase 2 deployed 2026-05-22" — the production state and the two production problems this work addresses.
   - "Phase 2.5 — Chunked plan generation" — the high-level phase description (full design lives in CHUNKING_SPEC.md).
   - "Phase 2 timeout-architecture deferrals (2026-05-22)" — what's explicitly OUT of scope and the corrected Vercel limits framing.
3. `CHUNKING_SPEC.md` — **the full design doc**. Sections 3 (Architecture), 5 (Migration), and 6 (Implementation steps) are the most load-bearing. §9 has Ben's locked-in decisions.
4. `PHASE_2_SPEC.md` — read briefly for context on the existing `planned_detail` shape, `why` cap (≤500 chars), and tool schema (`submit_training_plan` in `lib/claude.ts`).
5. `lib/claude.ts` end-to-end — particularly `generateTrainingPlan`, `callClaudeOnce`, the existing PLAN_TOOL, and SYSTEM_PROMPT. You're extracting two new functions (`generateMetaPlan`, `generatePhase`) and keeping the legacy `generateTrainingPlan` in place behind a feature flag.
6. `lib/plan-validation.ts` — you're adding `validateMetaPlan` and `validatePhaseChunk` alongside the existing `validateGeneratedPlan`.
7. `app/actions.ts` — `submitWizard`, `previewPlan`, `createJournalEntry` all need to route through the new orchestrator behind the feature flag.

## Implementation steps

Follow §6 of `CHUNKING_SPEC.md` end-to-end. 32 numbered steps across 9 step groups. Don't skip ahead — the ordering is dependency-correct.

### Sequence summary (full detail in spec §6):

1. **Database (steps 1–2):** create migration `plan_generation_jobs` table per spec §5. Apply to local Supabase. Test RLS.
2. **Types and validator (steps 3–5):** add types per spec §3.2, add `validateMetaPlan` + `validatePhaseChunk` per spec §4, Vitest specs for both.
3. **Claude calls (steps 6–10):** new `META_PLAN_TOOL`, new `generateMetaPlan` function, new `generatePhase` function, META_PLAN_SYSTEM_PROMPT, per-phase prompt addendum, Vitest mocks.
4. **Orchestrator (steps 11–15):** new `lib/plan-generation-orchestrator.ts` with `runGenerationPipeline`. Fresh-start path, resume path, cancel-prior-pending helper, Vitest specs.
5. **Server actions (steps 16–19):** new `getGenerationJobStatus(jobId)` action for polling, route `submitWizard` / `previewPlan` / `createJournalEntry` regen-after through the orchestrator behind the feature flag.
6. **UI (steps 20–24):** new `GeneratingPhaseState` component with 2-second polling, wire into wizard's `WizardClient`, regen sheet's `RegenerateSheet`, `/regen/page.tsx`'s `?job=<id>` branch, and `RegenErrorPage` Resume button.
7. **Feature flag + cleanup (steps 25–27):** wire `PLAN_CHUNKING_ENABLED` env var into both action paths. Leave legacy `generateTrainingPlan` untouched. Note Phase 2.6 cleanup in `PROJECT_BRIEF.md`.
8. **Phase 2.1 follow-up (step 28):** add the `[plan-gen-metrics]` log line on the retry-also-failed throw path in `generateTrainingPlan`. Small fix that was deferred from the Phase 2.1 code review (suggestion #1) — bundle it here since we're touching `lib/claude.ts`.
9. **Tests + verification (steps 29–32):** lint, build, full test suite, manual smoke including a forced phase failure to verify Resume.

## Key design points to lock in

These were resolved with Ben before this prompt; do not re-litigate them in your implementation:

- **Chunks defined by periodization phase** (BASE / BUILD / PEAK / TAPER). NOT fixed-size windows. NOT hybrid.
- **Single screen with per-phase progress.** The progress UI explicitly names phases: `— BASE PHASE · Building the aerobic foundation…` → `— BASE PHASE ✓` → `— BUILD PHASE · Adding race-specific intensity…` and so on. Use status copy in the spirit of Ben's suggestion: "Building base…", "Building build…", "Building peak…", "Building taper…". Athletic-vocabulary voice, em-dash labels, consistent with `StateGenerating.tsx`'s existing pattern.
- **Resume from last successful chunk** on failure (not restart-whole-pipeline). The orchestrator's `resumeJobId` argument is how the Resume button picks up.
- **Applies to both wizard and regen flows.** Same orchestrator, same UI primitive. The wizard transitions to the progress screen in-place; the regen sheet closes and the user routes to `/regen?job=<id>` showing the same progress UI.
- **Polling for progress signal** (not Server-Sent Events). Spec §3.7. 2-second cadence. SSE deferred to Phase 2.6 if polling feels janky.
- **Feature flag `PLAN_CHUNKING_ENABLED`** controls whether the orchestrator runs vs. the legacy single-call path. Default to enabled in dev; flip on in prod after a successful local smoke. Plan to delete the flag and legacy code in Phase 2.6 after ~4 weeks of stable use.

## What you must NOT do

- Do not delete the existing `generateTrainingPlan` function. It stays as the legacy path behind the feature flag. Deletion happens in Phase 2.6 after burn-in.
- Do not change the existing `submit_training_plan` PLAN_TOOL schema or the Phase 2 `planned_detail` discriminator. `generatePhase` reuses the same tool, just with a bounded date window in its prompt.
- Do not change the 500-char `why` cap. That's a separate decision; data from Phase 2.1 metrics will inform a future revisit.
- Do not implement Server-Sent Events. Polling only.
- Do not implement Inngest / QStash / Trigger.dev background jobs. That's v3+ scope per PROJECT_BRIEF.md.
- Do not introduce PostHog, Sentry, or any new external service. We're working within the existing Vercel + Supabase + Anthropic API stack.
- Do not introduce any `any` types. All new types should be explicit (discriminated unions for orchestrator state, zod schemas at action boundaries).
- Do not touch the Phase 3 backlog. Wizard width, password polish, log/unlog toggle — all that comes after Phase 2.5 ships.

## Quality bar (per AGENTS.md)

- Comments explain **why**, not what. Every exported function gets a JSDoc.
- TypeScript strict mode; no `any`.
- Vitest tests for every new function in `lib/`. Snapshot tests OK for the new `GeneratingPhaseState` component but keep them sparse.
- shadcn/ui primitives where applicable (the polling progress component might want a `<Progress>` if you add one — `npx shadcn@latest add progress` is fine).
- When the PR is opened, suggest Ben do a code review in Cowork before flipping the feature flag on in prod (per AGENTS.md item 11).

## Verification before declaring done

Per AGENTS.md item 5:

- `npm run lint` — zero errors.
- `npm run build` — completes successfully.
- `npm run test` — full suite passes. Expect significant increase in test count (multiple new specs for validator + orchestrator + Claude-call mocks).

## Done definition

- The migration runs cleanly on local Supabase, RLS scoping verified.
- `generateMetaPlan` and `generatePhase` both work standalone with mocked Claude responses; tests cover their happy paths + each validation failure mode.
- The orchestrator successfully runs a full 4-phase pipeline on local with mocked Claude calls — meta-plan → BASE → BUILD → PEAK → TAPER → commit. Vitest covers this.
- A forced phase failure (mock `generatePhase` to throw on phase 2) results in a `failed` job row and the UI rendering the Resume button. Clicking Resume picks up at phase 2 and completes successfully.
- The wizard transitions to `GeneratingPhaseState` and updates progress as phases complete.
- The regen sheet closes and routes to `/regen?job=<id>` rendering the same progress UI.
- Both surfaces' error states (`GeneratingErrorState` for wizard, `StateError` via `RegenErrorPage` for regen) render with Resume CTAs wired correctly.
- `PLAN_CHUNKING_ENABLED` env var is documented in `.env.example`.
- PR description includes: (a) link to `CHUNKING_SPEC.md`, (b) summary of what changed, (c) screenshots of the new progress UI mid-generation, (d) the deploy + feature-flag-flip steps for Ben.

## Operational deploy notes for Ben (not implementation work)

When this PR merges:

1. **Code deploys via Vercel auto-deploy on push to `main`** as usual.
2. **Migration must be applied to production Supabase** via Dashboard SQL Editor or `supabase db push`. Same pattern as Phase 2 — this is not automatic.
3. **`PLAN_CHUNKING_ENABLED` env var must be set in Vercel** (Project → Settings → Environment Variables). Start with `false` in production (default off). Verify nothing broke. Then flip to `true` and run a wizard / regen to verify chunking works end-to-end.
4. **Roll-back plan if needed:** flip `PLAN_CHUNKING_ENABLED` back to `false`. No deploy required. The legacy single-call path is still wired and works (other than the tail-drop quality issue we're fixing here).

You — Claude Code — don't need to do any of the above. Just produce the PR and document the deploy steps in the description.

## Where to write

- New file `lib/plan-generation-orchestrator.ts` — orchestrator + types.
- New file `app/_components/<location>/GeneratingPhaseState.tsx` — pick a sensible location. Recommend `app/_components/generating/` since it's shared by wizard + regen surfaces.
- New migration in `supabase/migrations/` — next sequence number.
- Modifications to: `lib/claude.ts`, `lib/plan-validation.ts`, `lib/plan.ts` (or wherever orchestrator types live), `app/actions.ts`, `app/wizard/_components/WizardClient.tsx`, `app/_components/regen/RegenerateSheet.tsx`, `app/_components/regen/RegenPageClient.tsx`, `app/regen/page.tsx`, `app/_components/regen/RegenErrorPage.tsx`.
- Tests alongside source: `lib/plan-validation.test.ts` (extend), `lib/claude.test.ts` (extend), `lib/plan-generation-orchestrator.test.ts` (new).
- Update `.env.example` to document `PLAN_CHUNKING_ENABLED`.

## When you're done

Tell Ben the PR is ready in Warp. Suggest he review in Cowork (per AGENTS.md item 11) before flipping the feature flag on in prod. Surface any open questions from spec §8 that you couldn't resolve on your own (polling cadence, resume CTA wording, etc.).

Good luck. The spec has the answers — when in doubt, re-read the relevant section before improvising.
