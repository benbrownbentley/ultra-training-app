-- Journal entries — the user's running log of notes, travel plans, injuries,
-- and physio visits. Surfaced as the Journal tab, threaded into Claude's
-- regenerate prompt so plan updates respect the recent context.
--
-- Type-discriminated schema: every entry has type + entry_date + body,
-- plus a jsonb `details` payload whose shape varies by type. RLS scopes
-- everything to the owning user (same convention as workouts/race/profile).

create table if not exists journal_entries (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('note', 'travel', 'injury', 'physio')),
  entry_date date not null default current_date,
  title text,
  body text,
  details jsonb,
  -- True once the entry has been fed into a plan regeneration, so the UI
  -- can render the "SEEN" badge from the design.
  consumed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists journal_entries_user_date_idx
  on journal_entries (user_id, entry_date desc, id desc);

create index if not exists journal_entries_user_consumed_idx
  on journal_entries (user_id, consumed);

alter table journal_entries enable row level security;

drop policy if exists "Users read own journal_entries" on journal_entries;
drop policy if exists "Users insert own journal_entries" on journal_entries;
drop policy if exists "Users update own journal_entries" on journal_entries;
drop policy if exists "Users delete own journal_entries" on journal_entries;

create policy "Users read own journal_entries" on journal_entries
  for select using (auth.uid() = user_id);
create policy "Users insert own journal_entries" on journal_entries
  for insert with check (auth.uid() = user_id);
create policy "Users update own journal_entries" on journal_entries
  for update using (auth.uid() = user_id);
create policy "Users delete own journal_entries" on journal_entries
  for delete using (auth.uid() = user_id);
