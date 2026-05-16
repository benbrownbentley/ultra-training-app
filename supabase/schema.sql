-- Initial schema for the Ultra Training app (v1, single-user).
-- Re-running this script drops and recreates tables, wiping all data.

drop table if exists workouts;
drop table if exists race;

create table race (
  id bigint primary key generated always as identity,
  name text not null,
  distance text not null,
  date date not null,
  created_at timestamptz default now()
);

create table workouts (
  id bigint primary key generated always as identity,
  date date not null,
  kind text not null check (kind in ('run', 'gym', 'mobility')),
  title text not null,
  details text not null,
  position int not null default 0,
  created_at timestamptz default now()
);

create index workouts_date_idx on workouts (date);

alter table race enable row level security;
alter table workouts enable row level security;

create policy "Public read race" on race
  for select using (true);

create policy "Public read workouts" on workouts
  for select using (true);

-- No seed data here on purpose. The intake wizard (/wizard) populates the race
-- and athlete_profile rows, and plan regeneration fills in workouts via
-- generateTrainingPlan(). Re-seeding from SQL would clobber whatever the user
-- has configured through the app.
