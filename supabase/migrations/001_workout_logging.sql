-- Adds workout-logging columns to the workouts table.
-- Safe to re-run: uses IF NOT EXISTS for the status column add.

alter table workouts
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'completed', 'skipped')),
  add column if not exists logged_at timestamptz;
