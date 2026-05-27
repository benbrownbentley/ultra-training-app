-- =============================================================
-- Regen latency analysis
-- Run in Supabase SQL editor. Each query is independent; copy
-- the one you need. All queries scope to the rolling 14-day
-- window; widen by editing the `interval` clause.
--
-- Populated by the Phase 2.5 instrumentation batch (migration
-- 20260527000020_plan_gen_metrics_columns.sql). Rows created before
-- that migration have null metrics columns and are filtered out.
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
-- NOTE: meta-call tokens are not yet summed in (generateMetaPlan
-- doesn't surface usage — see TECH_DEBT). These totals are phases-only.
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
