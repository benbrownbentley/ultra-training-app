-- Add plan_generation_jobs to the supabase_realtime publication so the
-- global RegenStatusBanner client component can subscribe to row
-- changes via the Supabase Realtime channel. RLS still scopes
-- subscription payloads to the current user's own rows — Realtime
-- respects RLS the same way the REST layer does.
--
-- Adding a table that's already in the publication errors (`relation
-- ... is already member of publication`). Guarded with a DO block
-- that catches the duplicate_object code so re-running the migration
-- on an environment that already has the row is a no-op.

do $$
begin
  alter publication supabase_realtime add table plan_generation_jobs;
exception
  when duplicate_object then null;
end$$;
