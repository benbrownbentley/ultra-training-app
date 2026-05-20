-- Plan preview pipeline — splits regenerate into preview + commit so the
-- user can see a diff before the active plan is touched.
--
-- The preview row stores everything Claude produced: the proposed workouts
-- as jsonb (so we don't have to schema-couple to the workouts table), the
-- athlete-typed notes, and a generation_summary (coach voice + change
-- badges) the tool call now emits. status enum tracks the lifecycle.

create table if not exists plan_previews (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workouts jsonb not null,
  notes text,
  generation_summary jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'discarded')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- Latest-pending lookup is the hot path: every regen sheet open and every
-- /regen render hits it. Index by user_id + created_at desc.
create index if not exists plan_previews_user_created_idx
  on plan_previews (user_id, created_at desc);

create index if not exists plan_previews_user_status_idx
  on plan_previews (user_id, status);

alter table plan_previews enable row level security;

drop policy if exists "Users read own plan_previews" on plan_previews;
drop policy if exists "Users insert own plan_previews" on plan_previews;
drop policy if exists "Users update own plan_previews" on plan_previews;
drop policy if exists "Users delete own plan_previews" on plan_previews;

create policy "Users read own plan_previews" on plan_previews
  for select using (auth.uid() = user_id);
create policy "Users insert own plan_previews" on plan_previews
  for insert with check (auth.uid() = user_id);
create policy "Users update own plan_previews" on plan_previews
  for update using (auth.uid() = user_id);
create policy "Users delete own plan_previews" on plan_previews
  for delete using (auth.uid() = user_id);
