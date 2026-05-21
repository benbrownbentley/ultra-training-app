-- Relax NOT NULL on the v1 athlete_profile columns.
--
-- These columns date to the initial single-user schema (0002). They've
-- since been superseded by the richer expanded fields in 0007
-- (weekly_volume_km, longest_run_distance ints, etc.). The wizard still
-- writes empty / zero placeholders into them for legacy readers, but a
-- profile row can perfectly well exist without them — e.g. when the
-- user toggles a preference on Profile before completing the wizard.
--
-- The NOT NULL constraints were causing every Preferences-toggle upsert
-- to fail with "null value in column \"weekly_volume\" of relation
-- \"athlete_profile\" violates not-null constraint" because PostgREST's
-- upsert path validates the resulting row, and any pre-existing row
-- with NULLs in these columns kept failing on every subsequent UPDATE.

alter table athlete_profile
  alter column weekly_volume drop not null,
  alter column longest_run_distance drop not null,
  alter column easy_pace drop not null;
