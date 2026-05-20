-- Step 7: create the athlete_profile table so the wizard has somewhere to write
-- per-user baseline data. The original version of this migration also seeded
-- a single hardcoded Ben-baseline row; that INSERT was removed on 2026-05-17
-- because (a) the wizard now produces this data per user, (b) migration 004
-- renamed longest_run_km to longest_run_distance which broke the literal
-- column list, and (c) migration 005 added user_id NOT NULL which the seed
-- row could not satisfy. With the INSERT gone, this migration is safe to
-- re-run against a fresh database (e.g. `supabase db reset`).

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
