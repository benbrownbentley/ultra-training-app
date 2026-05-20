# Claude Code prompt — Regen flow follow-up fixes

Targeted cleanup after the code review of commit `dc8dad5`
(`feat: preview-then-accept regen flow`). All 12 fixes below in one focused
session. ~1–2 hours of work.

---

```
Apply 12 fixes to the preview+commit regen flow that landed in commit
dc8dad5. The diff is small and surgical — don't restructure anything
that's already working.

FIX 1 — ATOMIC commitPlan VIA POSTGRES FUNCTION (HIGH PRIORITY)

The current commitPlan does:
  1. Delete future workouts
  2. Insert preview workouts
  3. Mark preview accepted
  4. Flip journal_entries.consumed = true

Steps 1+2 are non-atomic — if step 2 fails, the user has an empty plan
until the next regen. Wrap steps 1+2 in a Postgres function for true
atomicity.

Create supabase/migrations/2026MMDD_commit_plan_rpc.sql with:

  create or replace function commit_plan_preview(
    p_user_id uuid,
    p_today date,
    p_workouts jsonb
  ) returns void
  language plpgsql
  security definer
  as $$
  begin
    -- Both ops in one transaction. If insert fails, delete is rolled back.
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
  -- swap, but the function only operates on the user_id passed in — the
  -- caller must verify ownership before invoking. commitPlan already
  -- does this via the preview row check.
  revoke all on function commit_plan_preview from public;
  grant execute on function commit_plan_preview to authenticated, service_role;

Then update app/actions.ts commitPlan:

- Remove the inline delete + insert into workouts
- Replace with: `await supabaseAdmin.rpc("commit_plan_preview", {
    p_user_id: user.id,
    p_today: today,
    p_workouts: preview.workouts,
  });` — error-check and throw on failure
- Keep the preview status update + journal flip in app code (no atomicity
  needed across those — comment in the existing code already explains
  why the journal flip is safest last)

FIX 2 — UNIQUE PARTIAL INDEX FOR PENDING PREVIEWS (HIGH PRIORITY)

Add to the same migration (or a new one):

  create unique index if not exists plan_previews_one_pending_per_user
    on plan_previews (user_id) where status = 'pending';

This makes the application's "at most one pending per user" intent
actually enforced by the DB. The discard-then-insert pattern in
previewPlan becomes safe under concurrent requests (the second insert
fails with a unique violation, and we catch it).

In app/actions.ts previewPlan, after the insert call: catch a unique
violation error specifically and retry once (re-run the discard then
re-attempt the insert). If the retry also fails, throw with a clear
message.

FIX 3 — REFACTOR submitWizard TO REUSE TYPED HELPERS (HIGH PRIORITY)

The wizard currently hand-rolls a Race + AthleteProfile object to pass
to generateTrainingPlan, duplicating type structure that lives in
lib/plan.ts. Refactor submitWizard:

- After the race + athlete_profile rows are inserted, fetch fresh via:
    const [{ race }, profile] = await Promise.all([
      getRaceAndHistory(today),
      getAthleteProfile(),
    ]);
  Then pass `race!` and `profile!` to generateTrainingPlan directly.
- This eliminates the hand-rolled mapping AND ensures the wizard uses
  the exact same data shape as previewPlan. Future schema changes
  break in one place (the type definitions), not two.

FIX 4 — CONSOLIDATE GenerationSummary TYPE (and the changes enum)

Currently defined twice with identical shape:
- lib/preview.ts has GenerationSummary
- lib/claude.ts has GenerationSummary

Define once in lib/preview.ts (it belongs with the preview data flow).
Re-export from lib/claude.ts: `export type { GenerationSummary } from "@/lib/preview";`

Same for the `type: "shifted" | "reduced" | "added" | "removed"` enum
inside GenerationSummary.changes — export it as a named type
(`ChangeType`) from lib/preview.ts and reuse in lib/claude.ts.

FIX 5 — SORT BY POSITION ON BOTH SIDES IN workoutSetsEqual

lib/preview.ts workoutSetsEqual currently relies on position order
being stable across regenerations. The preview side already sorts by
position before this function runs. Add the same sort to the current
side:

In computePlanDiff, when building currentByDate, sort each day's
workouts by position before storing:

  for (const d of currentDays) {
    const sorted = [...d.workouts].sort((a, b) =>
      (a.position ?? 0) - (b.position ?? 0)
    );
    currentByDate.set(d.date, sorted);
  }

(Verify that Workout has a position field; if not, add it via
lib/plan.ts and source it from the workouts table — the schema
already has it per the existing PLAN_TOOL definition.)

FIX 6 — PRESERVE NOTES ON "REGENERATE AGAIN"

When the user taps Regenerate again on the result page, the sheet
currently opens with an empty notes textarea. They lose what they
typed for the previous regen.

In app/_components/regen/RegenPageClient.tsx:
- Add a `previousNotes` prop, passed through from app/regen/page.tsx
  which reads `preview.notes`
- Pass it to RegenerateSheet as `defaultNotes` or `initialNotes`
- In RegenerateSheet, use it as the textarea's initial value (or a
  controlled value pre-populated, depending on how the existing impl
  handles input state)

FIX 7 — DOCUMENT THE DISCARD-BEFORE-CLAUDE-CALL BEHAVIOR

In app/actions.ts previewPlan, the comment currently says:
  "Mark any older pending preview as discarded before creating a new
   one. Done before the Claude call so a fast-clicking user can't end
   up with two pending rows even briefly."

Update the comment to add: "If the Claude call fails after this point,
the user has no pending preview to fall back on — they have to trigger
a fresh regen from scratch. Acceptable trade-off because (a) the
previous preview's diff was likely stale, and (b) the unique partial
index plan_previews_one_pending_per_user is the authoritative
enforcement; this in-app discard is just defense."

FIX 8 — STRIP UNUSED revalidatePath CALLS

In app/actions.ts:
- commitPlan: remove `revalidatePath("/regen")` (the page is
  dynamic = "force-dynamic", revalidation is moot)
- discardPreview: same — remove `revalidatePath("/regen")`
- previewPlan: same — remove `revalidatePath("/regen")`

Keep the other revalidatePath calls (/, /plan, /journal) — those
target static-revalidated routes.

FIX 9 — REGEN URL SOURCE-OF-TRUTH

In app/regen/page.tsx, change the fallback behavior:

  if (!preview) {
    preview = await getLatestPendingPreview();   // <— REMOVE this line
  }

Replace with: if `?preview=` is missing or invalid, redirect("/").
The URL is the source of truth for which preview is being viewed.
This eliminates the "open /regen with no param, get whatever latest
pending was" ambiguity.

Also remove the now-unused getLatestPendingPreview function from
lib/supabase/server.ts (or leave it for future use — judgment call).
If you keep it, add a comment noting it's not currently called.

FIX 10 — REMOVE THE 28-DAY HORIZON FALLBACK

lib/preview.ts computePlanDiff currently has:
  const horizonIso = ctx.raceDate ?? addDays(ctx.todayIso, 28);

The no-race branch is unreachable in practice (getPlan() requires a
race; the page redirects to wizard if missing). Either:
- Remove the fallback and assert raceDate is non-null (throw if null)
- Or keep the fallback but log a warning when it triggers, so we know
  if we ever hit it in production

Pick "throw if null" — fail loudly on impossible states.

FIX 11 — WIRE onExpandDiff TO CLIENT STATE

In RegenPageClient.tsx, the onExpandDiff handler currently does
`router.push("?expand=1")` but no code reads ?expand. Replace with
local client state:

- Add `const [diffExpanded, setDiffExpanded] = useState(false);` in
  RegenPageClient
- Pass `onExpandDiff={() => setDiffExpanded(true)}` and `expanded={diffExpanded}`
  through to StateMinor
- StateMinor renders the diff section based on `expanded` prop:
  collapsed by default, expanded when set
- No URL changes — the expansion is ephemeral UI state, not navigation

FIX 12 — DOCUMENT THE V1 MULTI-WORKOUT-DIFF LIMITATION

In lib/preview.ts diffDay, add a comment at the top:

  // V1 limitation: when a day has multiple workouts (e.g., tempo +
  // strength), we only diff the first one (current[0] vs preview[0]).
  // If the second workout changes but the first stays the same, the
  // diff understates the change. Acceptable for v1 — most days are
  // one workout. v2 widens DayDiff to support arrays. Tracked in
  // PROJECT_BRIEF.md "Regeneration diff" deferrals section.

No code change — just the comment.

CONSTRAINTS

- All changes match existing AGENTS.md patterns
- Server actions still call requireUser() and use defense-in-depth
- Pure functions stay pure (no Supabase imports in lib/preview.ts)
- Migrations are idempotent (use if not exists, drop policy if exists, etc.)

FILES TOUCHED

- supabase/migrations/2026MMDD_commit_plan_rpc.sql (NEW — fixes 1, 2)
- app/actions.ts (fixes 1, 2, 3, 7, 8)
- lib/preview.ts (fixes 4, 5, 10, 12)
- lib/claude.ts (fix 4 — re-export)
- lib/supabase/server.ts (fix 9 — maybe remove getLatestPendingPreview)
- lib/plan.ts (fix 5 — add position if missing)
- app/regen/page.tsx (fix 6 — pass previousNotes; fix 9 — redirect)
- app/_components/regen/RegenPageClient.tsx (fix 6, 11)
- app/_components/regen/RegenerateSheet.tsx (fix 6 — accept defaultNotes)
- app/_components/regen/StateMinor.tsx (fix 11 — accept expanded prop)

VERIFICATION CHECKLIST

- npm run lint, npm run build, both clean
- Apply migration, verify the function exists: 
  `select proname from pg_proc where proname = 'commit_plan_preview';`
- Verify the unique partial index exists:
  `select indexname from pg_indexes where tablename = 'plan_previews';`
- Manual smoke test:
  1. Trigger a regen with notes, verify preview generates
  2. Tap "Regenerate again" — verify the sheet opens with previous notes pre-filled
  3. Tap Accept — verify workouts swap atomically (no empty-plan window)
  4. Fast-click REGEN twice in a row — verify only one preview ends up pending
     (the second attempt either succeeds and supersedes, or fails cleanly)
  5. Land on /regen with no ?preview= param — verify redirect to /
  6. Trigger a minor change regen (try a tiny notes input) — verify StateMinor
     renders, tap "View N small adjustments", verify the expand works
- Type-check passes (especially the GenerationSummary consolidation)
```

---

## Verification I'll do after Claude Code finishes

Once you've run this prompt, I'll do a focused diff review:

- The new RPC function — verify the security definer + grant pattern doesn't accidentally widen access
- The unique partial index — verify it's actually `where status = 'pending'` (case-sensitive in some Postgres setups)
- The retry-on-unique-violation in previewPlan — verify the catch is specifically targeting the unique violation, not swallowing all errors
- The submitWizard refactor — verify the fresh fetch happens AFTER the inserts complete (otherwise we get the stale state)
- The GenerationSummary consolidation — verify the re-export doesn't introduce circular imports

Then we move to prompt 2 (missing routes).
