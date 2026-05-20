-- Replaces commit_plan_preview so it preserves user-added activities
-- across plan swaps. Without this, a regen would wipe a gym session the
-- user logged via "Add activity" before the new plan lands.
--
-- Forward-only — the original definition still ships in migration 0009;
-- this CREATE OR REPLACE installs the updated body atomically.

create or replace function commit_plan_preview(
  p_user_id uuid,
  p_today date,
  p_workouts jsonb
) returns void
language plpgsql
security definer
as $$
begin
  -- Wipe upcoming plan-generated workouts only. is_custom=true rows the
  -- user added themselves stay put; the new plan is inserted alongside
  -- them and the day-renderer composes both.
  delete from workouts
    where user_id = p_user_id
      and date >= p_today
      and is_custom = false;

  insert into workouts (user_id, date, kind, title, details, position)
  select
    p_user_id,
    (w->>'date')::date,
    w->>'kind',
    w->>'title',
    w->>'details',
    (w->>'position')::int
  from jsonb_array_elements(p_workouts) as w
  where (w->>'date')::date >= p_today;
end;
$$;

revoke all on function commit_plan_preview from public;
grant execute on function commit_plan_preview to authenticated, service_role;
