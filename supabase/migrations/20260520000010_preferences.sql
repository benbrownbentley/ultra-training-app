-- App-level preferences (theme + notification settings) live on
-- athlete_profile rather than a separate user_preferences table.
-- The profile row is already one-per-user — adding columns there avoids
-- an extra round-trip on every Profile-tab render. unit_system already
-- lives here for the same reason.

alter table athlete_profile
  add column if not exists theme text not null default 'system'
    check (theme in ('light', 'dark', 'system')),
  add column if not exists daily_reminder boolean not null default true,
  add column if not exists regen_complete_notify boolean not null default true,
  add column if not exists weekly_summary boolean not null default true;
