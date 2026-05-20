-- Actuals capture for logged workouts. Scalar fields as columns for
-- queryability; kind-specific structured data (per-set, per-exercise,
-- time-in-zone) lives in `actual_detail` jsonb so we don't churn the
-- schema every time a new variant gets a richer log shape.

alter table workouts
  add column if not exists actual_duration_min numeric,
  add column if not exists actual_distance_km numeric,
  add column if not exists actual_elevation_gain_m numeric,
  add column if not exists actual_hr_avg smallint,
  add column if not exists actual_rpe smallint check (actual_rpe between 1 and 10),
  add column if not exists actual_notes text,
  add column if not exists actual_detail jsonb,
  add column if not exists is_custom boolean not null default false;

-- is_custom flags workouts the user inserted via the "Add activity"
-- flow on the Today screen. Regen needs to know NOT to wipe these.

comment on column workouts.actual_detail is
  'Kind-specific actuals: runs {zones:[{label,minutes}]}, strength {sets:[{exerciseName,reps,weight,unit}]}, physio/mobility {exercises:[{name,done,pain,note}]}. Optional, sparse.';
