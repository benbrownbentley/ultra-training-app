-- Phase 2: structured plan data + per-workout "why" + source column.
-- Replaces the free-text `details` column with a kind-specific
-- `planned_detail` JSONB column. Backfills minimal {notes:<original
-- text>} so legacy rows still render after the drop. The
-- commit_plan_preview RPC is updated in the same migration to stop
-- referencing `details` and start writing `planned_detail` / `why` /
-- `source`. See PHASE_2_SPEC.md §3.5, §5.1, §5.2.

begin;

-- 1. Add the new columns. JSONB shape lives at the app boundary (zod
--    in lib/plan-validation.ts); not enforced at the DB layer so
--    backfilled rows pass without ceremony. `source` is `manual` for
--    everything Phase 2 emits; the column is in place so device-sync
--    work in v3+ can insert `device` rows additively. See PHASE_2_SPEC
--    §3.3.
alter table workouts
  add column if not exists planned_detail jsonb,
  add column if not exists why text,
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'device'));

-- 2. Backfill planned_detail for every existing row. Minimal shape —
--    we deliberately do NOT try to recover structure via SQL regex.
--    deriveWorkoutContent treats a row with only `notes` as "legacy
--    minimal" and renders the original prescription text as a plain
--    notes block until the user regenerates.
update workouts
  set planned_detail = jsonb_build_object('notes', details)
  where planned_detail is null;

-- 3. Drop the legacy `details` column. Forward-only. NOT NULL on
--    planned_detail is enforced at the app boundary (zod) rather than
--    here, so backfilled rows don't trip a constraint.
alter table workouts drop column details;

commit;

comment on column workouts.planned_detail is
  'Kind-specific planned data. Mirror of actual_detail. See PHASE_2_SPEC.md §4 for shapes.';
comment on column workouts.why is
  'Per-workout coach-voice rationale, 1-3 sentences, ≤500 chars. Falls back to STUB_WHY[subtype] when null.';
comment on column workouts.source is
  'Origin of the workout record: manual | device. Future-proofs device sync.';

-- RPC update — drop `details` from the INSERT list and pick up the new
-- columns. Preserves the migration 014 semantics: is_custom=true rows
-- the user added themselves survive the regen; new rows insert
-- alongside them. `source` defaults to 'manual' at the column level
-- but we set it explicitly here so the RPC is self-documenting.
create or replace function commit_plan_preview(
  p_user_id uuid,
  p_today date,
  p_workouts jsonb
) returns void
language plpgsql
security definer
as $$
begin
  delete from workouts
    where user_id = p_user_id
      and date >= p_today
      and is_custom = false;

  insert into workouts (user_id, date, kind, title, position, planned_detail, why, source)
  select
    p_user_id,
    (w->>'date')::date,
    w->>'kind',
    w->>'title',
    (w->>'position')::int,
    w->'planned_detail',
    w->>'why',
    'manual'
  from jsonb_array_elements(p_workouts) as w
  where (w->>'date')::date >= p_today;
end;
$$;

revoke all on function commit_plan_preview from public;
grant execute on function commit_plan_preview to authenticated, service_role;
