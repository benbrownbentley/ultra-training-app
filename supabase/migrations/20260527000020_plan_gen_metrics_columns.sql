-- Phase 2.5 instrumentation expansion. Adds per-job timing and retry
-- counters so the SQL editor can answer p50/p95 latency and error-rate
-- questions without scraping Vercel logs. All columns nullable (or
-- defaulted) — old rows stay readable; the orchestrator fills these as
-- new jobs run. See PROJECT_BRIEF.md → "Regen latency investigation".

begin;

alter table public.plan_generation_jobs
  add column if not exists meta_duration_ms integer,
  add column if not exists total_duration_ms integer,
  add column if not exists validator_retries integer not null default 0,
  add column if not exists total_tokens_in integer,
  add column if not exists total_tokens_out integer;

-- Index on completed_at for the rolling-window analysis queries.
-- Existing rows have null completed_at where status != 'complete' so
-- the index is sparse — appropriate for "last 14 days complete jobs".
create index if not exists plan_generation_jobs_completed_at_idx
  on public.plan_generation_jobs (completed_at desc)
  where completed_at is not null;

-- Comments live inside the transaction so the migration is fully
-- atomic — either columns + index + comments all land, or none do.
comment on column public.plan_generation_jobs.meta_duration_ms is
  'Wall-clock ms spent in the meta-plan Claude call (runMetaPlanForJob). Null until the meta call returns.';
comment on column public.plan_generation_jobs.total_duration_ms is
  'Wall-clock ms from precreate insert to terminal status (complete or failed). Null until terminal.';
comment on column public.plan_generation_jobs.validator_retries is
  'Cumulative validator retries across all phase calls. 0 when no phase needed a retry.';
comment on column public.plan_generation_jobs.total_tokens_in is
  'Sum of input tokens across all phases (meta excluded until generateMetaPlan exposes usage). Null until first phase lands.';
comment on column public.plan_generation_jobs.total_tokens_out is
  'Sum of output tokens across all phases (meta excluded until generateMetaPlan exposes usage). Null until first phase lands.';

commit;
