-- v2 step 3: introduce user_id ownership and lock down RLS by user.
--
-- DESTRUCTIVE: deletes all existing rows in race, athlete_profile, and workouts
-- before adding the NOT NULL user_id column. V2_ARCHITECTURE.md explicitly
-- accepts wiping v1 data — no backfill is performed.

-- 1. Wipe v1 single-user data so the NOT NULL user_id column can be added.
delete from workouts;
delete from athlete_profile;
delete from race;

-- 2. Add user_id to every owned table.
alter table race
  add column if not exists user_id uuid not null references auth.users(id) on delete cascade;

alter table athlete_profile
  add column if not exists user_id uuid not null references auth.users(id) on delete cascade;

alter table workouts
  add column if not exists user_id uuid not null references auth.users(id) on delete cascade;

-- 3. Index user_id for the per-user lookups every query now performs.
create index if not exists race_user_id_idx on race (user_id);
create index if not exists athlete_profile_user_id_idx on athlete_profile (user_id);
create index if not exists workouts_user_id_idx on workouts (user_id);

-- 4. Drop the v1 "public read" policies — they bypass user isolation.
drop policy if exists "Public read race" on race;
drop policy if exists "Public read workouts" on workouts;
drop policy if exists "Public read athlete_profile" on athlete_profile;

-- 5. Replace with user-scoped policies. Drop-if-exists keeps this re-runnable.
drop policy if exists "Users read own race" on race;
drop policy if exists "Users insert own race" on race;
drop policy if exists "Users update own race" on race;
drop policy if exists "Users delete own race" on race;
create policy "Users read own race" on race
  for select using (auth.uid() = user_id);
create policy "Users insert own race" on race
  for insert with check (auth.uid() = user_id);
create policy "Users update own race" on race
  for update using (auth.uid() = user_id);
create policy "Users delete own race" on race
  for delete using (auth.uid() = user_id);

drop policy if exists "Users read own athlete_profile" on athlete_profile;
drop policy if exists "Users insert own athlete_profile" on athlete_profile;
drop policy if exists "Users update own athlete_profile" on athlete_profile;
drop policy if exists "Users delete own athlete_profile" on athlete_profile;
create policy "Users read own athlete_profile" on athlete_profile
  for select using (auth.uid() = user_id);
create policy "Users insert own athlete_profile" on athlete_profile
  for insert with check (auth.uid() = user_id);
create policy "Users update own athlete_profile" on athlete_profile
  for update using (auth.uid() = user_id);
create policy "Users delete own athlete_profile" on athlete_profile
  for delete using (auth.uid() = user_id);

drop policy if exists "Users read own workouts" on workouts;
drop policy if exists "Users insert own workouts" on workouts;
drop policy if exists "Users update own workouts" on workouts;
drop policy if exists "Users delete own workouts" on workouts;
create policy "Users read own workouts" on workouts
  for select using (auth.uid() = user_id);
create policy "Users insert own workouts" on workouts
  for insert with check (auth.uid() = user_id);
create policy "Users update own workouts" on workouts
  for update using (auth.uid() = user_id);
create policy "Users delete own workouts" on workouts
  for delete using (auth.uid() = user_id);
