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

insert into race (name, distance, date) values
  ('Squamish 50K', '50 km', '2026-08-15');

insert into workouts (date, kind, title, details, position) values
  ('2026-05-11', 'gym',      'Upper body strength', '45 min — push/pull, core finisher',     0),
  ('2026-05-12', 'run',      'Tempo run',           '6 mi @ 7:30 pace',                      0),
  ('2026-05-12', 'gym',      'Core',                '15 min — planks, hollow holds',         1),
  ('2026-05-13', 'run',      'Easy run',            '5 mi conversational',                   0),
  ('2026-05-14', 'run',      'Hill repeats',        '6 mi w/ 6 × 90s climbs',                0),
  ('2026-05-14', 'gym',      'Lower body strength', '45 min — squats, hinges, single-leg',   1),
  ('2026-05-15', 'run',      'Shake-out run',       '3 mi very easy',                        0),
  ('2026-05-15', 'mobility', 'Mobility',            '20 min foam roll + hips',               1),
  ('2026-05-16', 'run',      'Long run',            '14 mi steady on trails',                0),
  ('2026-05-17', 'run',      'Recovery run',        '6 mi easy',                             0),
  ('2026-05-17', 'mobility', 'Stretching',          '20 min full body',                      1);
