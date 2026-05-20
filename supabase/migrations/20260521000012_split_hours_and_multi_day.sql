-- Polish-2 schema additions:
--
-- 1. weekly_hours_current — "currently training" vs the existing
--    `weekly_hours` which now semantically means "available." Two
--    wizard fields previously both wrote to weekly_hours, silently
--    overwriting whichever was filled last.
--
-- 2. long_run_days / quality_days — replace the single-select
--    `long_run_day` / `quality_day` text columns with text[] so the
--    user can mark multiple eligible days. The single-value columns
--    stay for backwards compat; submitWizard writes both shapes for
--    a release or two, then we can drop the legacy ones.

alter table athlete_profile
  add column if not exists weekly_hours_current numeric,
  add column if not exists long_run_days text[],
  add column if not exists quality_days text[];
