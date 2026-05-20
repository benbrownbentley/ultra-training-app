-- The new preference-upsert actions in app/actions.ts use
-- `.upsert({ user_id, … }, { onConflict: "user_id" })` to insert a row
-- on first toggle. That requires a unique index on (user_id) — without
-- it, the upsert silently inserts duplicates on each call.
--
-- Race + journal already enforce one-row-per-user behaviour through
-- application logic; athlete_profile is the only table that exposes
-- an "edit one column at a time" path, so it's the only one that
-- actually needs the constraint.

alter table athlete_profile
  add constraint athlete_profile_user_id_key unique (user_id);
