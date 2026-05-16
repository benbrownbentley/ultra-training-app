-- Step 7: move hardcoded athlete baseline from app/actions.ts into the database.
-- Single-row table for v1 (Ben). When auth lands in v2, add a user_id column + RLS by user.

create table if not exists athlete_profile (
  id bigint primary key generated always as identity,
  weekly_volume text not null,
  longest_run_km int not null,
  easy_pace text not null,
  injury_notes text,
  updated_at timestamptz not null default now()
);

alter table athlete_profile enable row level security;

create policy "Public read athlete_profile" on athlete_profile
  for select using (true);

insert into athlete_profile (weekly_volume, longest_run_km, easy_pace, injury_notes) values (
  '25-30 km',
  22,
  '6:00/km',
  'Sprained left ankle and posterior tibialis tendonitis in the right ankle. Both lower legs need careful management — prefer low-impact cross-training (bike, pool) over high-mileage running on consecutive days, build mileage gradually, and prioritize recovery and mobility.'
);
