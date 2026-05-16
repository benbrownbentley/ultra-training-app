-- Step 8 follow-up: add unit_system to athlete_profile; rename unit-bearing columns to be unit-agnostic.

alter table athlete_profile
  add column if not exists unit_system text not null default 'metric';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'athlete_profile_unit_system_check'
  ) then
    alter table athlete_profile add constraint athlete_profile_unit_system_check
      check (unit_system in ('metric', 'imperial'));
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'athlete_profile' and column_name = 'longest_run_km'
  ) then
    alter table athlete_profile rename column longest_run_km to longest_run_distance;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_name = 'race' and column_name = 'elevation_gain_m'
  ) then
    alter table race rename column elevation_gain_m to elevation_gain;
  end if;
end $$;
