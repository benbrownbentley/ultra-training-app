-- Expand `kind` to first-class concepts. Previously 3 (run/gym/mobility)
-- with the 6 visual subtypes inferred from title regex; now 6 so the
-- DB matches the conceptual model and Claude can emit kinds directly.
--
-- Backfill reclassifies existing rows using the same regex the
-- renderer used to use, so the live state is preserved across the cut.

alter table workouts drop constraint if exists workouts_kind_check;
alter table workouts add constraint workouts_kind_check
  check (kind in ('run', 'gym', 'mobility', 'hike', 'cross', 'physio'));

-- Order matters: catch hike-titled runs first, then physio-titled
-- mobilities, then anything cycling/swimming/cross-flagged in mobility
-- rows. Anything not matched stays on its original kind.
update workouts set kind = 'hike'
  where kind = 'run' and title ~* '\m(hike|trekking)\M';

update workouts set kind = 'physio'
  where kind = 'mobility'
    and title ~* '\m(physio|prehab|rehab)\M';

update workouts set kind = 'cross'
  where kind = 'mobility'
    and title ~* '\m(cycl(ing|e)|bike|spin|swim|cross)\M';
