-- Phase 2.5.2: allow a transient 'kicking-off' status while the
-- meta-plan call runs in the background after precreateGenerationJob
-- returns. Lets the sheet close + the building page render before
-- the slow Anthropic call lands. See PROJECT_BRIEF.md → Phase 2.5.2.

alter table plan_generation_jobs
  drop constraint if exists plan_generation_jobs_status_check;

alter table plan_generation_jobs
  add constraint plan_generation_jobs_status_check
  check (status in ('kicking-off', 'pending', 'complete', 'failed', 'cancelled'));
