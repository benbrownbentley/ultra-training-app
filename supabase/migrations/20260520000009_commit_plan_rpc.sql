-- Atomicity + invariant enforcement for the preview→commit pipeline.
--
-- 1. commit_plan_preview() wraps the destructive delete + bulk insert in
--    one transaction. Without this, a failed insert after a successful
--    delete would leave the user with an empty plan until the next regen.
-- 2. plan_previews_one_pending_per_user is a partial unique index that
--    enforces the "at most one pending preview per user" invariant the
--    app already tries to maintain via the discard-then-insert pattern.
--    The constraint makes concurrent regen attempts safe — the loser
--    sees a unique-violation, which previewPlan retries once.

create or replace function commit_plan_preview(
  p_user_id uuid,
  p_today date,
  p_workouts jsonb
) returns void
language plpgsql
security definer
as $$
begin
  -- Both ops in one transaction. If insert fails, delete rolls back.
  delete from workouts
    where user_id = p_user_id and date >= p_today;

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

-- security definer + this grant let the function bypass RLS for the
-- swap. The function only operates on the user_id passed in — callers
-- must verify ownership before invoking. commitPlan() in app/actions.ts
-- already does this via the preview row check.
revoke all on function commit_plan_preview from public;
grant execute on function commit_plan_preview to authenticated, service_role;

-- Partial unique index — application-level invariant becomes a DB-level
-- guarantee. Concurrent previewPlan calls now produce a deterministic
-- winner instead of two pending rows.
create unique index if not exists plan_previews_one_pending_per_user
  on plan_previews (user_id) where status = 'pending';
