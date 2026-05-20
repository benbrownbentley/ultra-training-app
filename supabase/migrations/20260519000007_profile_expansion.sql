-- Profile expansion — multi-race calendar + richer athlete profile.
--
-- The race table grows a `priority` column ('A'|'B'|'C') so multiple races
-- can coexist; the A race remains the plan target. The athlete profile
-- grows ~20 columns that the /profile/athlete form needs to round-trip.
-- All new columns are nullable so existing rows keep working without a
-- backfill.

-- 1. Race priority + multi-race support
alter table race
  add column if not exists priority text not null default 'A'
    check (priority in ('A', 'B', 'C', 'completed')),
  add column if not exists elevation_loss integer,
  add column if not exists cutoff_time text,
  add column if not exists climate text,
  add column if not exists course_profile text,
  add column if not exists support text;

create index if not exists race_user_priority_idx
  on race (user_id, priority, date);

-- 2. Athlete profile — expanded fields
alter table athlete_profile
  -- Fitness baseline
  add column if not exists fitness_rating int check (fitness_rating between 1 and 5),
  add column if not exists weekly_volume_km numeric,
  add column if not exists longest_run_date date,
  -- Experience
  add column if not exists years_running int,
  add column if not exists years_ultras int,
  add column if not exists ultras_completed text,
  add column if not exists longest_race_distance numeric,
  add column if not exists longest_race_name text,
  add column if not exists longest_race_date date,
  add column if not exists previous_endurance text[],
  -- Body
  add column if not exists age int,
  add column if not exists body_weight numeric,
  add column if not exists sex text,
  -- Health
  add column if not exists chronic_conditions text,
  add column if not exists sleep_hours int,
  add column if not exists stress_baseline int check (stress_baseline between 1 and 5),
  -- Schedule
  add column if not exists training_days text[],
  add column if not exists long_run_day text,
  add column if not exists quality_day text,
  add column if not exists strength_freq text,
  add column if not exists time_of_day text,
  add column if not exists job_type text,
  -- Equipment & terrain
  add column if not exists outdoor_terrain text[],
  add column if not exists cross_training_enjoys text[],
  -- HR / fitness markers
  add column if not exists max_hr int,
  add column if not exists resting_hr int,
  add column if not exists lactate_threshold_hr int,
  add column if not exists vo2_max numeric,
  -- Free text preferences
  add column if not exists training_preferences text;
