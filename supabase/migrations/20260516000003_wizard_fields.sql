-- Step 8: extend race and athlete_profile with the fields the intake wizard collects.
-- All new columns are nullable so existing rows continue to work.

alter table race
  add column if not exists elevation_gain_m int,
  add column if not exists terrain text,
  add column if not exists target_time text,
  add column if not exists intent text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'race_terrain_check'
  ) then
    alter table race add constraint race_terrain_check
      check (terrain is null or terrain in ('road', 'mixed', 'trail', 'technical'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'race_intent_check'
  ) then
    alter table race add constraint race_intent_check
      check (intent is null or intent in ('competitive', 'moderate', 'relaxed'));
  end if;
end $$;

alter table athlete_profile
  add column if not exists experience text,
  add column if not exists gym_access text,
  add column if not exists equipment text,
  add column if not exists weekly_hours int,
  add column if not exists cross_training text,
  add column if not exists other_commitments text,
  add column if not exists sleep_stress text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'athlete_profile_gym_access_check'
  ) then
    alter table athlete_profile add constraint athlete_profile_gym_access_check
      check (gym_access is null or gym_access in ('full', 'limited', 'none'));
  end if;
end $$;
