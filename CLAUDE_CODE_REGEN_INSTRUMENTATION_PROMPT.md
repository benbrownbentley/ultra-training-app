# Regen latency instrumentation batch

A diagnostic-only batch. **Do not optimize anything in this PR.** The goal is to land enough instrumentation that one SQL query in the Supabase SQL editor answers "where is the 5-10 minute regen latency actually going?" — and that the data accumulates passively from real usage so the next session can pick an optimization with evidence instead of intuition.

Decided in the Cowork planning pass on 2026-05-27. Context recorded in `PROJECT_BRIEF.md` → "Regen latency investigation" (added in the same pass).

**What we already have (don't redo):**
- Per-phase `[plan-gen-metrics]` JSON log line in `logPhaseMetrics` (lib/plan-generation-orchestrator.ts:767) — tokens in/out, cache hits, duration_s, why-distribution, is_wizard.
- `plan_generation_jobs` row tracks per-phase progress, failure codes, and `created_at` / `updated_at` / `completed_at` timestamps.
- `classifyGenerationError` (lib/plan-gen-result.ts) classifies failures into `generation_timeout` / `validation_failed` / `anthropic_error` / `unknown`.

**What's missing (this batch closes the gaps):**
1. The meta-plan call (`runMetaPlanForJob`) emits no log line — we can't see how much of the wall clock is meta-plan vs. phases.
2. No per-job rollup — no single record says "this whole job took X seconds end-to-end."
3. Validator retries inside a phase aren't surfaced. `retried: false` is hardcoded in `logPhaseMetrics`.
4. Sub-timing within a phase: how much is the Claude API call vs. our supabase update? Both happen inside `runOnePhase` but we only log total elapsed.
5. No queryable surface for trends — Vercel logs are one regen at a time, painful to aggregate.

## Branch + workflow

- Branch off `main`: `regen-instrumentation`
- One PR, suggested commit grouping:
  1. Migration: add metrics columns to `plan_generation_jobs`
  2. Meta-plan timing + log line
  3. Per-phase sub-timing + validator-retry counter
  4. Per-job summary log + row update at finalize / markJobFailed
  5. `docs/queries/regen-latency.sql` (analysis queries)
- After all items land: `npm run typecheck && npm test && npm run lint`.
- Comments match the surrounding bar — every non-trivial block explains **why**, not just what.

---

## Item 1 — Migration: add metrics columns to `plan_generation_jobs`

**Goal:** one row per job that carries the full timing picture. No new table — we already have one row per job; we're enriching it.

**File:** create `supabase/migrations/20260527000001_plan_gen_metrics_columns.sql`

```sql
-- Phase 2.5 instrumentation expansion. Adds per-job timing and retry
-- counters so the SQL editor can answer p50/p95 latency and error-rate
-- questions without scraping Vercel logs. All columns nullable — old
-- rows stay readable; the orchestrator fills these as new jobs run.

alter table public.plan_generation_jobs
  add column if not exists meta_duration_ms integer,
  add column if not exists total_duration_ms integer,
  add column if not exists validator_retries integer not null default 0,
  add column if not exists total_tokens_in integer,
  add column if not exists total_tokens_out integer;

-- Index on completed_at for the rolling-window analysis queries.
-- Existing rows have null completed_at where status != 'complete' so
-- the index is sparse — appropriate for "last 14 days complete jobs."
create index if not exists plan_generation_jobs_completed_at_idx
  on public.plan_generation_jobs (completed_at desc)
  where completed_at is not null;

comment on column public.plan_generation_jobs.meta_duration_ms is
  'Wall-clock ms spent in the meta-plan Claude call (runMetaPlanForJob). Null until the meta call returns.';
comment on column public.plan_generation_jobs.total_duration_ms is
  'Wall-clock ms from precreate insert to terminal status (complete or failed). Null until terminal.';
comment on column public.plan_generation_jobs.validator_retries is
  'Cumulative validator retries across all phase calls. 0 when no phase needed a retry.';
comment on column public.plan_generation_jobs.total_tokens_in is
  'Sum of input tokens across meta + all phases. Null until terminal.';
comment on column public.plan_generation_jobs.total_tokens_out is
  'Sum of output tokens across meta + all phases. Null until terminal.';
```

After writing the migration, **apply it locally** (`npx supabase db reset` if you're using the local stack) and to production via the Supabase SQL editor. Document the apply step in the PR description so we don't forget on deploy.

---

## Item 2 — Meta-plan timing + log line

**File:** `lib/plan-generation-orchestrator.ts` → `runMetaPlanForJob`

Currently `runMetaPlanForJob` calls `generateMetaPlan` with no timing. We need:

1. Time the Claude call.
2. Persist `meta_duration_ms` on the job row in the same UPDATE that flips status to `pending`.
3. Emit a `[plan-gen-metrics]` log line tagged `phase: "meta"` so it shows up next to phase rows in Vercel logs.

**Patch outline (find this block around the existing `generateMetaPlan` call):**

```ts
let metaPlan: MetaPlan;
const metaStartedAt = Date.now();
try {
  metaPlan = await generateMetaPlan({
    race: args.race,
    otherRaces: args.otherRaces,
    profile: args.profile,
    startDate: args.startDate,
  });
} catch (err) {
  // ... existing error path stays; add the metric log just before the return
  const metaDurationMs = Date.now() - metaStartedAt;
  logMetaMetrics({
    durationMs: metaDurationMs,
    ok: false,
  });
  // ... existing markJobFailed + return ...
}
const metaDurationMs = Date.now() - metaStartedAt;

// ... existing enrichPhaseWeeks ...

await supabaseAdmin
  .from("plan_generation_jobs")
  .update({
    meta_plan: enrichedMeta,
    status: "pending",
    meta_duration_ms: metaDurationMs,  // new
    updated_at: new Date().toISOString(),
  })
  .eq("id", args.jobId)
  .eq("user_id", args.user.id);

// Emit alongside the existing per-phase metric lines so log greps pick
// up the meta call too. `generateMetaPlan` doesn't return usage today —
// thread it through if a future change exposes it; for now log zeros.
logMetaMetrics({
  durationMs: metaDurationMs,
  ok: true,
});
```

Add the helper next to `logPhaseMetrics`:

```ts
function logMetaMetrics(args: { durationMs: number; ok: boolean }): void {
  // Meta-plan call is cheap (~10s target) and produces no workouts, so
  // the shape is a stripped-down version of the phase metric. Same
  // [plan-gen-metrics] prefix so a single grep catches everything.
  console.log(
    `[plan-gen-metrics] ${JSON.stringify({
      phase: "meta",
      duration_s: Math.round(args.durationMs / 1000),
      ok: args.ok,
    })}`,
  );
}
```

**Why no usage tokens in the meta log:** `generateMetaPlan` in `lib/claude.ts` doesn't currently return `usage` on its result. Threading it through is a bigger change than this batch needs — note it in the PR description as a follow-up: "Plumb `usage` out of `generateMetaPlan` so meta token counts roll up into `total_tokens_in/out`." Track in TECH_DEBT.md.

---

## Item 3 — Per-phase: sub-timing + validator retries

**File:** `lib/plan-generation-orchestrator.ts` → `runOnePhase`

The current `runOnePhase` measures `durationMs = Date.now() - startedAt` across both the Claude call AND the supabase UPDATE. Split them so we can see whether DB writes are contributing to per-phase latency (unlikely but worth ruling out).

Also: `generatePhase` in `lib/claude.ts` performs the validator-retry-once dance internally. It currently doesn't return whether a retry fired. **Plumb a `retried: boolean` (or better, `validatorRetries: number`) out of `generatePhase` so we can log it accurately.**

Investigate `lib/claude.ts` to find the per-phase retry logic (search for `failed validation after retry` — that string is in `classifyGenerationError`'s check). Modify the return shape:

```ts
// lib/claude.ts — generatePhase return type
export interface GeneratePhaseResult {
  workouts: GeneratedWorkout[];
  summary: GenerationSummary;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
  validatorRetries: number; // 0 if first pass validated; 1 if retry was needed.
}
```

Increment the counter wherever the validator retry path is taken inside `generatePhase`. If the function currently throws after retry exhaustion, the new field is moot for the failure path — only set on success.

Back in `runOnePhase`, thread it into the log line and into a running counter on the job row:

```ts
const phaseStartedAt = Date.now();
const claudeStartedAt = Date.now();
let phaseResult: GeneratePhaseResult;
try {
  phaseResult = await generatePhase({ /* existing args */ });
} catch (err) {
  // ... existing failure path ...
}
const claudeDurationMs = Date.now() - claudeStartedAt;

const dbStartedAt = Date.now();
await supabaseAdmin
  .from("plan_generation_jobs")
  .update({
    completed_phases: nextCompleted,
    partial_workouts: nextWorkouts,
    // Increment the running counter using a raw SQL fragment via .update
    // is awkward; the cleanest path is read-then-write since the value
    // is small and we already hold the prior `completed_phases` array.
    validator_retries: (prevValidatorRetries ?? 0) + phaseResult.validatorRetries,
    updated_at: new Date().toISOString(),
  })
  .eq("id", jobId)
  .eq("user_id", pipelineArgs.user.id);
const dbDurationMs = Date.now() - dbStartedAt;
const phaseDurationMs = Date.now() - phaseStartedAt;
```

For `prevValidatorRetries` — accept it as a new field on the `runOnePhase` args (caller passes it from the loaded job row). `advanceJob` already loads the full job, so plumb `job.validator_retries` through alongside `partial_workouts`.

Then extend the log line:

```ts
logPhaseMetrics({
  phase: phase.phase,
  workouts: phaseResult.workouts,
  durationMs: phaseDurationMs,
  claudeDurationMs,                            // new
  dbDurationMs,                                // new
  validatorRetries: phaseResult.validatorRetries, // new
  // existing fields
  isWizard: pipelineArgs.trigger === "wizard",
  tokensIn: phaseResult.usage.inputTokens,
  tokensOut: phaseResult.usage.outputTokens,
  cacheReadInputTokens: phaseResult.usage.cacheReadInputTokens,
  cacheCreationInputTokens: phaseResult.usage.cacheCreationInputTokens,
});
```

And widen `buildPlanGenMetrics` in `lib/plan-gen-metrics.ts` to carry the new fields. **Keep existing field names stable** — Ben greps the logs and parses with `jq`. Add new fields; don't rename.

```ts
// lib/plan-gen-metrics.ts — extend PlanGenMetrics
export interface PlanGenMetrics {
  // ... existing fields ...
  // New in Phase 2.7 instrumentation:
  claude_duration_s: number;     // wall-clock of the Anthropic SDK call only
  db_duration_s: number;          // wall-clock of the post-call supabase UPDATE only
  validator_retries: number;      // how many times the per-phase validator forced a retry
}
```

Set `retried` (the existing boolean) to `validatorRetries > 0` for backwards compat with any existing log-parsing scripts.

---

## Item 4 — Per-job summary log + terminal row update

**Files:** `lib/plan-generation-orchestrator.ts` → `runFinalize` and `markJobFailed`

When a job reaches a terminal state (complete or failed), emit a single per-job summary line and update the row's totals. This is the row the SQL queries in Item 5 read.

Add a helper. The helper reads the running totals straight off the row (Item 3 increments them during the phase loop) so callers only need to pass the terminal-status fields:

```ts
async function finalizeMetrics(args: {
  jobId: number;
  status: "complete" | "failed";
  failureCode: PlanGenErrorCode | null;
}): Promise<void> {
  // Re-read the job so the summary log + total_duration write see the
  // freshest meta_duration_ms / validator_retries / token totals. The
  // advanceJob path is stateless across calls, so the running totals
  // only exist on the row — not in caller memory.
  const { data: row } = await supabaseAdmin
    .from("plan_generation_jobs")
    .select(
      "created_at, meta_duration_ms, validator_retries, total_tokens_in, total_tokens_out"
    )
    .eq("id", args.jobId)
    .single<{
      created_at: string;
      meta_duration_ms: number | null;
      validator_retries: number;
      total_tokens_in: number | null;
      total_tokens_out: number | null;
    }>();
  if (!row) return; // Defensive — the caller just wrote to this row.

  const totalDurationMs =
    Date.now() - new Date(row.created_at).getTime();

  // Persist on the row so SQL analysis is one query, no log scrape.
  // status + failure_code + completed_at are already set by the caller
  // (runFinalize or markJobFailed) — don't double-write those here.
  await supabaseAdmin
    .from("plan_generation_jobs")
    .update({ total_duration_ms: totalDurationMs })
    .eq("id", args.jobId);

  // One terminal log line per job. Same [plan-gen-metrics] prefix so
  // any grep that finds phase rows finds the summary too.
  console.log(
    `[plan-gen-metrics] ${JSON.stringify({
      phase: "summary",
      status: args.status,
      failure_code: args.failureCode,
      total_duration_s: Math.round(totalDurationMs / 1000),
      meta_duration_s:
        row.meta_duration_ms != null
          ? Math.round(row.meta_duration_ms / 1000)
          : null,
      validator_retries: row.validator_retries,
      total_tokens_in: row.total_tokens_in,
      total_tokens_out: row.total_tokens_out,
    })}`,
  );
}
```

Wire it into both terminal paths in the orchestrator. Order matters: the caller writes its terminal status fields first, then calls `finalizeMetrics` to write `total_duration_ms` and emit the log.

- **`runFinalize`** — after the existing job-row status flip to `complete`, call `finalizeMetrics({ jobId, status: "complete", failureCode: null })`.
- **`markJobFailed`** — after the existing failure UPDATE, call `finalizeMetrics({ jobId, status: "failed", failureCode: code })`. No signature change required; the helper does its own read.

**Token totals tracking (cross-references Item 3):** the per-phase UPDATE in Item 3 must increment `total_tokens_in` and `total_tokens_out` on the row alongside the existing fields — same pattern as `validator_retries`. The advanceJob path is stateless across calls, so the running totals only survive on the row. The migration in Item 1 already includes both columns. Concretely, the Item 3 UPDATE block becomes:

```ts
await supabaseAdmin
  .from("plan_generation_jobs")
  .update({
    completed_phases: nextCompleted,
    partial_workouts: nextWorkouts,
    validator_retries: (prevValidatorRetries ?? 0) + phaseResult.validatorRetries,
    total_tokens_in: (prevTokensIn ?? 0) + phaseResult.usage.inputTokens,
    total_tokens_out: (prevTokensOut ?? 0) + phaseResult.usage.outputTokens,
    updated_at: new Date().toISOString(),
  })
  .eq("id", jobId)
  .eq("user_id", pipelineArgs.user.id);
```

`prevTokensIn` / `prevTokensOut` / `prevValidatorRetries` come from the same job-row read that already happens in `advanceJob` before calling `runOnePhase`. Add them to the `runOnePhase` args next to the existing `completedPhases` / `partialWorkouts` accumulators — keep the pattern consistent.

---

## Item 5 — Analysis queries

**File:** create `docs/queries/regen-latency.sql`

A small SQL playbook the next session can copy-paste into the Supabase SQL editor. Document each query with what it tells us.

```sql
-- =============================================================
-- Regen latency analysis
-- Run in Supabase SQL editor. Each query is independent; copy
-- the one you need. All queries scope to the rolling 14-day
-- window; widen by editing the `interval` clause.
-- =============================================================

-- 1. End-to-end latency distribution (success only).
-- Tells us: is the p50 user experience actually 5 minutes, or is the
-- average pulled by a long tail of outliers?
select
  trigger,
  count(*) as n,
  round(percentile_cont(0.5) within group (order by total_duration_ms) / 1000.0) as p50_s,
  round(percentile_cont(0.95) within group (order by total_duration_ms) / 1000.0) as p95_s,
  round(percentile_cont(0.99) within group (order by total_duration_ms) / 1000.0) as p99_s,
  round(max(total_duration_ms) / 1000.0) as max_s
from public.plan_generation_jobs
where status = 'complete'
  and completed_at > now() - interval '14 days'
  and total_duration_ms is not null
group by trigger;

-- 2. Failure rate + breakdown by code.
-- Tells us: how often are users hitting an error path, and which one?
-- If validation_failed dominates, fix the prompt / validator. If
-- generation_timeout dominates, latency reduction is the unblock.
select
  failure_code,
  count(*) as n,
  round(100.0 * count(*) / sum(count(*)) over (), 1) as pct_of_failures
from public.plan_generation_jobs
where status = 'failed'
  and completed_at > now() - interval '14 days'
group by failure_code
order by n desc;

-- 3. Meta vs. phases time split.
-- Tells us: how much of the wall clock is the meta-plan call vs. the
-- per-phase loop? If meta is 10s and total is 360s, the optimization
-- target is the phases. If meta is 60s, look there first.
select
  round(avg(meta_duration_ms) / 1000.0) as avg_meta_s,
  round(avg(total_duration_ms - meta_duration_ms) / 1000.0) as avg_phases_s,
  round(avg(total_duration_ms) / 1000.0) as avg_total_s,
  count(*) as n
from public.plan_generation_jobs
where status = 'complete'
  and completed_at > now() - interval '14 days'
  and meta_duration_ms is not null
  and total_duration_ms is not null;

-- 4. Validator retry frequency.
-- Tells us: how often is the auto-retry-once path firing? If high,
-- the structural prompt has a quality problem (or the validator is
-- too strict). Each retry adds a full Claude round-trip.
select
  validator_retries,
  count(*) as n
from public.plan_generation_jobs
where completed_at > now() - interval '14 days'
group by validator_retries
order by validator_retries;

-- 5. Token usage distribution.
-- Tells us: are we hitting output-token caps? Average output tokens
-- × ~100 tokens/sec on Sonnet = ballpark of how much latency is
-- "just the streaming." If avg_out is 30k tokens, that's ~5 minutes
-- of pure streaming time even with infinite-compute API.
select
  round(avg(total_tokens_in)) as avg_in,
  round(avg(total_tokens_out)) as avg_out,
  round(percentile_cont(0.5) within group (order by total_tokens_out)) as p50_out,
  round(percentile_cont(0.95) within group (order by total_tokens_out)) as p95_out,
  count(*) as n
from public.plan_generation_jobs
where status = 'complete'
  and completed_at > now() - interval '14 days'
  and total_tokens_out is not null;
```

---

## Verification

After the batch lands and the migration applies:

1. `npm run typecheck && npm test && npm run lint` — clean.
2. Run a fresh wizard locally end-to-end. Check Vercel-style logs (`next dev` console) for:
   - One `[plan-gen-metrics] {"phase":"meta",...}` line.
   - One `[plan-gen-metrics] {"phase":"BASE",...}` per phase (existing).
   - One `[plan-gen-metrics] {"phase":"summary",...}` at the end with non-null `total_duration_s`.
3. In the Supabase SQL editor against local: `select id, status, total_duration_ms, meta_duration_ms, validator_retries from plan_generation_jobs order by id desc limit 5;` — confirm the new columns populate.
4. Run query 1 from `docs/queries/regen-latency.sql` — should return at least one row for the wizard you just ran.
5. Deploy to prod, run two real regens (one wizard, one regen), repeat step 3 + step 4 against prod.

## Out of scope (explicitly do NOT do in this PR)

- **Don't change generation behavior.** No prompt edits, no chunk-size changes, no model swaps, no parallelism.
- **Don't trim output tokens.** That's the next batch, after we read the data this batch surfaces.
- **Don't wire Sentry yet.** Sentry is on Phase 4. The Vercel logs + SQL queries are sufficient for the optimization decision; Sentry adds value for ongoing monitoring post-launch but doesn't change what we learn from the first read.
- **Don't refactor `markJobFailed` into a cleaner pattern beyond what's required to call `finalizeMetrics`.** Keep this PR diff small.

## Follow-ups to track in TECH_DEBT.md

- `generateMetaPlan` doesn't return `usage` — meta tokens currently log as zero. Plumb it through next session.
- The validator retry counter assumes each phase's `generatePhase` exposes `validatorRetries`. If the retry happens at a lower layer (e.g., inside an Anthropic SDK retry policy), the counter undercounts. Audit if numbers look suspiciously low.
- `total_tokens_in/out` currently sum phase calls only. Once meta usage is plumbed, add meta's contribution to the totals so the SQL number matches the real Anthropic bill.
