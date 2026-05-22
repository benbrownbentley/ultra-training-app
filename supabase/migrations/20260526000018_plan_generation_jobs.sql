-- Phase 2.5: orchestrator job state for chunked plan generation.
-- Additive only — adds plan_generation_jobs without touching existing
-- tables. One row per generation attempt; tracks meta-plan output,
-- which phases have completed, and the running concatenation of
-- workouts so a mid-pipeline failure can be resumed without losing
-- prior work. See CHUNKING_SPEC.md §3.5.

begin;

create table if not exists plan_generation_jobs (
  id               bigserial primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  -- Which UI surface kicked this off. Affects the final-commit step:
  -- 'wizard' commits directly via commit_plan_preview; 'regen' inserts
  -- into plan_previews and returns a previewId so the diff UI lands.
  trigger          text not null check (trigger in ('wizard', 'regen')),
  -- Step 0 result: the periodization breakdown. Shape per
  -- CHUNKING_SPEC.md §3.3.
  meta_plan        jsonb not null,
  -- Array of phase names completed in order, e.g. ["base","build"].
  -- The resume path uses this to skip already-completed phases.
  completed_phases jsonb not null default '[]'::jsonb,
  -- Running concatenation of workouts emitted by each completed phase.
  -- The final-validation step + commit_plan_preview read this.
  partial_workouts jsonb not null default '[]'::jsonb,
  -- Free-text notes the user passed via the regen sheet — preserved so
  -- a resume preserves the user's context for the per-phase prompts.
  notes            text,
  -- Set when trigger='regen' and the orchestrator has reached commit:
  -- references the plan_previews row holding the candidate plan. Null
  -- on wizard runs (no preview row created) and until the regen
  -- pipeline reaches its final step.
  preview_id       bigint references plan_previews(id) on delete set null,
  -- Lifecycle: pending until all phases land, complete after commit,
  -- failed on validation/Anthropic-error after retry, cancelled when
  -- superseded by a newer pending job for the same user.
  status           text not null default 'pending'
    check (status in ('pending', 'complete', 'failed', 'cancelled')),
  -- Captured when status flips to 'failed' so the friendly error UX
  -- can render code-specific copy from PLAN_GEN_ERROR_COPY. Null
  -- until a failure occurs.
  failure_code     text,
  failure_phase    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  completed_at     timestamptz
);

-- The polling path queries "latest job by user" repeatedly during a
-- generation; the index keeps that O(log n). Status is in the index
-- so the "any pending job for this user" cancel-prior helper is fast.
create index if not exists plan_generation_jobs_user_status_idx
  on plan_generation_jobs (user_id, status, created_at desc);

-- updated_at is bumped manually in the orchestrator (no trigger) — the
-- field exists for observability, not for ORM optimistic concurrency.

alter table plan_generation_jobs enable row level security;

-- RLS: own-row only. Mirrors the existing plan_previews pattern.
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
comment on column plan_generation_jobs.meta_plan is
  'Step 0 periodization breakdown. Shape: { phases: PhaseMetadata[] }.';
comment on column plan_generation_jobs.completed_phases is
  'Array of phase names ("base"|"build"|"peak"|"taper") in completion order. Resume path reads this.';
comment on column plan_generation_jobs.partial_workouts is
  'Running array of GeneratedWorkout emitted by completed phases. Final validation + commit consume this.';
comment on column plan_generation_jobs.preview_id is
  'Set when trigger=regen at the commit step. Null on wizard runs (which commit directly).';
comment on column plan_generation_jobs.failure_code is
  'PlanGenErrorCode that landed this job in status=failed. Read by the error UI for code-specific copy.';
comment on column plan_generation_jobs.failure_phase is
  'Which phase tripped the failure (or "meta" for meta-plan failures). Lets Resume restart at the right point.';
