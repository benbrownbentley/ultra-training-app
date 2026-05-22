# Phase 2 — Data Quality — Implementation Spec

_Drafted: 2026-05-22. Author: Claude + Ben. Status: design — not yet implemented._

> **Purpose.** Phase 2 of the 5-phase plan (see PROJECT_BRIEF.md → "Phase plan (revised 2026-05-21)"). Replaces the free-text `details: string` field on the workouts table with a structured per-type payload emitted directly by Claude. Closes three intertwined gaps in one change:
>
> 1. Mobility cards say "hips" instead of named exercises because Claude's free-text gets through to the UI without parseable structure.
> 2. The per-workout "why" copy is a generic `STUB_WHY[subtype]` lookup, not generated for the specific session.
> 3. Workout-source attribution is hardcoded to `manual` everywhere — when device sync arrives in v3+, we'd be doing a destructive migration we can do additively now.
>
> **Why now, before Phase 3 polish?** The Phase 3 backlog (log/unlog toggle, password-flow polish, wizard width, dark-mode legibility, etc.) is a wide pile of small UI items. Phase 2 is the structural change that unblocks several of them — e.g., the "+ ADD ACTUALS" UX can lean on canonical planned data rather than guessing from regex.
>
> **Reading order.** Sections 1–3 are the design decisions; 4 is the schema; 5 is the migration; 6 is the cut-over plan; 7 is testing; 8 is what's deferred. Skim 1–3, read 4–5 carefully, scan 6–8.

---

## 1. Current state (what we're replacing)

The plan-generation tool (`lib/claude.ts:226`) returns workouts shaped as:

```ts
{ date: string, kind: WorkoutKind, title: string, details: string, position: number }
```

Where `details` is a single free-text string like `"6 × 90s hill repeats + warmup/cooldown"` or `"45 min — squats, RDLs, single-leg work"` or `"15 min · World's greatest stretch · 90/90 hip switches"`. It's persisted as `workouts.details text not null` (see `supabase/schema.sql:20`).

Six consumer paths parse this string with regex, with varying fidelity:

| Consumer | File | What it extracts |
| --- | --- | --- |
| `parseRunningSegments` | `lib/workout-content.ts:164` | Warm-up / main set / cool-down + zones + intervals |
| `parseStrengthExercises` | `lib/workout-content.ts:268` | Exercise name + sets × reps + weight + unit |
| `parseRoutine` | `lib/workout-content.ts:312` | Mobility/physio items + per-item spec |
| `extractMetrics` | `app/_components/workout/extract-metrics.ts:25` | Duration / distance / elevation for metrics row |
| `WeekStrip` regex | `app/_components/today/WeekStrip.tsx:48` | A truncated readout for the strip |
| `attachPlannedExercises` | `app/actions.ts:97` | Wraps `deriveWorkoutContent` to back `formatStrengthActuals` comparisons |

Two additional dead-end fallbacks exist for fields Claude is not currently emitting:

- `STUB_DESCRIPTION[subtype]` and `STUB_WHY[subtype]` (`lib/workout-content.ts:125,134`) — generic copy keyed by primary type so the layout has *something* honest to render.
- Hike fueling heuristic + strength warmup heuristic — derive callouts from regex on titles/details.

**The problem with the current shape, plainly:**

- Information is lost in translation. Claude knows the exact exercise it prescribed; we throw that away into a string and try to recover it via regex downstream.
- The regex is best-effort. When Claude shifts its phrasing (which it does), the regex finds nothing and the UI falls back to a generic stub — silent degradation.
- The "why" is generic. The system prompt is calibrated to produce thoughtful per-workout rationale; we're not asking for it.
- New device-sync sources will need a column; adding it later means a destructive migration. Adding it now is one `alter table`.

---

## 2. Design principles for the new shape

These principles guided every decision in §3–§5. If a future change conflicts with them, that's a yellow flag worth re-reading the principle.

1. **Canonical structured data flows forward, not backward.** Claude emits structured fields; the database stores them; the UI consumes them directly. No regex parsing in the consumer path. Legacy regex parsers stay as a fallback for rows written before the migration, then get retired in step 5.
2. **Mirror the actuals precedent.** Migration `20260522000013_workout_actuals.sql` already established `actual_detail jsonb` for kind-specific actuals — same shape problem, same solution. Use the same pattern for planned data (`planned_detail jsonb`) so the table is internally consistent.
3. **Scalar fields stay as columns; type-specific shapes go to JSONB.** Same rule as actuals: things you want to query/sort (`date`, `kind`, `position`, `status`, `source`) are columns; things that vary by kind go in JSONB. This keeps indexable fields cheap and structural shape flexible.
4. **Required vs. optional is intentional per type.** Running workouts always have segments; strength workouts always have exercises. Mobility *should* have movements but Claude shouldn't be blocked from emitting "rest day — 15 min walk" with just a `notes` field. Zod validation enforces the contract at the action boundary.
5. **Backwards-compatible during the cut-over.** The new column lands additively. Generation starts emitting structured payloads; old rows still have `details` filled. Consumers read structured first, fall back to legacy regex. Once Ben's plan is regenerated and we've shipped a backfill for any remaining stragglers, we drop `details` in a follow-up migration.
6. **The "why" is per-workout, generated by Claude, with the stub as fallback.** Same fallback discipline as everything else — if the row was generated post-migration, the `why` is real; pre-migration, it's the existing stub.
7. **Auto-retry-once stays intact.** Migrating the tool schema is the kind of change where a borked first attempt is plausible. The existing retry mechanic in `generateTrainingPlan` (PROJECT_BRIEF.md → Decisions 2026-05-20) handles validation-failure replay; we extend the validator, not the retry shape.

---

## 3. Decisions

### 3.1 Persistence shape — **JSONB column on `workouts`**, not per-type columns

Two options were considered:

**Option A — JSONB `planned_detail` column.** One column per row, holds the kind-specific structured payload as JSON. Pros: one migration; mirrors `actual_detail`; trivial to evolve the per-type shape without a schema change; no NULL-pollution (per-type columns would be NULL on 5 of 6 kinds for every row). Cons: not type-safe at the DB layer — relies on zod at the app boundary; can't easily index inside the JSON without GIN indexes (which we don't need for current queries).

**Option B — Per-type columns.** `running_segments jsonb`, `strength_exercises jsonb`, etc., one per primary type. Pros: type-narrowing at the DB level; column names are self-documenting. Cons: schema change every time a new kind lands or a shape evolves; five-of-six columns are always NULL; doesn't match the precedent set by `actual_detail`.

**Decision: Option A.** Consistency with `actual_detail` is the deciding factor — the table tells one coherent story when both planned and actual structured data live in the same JSONB pattern. The flexibility is a real upside (we'll iterate on the shape during early v2 use). We can graduate to per-type columns later if any query pattern actually demands it.

### 3.2 Tool output shape — discriminated union by `kind`

Claude returns an array of workouts where each workout's structured fields depend on its `kind`. Discriminated union in TypeScript/zod:

```ts
type PlannedDetail =
  | { kind: 'run';      segments: Segment[];   warmup?: SegmentBlock; cooldown?: SegmentBlock; }
  | { kind: 'gym';      exercises: Exercise[]; warmup?: WarmupBlock;                            }
  | { kind: 'physio';   exercises: PhysioExercise[];                                            }
  | { kind: 'mobility'; movements: Movement[];                                                  }
  | { kind: 'cross';    activity: string; duration_min: number; target_zone?: string; notes?: string; }
  | { kind: 'hike';     duration_min: number; elevation_gain_m?: number; target_zone?: string; fueling?: string; notes?: string; };
```

Full field shapes in §4.

### 3.3 `workouts.source` — add now, default `'manual'`, catch-all `'device'`

Schema-only additive change. No app behavior depends on it in Phase 2 — the value is `manual` for everything we emit. The point is the seam: when device sync lands (v3+), inserting a synced workout doesn't require a destructive migration to add the column.

**Decision (2026-05-22):** keep the enum tight — just `manual` and `device`. We bucket every external sync (Strava, Garmin, Apple Health, Wahoo, Coros, etc.) as `device` for now. If/when the UI ever needs to differentiate brands ("Synced from Garmin" vs. "Synced from Strava"), we split with a tiny enum-expansion migration at that point.

```sql
alter table workouts
  add column if not exists source text not null default 'manual'
  check (source in ('manual', 'device'));
```

### 3.4 Per-workout "why" — a top-level field in the tool output

`why: string` becomes a required field on each emitted workout. 1–3 sentences, coach voice, specific to *this* session in *this* phase. The system prompt gets a section explaining what makes a good "why" (reference the phase, the placement in the week, the recent adherence signal where relevant).

Legacy rows without a `why` fall back to `STUB_WHY[subtype]`. Once Ben's plan is regenerated, every row has a real one.

### 3.5 `details: string` — dropped in the same migration as Phase 2

**Decision (2026-05-22):** Ben chose the faster path — drop `details` in the same migration that adds `planned_detail`. One PR, one deploy, no Phase 2.5 follow-up.

The risk this creates: between the moment the migration runs and the moment Ben regenerates his plan, every existing pending workout row would have `planned_detail = NULL` and `details` gone — nothing to render. To avoid a window of broken cards, the migration backfills `planned_detail` for every existing row with a minimal `{ notes: <original details text> }` shape *before* dropping the `details` column. This gives the renderer something to show (the original prescription text as a notes block) until Ben regenerates and rows get full structured data.

Sequence in a single migration (transactional — either the whole thing succeeds or rolls back):

1. Add `planned_detail jsonb`, `why text`, `source text` columns.
2. Backfill `planned_detail` for every existing row by writing `jsonb_build_object('notes', details)` into it. Honest fallback — we deliberately don't try to recover structure via SQL regex; the renderer will treat backfilled rows as "minimal" and show `notes` as plain text.
3. Drop the `details` column.

The interim cost: legacy rows render as plain text cards (no structured zones/exercises breakdown) until Ben regenerates. That's true regardless of which path we picked — the only difference is whether the database keeps both representations or just one.

**Operational note:** the deploy sequence Ben should follow is (a) run the migration, (b) deploy the code that uses `planned_detail`, (c) immediately open the regen sheet and hit Regenerate so future-dated rows get full structure. The cards in between will be readable but minimal.

---

## 4. New tool schema (full)

This is the JSON Schema for the Anthropic tool definition (replaces `PLAN_TOOL` in `lib/claude.ts:226`). The TypeScript types follow it.

### 4.1 Top-level workout object

```jsonc
{
  "date": "YYYY-MM-DD",          // ISO date, required
  "kind": "run" | "gym" | "hike" | "cross" | "physio" | "mobility",
  "title": "Short title",         // existing field, unchanged
  "position": 0,                  // existing field, unchanged
  "why": "1–3 sentence coach-voice rationale for THIS workout",
  "planned_detail": { /* discriminated by kind — see §4.2 */ }
}
```

`details: string` is dropped from the tool output. The DB still has the column during the interim — we'll populate it as a fallback only if needed (likely not; keeping it `null` is fine for new rows).

### 4.2 Per-kind `planned_detail` shapes

**`run` — running**

```jsonc
{
  "segments": [
    { "label": "Warm-up",  "duration_min": 15, "zone": "Z1-Z2", "note": "easy spin" },
    { "label": "Main set", "duration_min": 40, "zone": "Z3",     "intervals": "4 × 8 min" },
    { "label": "Cool-down","duration_min": 10, "zone": "Z1" }
  ],
  "total_duration_min": 65,            // optional convenience, derivable
  "total_distance_km": null,           // optional; null if time-based
  "total_elevation_gain_m": null,      // optional
  "target_pace": "6:00/km"             // optional, athlete's unit_system
}
```

`segments` is required, ≥1 item. `label` ∈ {"Warm-up","Main set","Cool-down","Interval","Recovery","Strides","Block"} — open vocabulary but suggested set lives in the system prompt.

**`gym` — strength**

```jsonc
{
  "exercises": [
    {
      "name": "Back squat",
      "equipment": "barbell",          // free text but suggested vocab in prompt
      "sets": 4,
      "reps": 6,
      "weight": 80,                    // numeric; null for BW
      "unit": "kg",                    // 'kg' | 'lb' | 'bw'
      "notes": "across all working sets"
    }
  ],
  "warmup": {                          // optional
    "duration_min": 8,
    "items": ["Goblet squat 2 × 8 light", "Glute bridge 2 × 10 BW"]
  },
  "total_duration_min": 45             // optional
}
```

`exercises` is required, ≥1 item. Matches the existing `Exercise` shape in `lib/workout-content.ts:26` so the renderer barely changes.

**`physio` — targeted prehab**

```jsonc
{
  "exercises": [
    {
      "name": "Heavy slow calf raises",
      "equipment": "single-leg, weighted",
      "sets": 3,
      "reps": 8,
      "weight": 20,
      "unit": "kg",
      "pain_focus": "achilles",        // body area being protected
      "notes": "stop if sharp pain > 3/10"
    }
  ],
  "total_duration_min": 20             // optional
}
```

Same shape as `gym` exercises plus `pain_focus`. The pain *rating* per exercise is captured on the actuals side (`PhysioExercise.pain`), not in the plan.

**`mobility` — flexibility / movement prep**

```jsonc
{
  "movements": [
    { "name": "World's greatest stretch", "duration_s": 60, "side": "both",   "notes": "" },
    { "name": "90/90 hip switch",         "duration_s": 90, "side": "both",   "notes": "" },
    { "name": "Couch stretch",            "duration_s": 60, "side": "each",   "notes": "" }
  ],
  "total_duration_min": 15             // optional convenience
}
```

`movements` required, ≥1 item. `side` ∈ {"both","each","left","right",null} so the renderer can show "per side" correctly. `duration_s` per movement is what Claude is asked for; total falls out from the sum but we accept it as a convenience field for cards that don't render the breakdown.

**`cross` — cross-training**

```jsonc
{
  "activity": "cycling",               // 'cycling' | 'swimming' | 'rowing' | 'elliptical' | 'pool_run' | 'other'
  "duration_min": 60,
  "target_zone": "Z2",
  "intervals": null,                   // optional, e.g. "4 × 4 min Z3 w/ 2 min Z1"
  "notes": "easy spin, no efforts"
}
```

**`hike` — vert-focused time on feet**

```jsonc
{
  "duration_min": 180,
  "elevation_gain_m": 800,
  "target_zone": "Z1-Z2",
  "intervals": null,
  "fueling": "Practice race fueling: 60g carbs/hr, 500ml water/hr",
  "notes": "trail if accessible"
}
```

### 4.3 Top-level summary/changes fields — unchanged

`summary: string` and `changes: ChangeBadge[]` are preserved exactly as today. The "FROM YOUR COACH" card and the change-badge row continue to work without modification.

### 4.4 TypeScript surface

`GeneratedWorkout` in `lib/claude.ts:84` becomes:

```ts
export interface GeneratedWorkout {
  date: string;
  kind: WorkoutKind;
  title: string;
  position: number;
  why: string;
  planned_detail: PlannedDetail;       // discriminated union, see §3.2
}
```

`LoggedWorkout` (the history shape sent back into the prompt) keeps `details: string` during the transition — it's still useful for *describing past plans* to Claude. After step 5, swap it for `planned_detail` directly.

---

## 5. Database migration

### 5.1 Migration `20260525000017_planned_detail.sql` (Phase 2)

Single transactional migration that adds the new columns, backfills `planned_detail` from `details` with a minimal `{ notes }` shape, and drops the `details` column. See §3.5 for the rationale on dropping in the same change.

```sql
-- Phase 2: structured plan data + per-workout "why" + source column.
-- Replaces the free-text `details` column with a kind-specific `planned_detail`
-- JSONB column. Backfills minimal {notes:<original text>} so legacy rows
-- still render after the drop. See PHASE_2_SPEC.md §3.5.

begin;

-- 1. Add the new columns.
alter table workouts
  add column if not exists planned_detail jsonb,
  add column if not exists why text,
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'device'));

-- 2. Backfill planned_detail for every existing row. Minimal shape —
--    we don't try to recover structure via SQL regex. The renderer treats
--    a row with only `notes` as "legacy minimal" and displays the original
--    prescription text as a plain notes block.
update workouts
  set planned_detail = jsonb_build_object('notes', details)
  where planned_detail is null;

-- 3. After the backfill, planned_detail is no longer nullable for
--    pre-existing rows. New rows from the RPC will insert with full
--    structured payloads. NOT NULL is enforced at the app boundary
--    (zod) rather than the DB so backfilled rows pass without ceremony.

-- 4. Drop the legacy `details` column. Forward-only.
alter table workouts drop column details;

commit;

comment on column workouts.planned_detail is
  'Kind-specific planned data. Mirror of actual_detail. See PHASE_2_SPEC.md §4 for shapes.';
comment on column workouts.why is
  'Per-workout coach-voice rationale, 1-3 sentences, ≤500 chars. Falls back to STUB_WHY[subtype] when null.';
comment on column workouts.source is
  'Origin of the workout record: manual | device. Future-proofs device sync.';
```

**Rollback note:** if the migration fails partway, the BEGIN/COMMIT wrapper reverts everything. If we need to roll back *after* a successful deploy, the rollback migration is non-trivial — `details` text would have to be restored by reading `planned_detail->>'notes'` back into a new column. Run on staging first when staging exists (Phase 4 hygiene item).

### 5.2 RPC update — `commit_plan_preview`

The RPC in migration 014 destructures `p_workouts` JSONB into table rows. It has to learn the new fields and stop referencing `details`. Forward-only `CREATE OR REPLACE` in the same migration file as the schema change (or a paired migration — either is fine, as long as both land before the new code does):

```sql
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
    w->'planned_detail',              -- jsonb extraction with `->` not `->>`
    w->>'why',
    'manual'                           -- explicit; the column default would do this too
  from jsonb_array_elements(p_workouts) as w
  where (w->>'date')::date >= p_today;
end;
$$;
```

### 5.3 Backfill — handled inside the migration

The `update workouts set planned_detail = jsonb_build_object('notes', details)` step in §5.1 *is* the backfill. After it runs, every row has at least a minimal `planned_detail`. Logged history rows keep their notes-shape payload forever (cheap, doesn't break anything). Future-dated rows get rewritten to full structure as soon as Ben regenerates.

### 5.4 No follow-up migration needed

The original spec planned a Phase 2.5 follow-up to drop `details`. Per Ben's 2026-05-22 decision (§3.5), that drop now happens inside the §5.1 migration itself. Phase 2 is one PR, one migration, one deploy.

---

## 6. Cut-over plan (consumer migration)

Per §3.5's 2026-05-22 decision, everything ships in one PR. The cut-over is ordered for clarity, but every step lands together.

**Single Phase 2 PR — schema, generation, and renderer all together**

Database:
1. Run migration `20260525000017_planned_detail.sql` (§5.1) — adds columns, backfills `planned_detail` from `details`, drops `details`.
2. Update the `commit_plan_preview` RPC (§5.2) — drops the `details` column from the INSERT list, picks up `planned_detail` / `why` / `source`.

Generation:

3. Update `PLAN_TOOL` in `lib/claude.ts:226` to the new schema (see §4).
4. Update `GeneratedWorkout` type (`lib/claude.ts:84`) to require `planned_detail` + `why`.
5. Update `LoggedWorkout` to use `planned_detail` instead of `details:string` (renderers reading history now consume structured data; the `formatHistory` text-output code converts structured back to summary lines for the Claude prompt).
6. Add zod schema for the `PlannedDetail` discriminated union; wire into `validateGeneratedPlan` (`lib/plan-validation.ts`).
7. Update `app/actions.ts → previewPlan / commitPlan` to pass `planned_detail` and `why` through to the RPC.
8. System prompt rewrite: add a "Structured output requirements" section explaining the per-type shapes, the ≤500-char `why` cap, and what makes a good `why`.

Renderer cut-over:

9. `lib/workout-content.ts → deriveWorkoutContent` rewritten to read directly from `planned_detail`:
   - If the row has a full structured payload, return its fields directly.
   - If the row only has `{ notes }` (a legacy backfilled row), return a minimal `WorkoutContent` with `description = notes` and empty arrays for segments/exercises/etc. — the renderer's existing "empty STRUCTURE block" path takes over.
   - The legacy regex parsers (`parseRunningSegments`, `parseStrengthExercises`, `parseRoutine`) are deleted in this same PR — they're no longer reachable.
10. `app/workout/[id]/page.tsx` — pass `workout.planned_detail` + `workout.why` to `deriveWorkoutContent`. Drop the raw `{workout.details}` block (line ~121) since the column is gone.
11. `app/_components/today/WorkoutCard.tsx` — render a short readout derived from `planned_detail` instead of dumping `details`. Backfilled rows show their `notes`.
12. `app/_components/today/WeekStrip.tsx` — replace the regex match on `details` with a structured read from `planned_detail`.
13. `app/_components/today/TodayPageClient.tsx:131` — same swap for the `tomorrow` summary line.
14. `app/_components/workout/extract-metrics.ts` — read `total_duration_min` / `total_distance_km` / `total_elevation_gain_m` directly from `planned_detail`. Regex path is deleted.
15. `app/actions.ts → attachPlannedExercises` — read `planned_detail.exercises` directly for `gym` kind. The regex-based path is deleted.
16. `app/_components/today/AddActivitySheet.tsx` — when a user adds a custom activity manually, build a minimal `planned_detail` (just `{ notes: <user text> }`) on the insert. Or extend the sheet UI to capture structure (deferred — out of Phase 2 scope).

Tests:

17. `lib/claude.test.ts` — assert the new tool schema is correctly shaped; mock Claude responses with structured payloads per kind.
18. `lib/plan-validation.test.ts` — happy and failure paths for each discriminated kind; assert `why ≤ 500 chars`.
19. `lib/workout-content.test.ts` — replace text-parsing cases with structured-input cases; one test per primary type confirming the renderer maps correctly.
20. New: a "legacy backfilled row" test that confirms `{ notes: "..." }` rows render as minimal cards without throwing.

**Deploy sequence (operational):**

1. Push the PR to main; Vercel auto-deploys.
2. Run the migration on production Supabase (the SQL is in `supabase/migrations/`; Supabase auto-applies on push if migrations are wired, otherwise apply manually via the SQL editor).
3. Open the app; immediately open the regen sheet and hit Regenerate. Wait for the new plan to land. Cards now show full structured data.
4. Spot-check one workout of each kind on the drill-down page to confirm structured rendering.

The window between step 2 and step 3 is the "minimal cards" period — backfilled rows show notes-only. Should be under a minute.

---

## 7. Testing strategy

**Unit tests (must land with Step A):**
- Tool schema → zod validation: one passing fixture per kind + one failing fixture per kind (missing required field, wrong discriminator value).
- `validateGeneratedPlan` extended to call the new zod schema; existing structural checks (missing dates, race-day run, past dates) unaffected.
- Coach-voice "why" — assert it's a non-empty string, ≥10 chars, ≤500 chars (loose guardrails — content quality is judged in eval, not in unit tests).

**Unit tests (must land with Step B):**
- Renderer happy path: each primary type with a representative `planned_detail` produces the expected `WorkoutContent` shape.
- Renderer fallback path: row with `planned_detail = null` still renders via regex on `details` (the existing tests cover this; just keep them green).
- `attachPlannedExercises` returns the structured exercises directly when `planned_detail.exercises` is present, and falls back to regex otherwise.

**Integration smoke (manual, before Phase 2 deploy):**
- Wizard → plan generation → verify every workout in the new plan has `planned_detail` populated (sanity SQL: `select count(*) from workouts where user_id = X and planned_detail is null and status='pending'` → 0).
- Open the workout drill-down for one example of each kind → verify the structured render is correct.
- Regenerate the plan via the regen sheet → verify the new preview also carries `planned_detail` and commit writes it through the RPC.

**Eval (post-Phase 2, before sharing):**
- The "rubric eval" idea from the Plan-Quality backlog (`PROJECT_BRIEF.md` → "Plan generation quality improvements") gets cheaper to run once outputs are structured — every field becomes a programmatic check. Worth wiring in Phase 5 once we have real comparison data.

---

## 8. Deferred (Phase 5+ or after)

Per the workflow rule: deferred items go to PROJECT_BRIEF.md, not just memory. These are flagged here so they don't get lost:

- **Prescribed-vs-actual deltas** — the spec memory (`project_structured_prescriptions.md`) notes the candidate follow-up of computing "ran 8% faster than prescribed" deltas. Now that the structured shape exists, this becomes a thin formatter on top of `planned_detail` vs. `actual_detail`. Evaluate plan-quality impact before building (3–5 real regen fixtures, with-and-without deltas, judge whether next-plan quality improves).
- **GIN index on `planned_detail`** — only if a real query pattern emerges that needs to filter inside the JSONB (e.g., "all workouts that include hill repeats"). Don't pre-optimize.
- **Per-type column promotion** — if any one shape becomes load-bearing for queries, promote it from JSONB to a dedicated column. Default position: stay on JSONB.
- **Historical backfill** — converting old `details:string` rows to `planned_detail` retroactively. Only relevant if we want to analyse historical plans uniformly. Not blocking Phase 2.
- **Source-field activation** — `workouts.source` is structurally in place but no app behavior reads it. Connecting Strava/Garmin/Apple Health is v3+ work; the v2 UI doesn't change.

---

## 9. Open questions for Ben — RESOLVED 2026-05-22

These were the four calibration questions presented to Ben after the spec was drafted. All resolved in the same session.

1. **Tool schema discriminator approach.** Default to "stricter" — `kind` appears on both the outer workout and inside `planned_detail`. No real product trade-off; tiny safety-net win. Implementer's call, no Ben input needed. **Resolved: stricter (specced).**
2. **`why` length cap.** Cap at ≤500 chars (~3 sentences). Existing stubs are 50–150 chars; Claude-generated `why` will naturally land in 200–400. **Resolved: 500-char cap.**
3. **Legacy `details` lifetime.** Drop `details` in the same Phase 2 PR. Single migration handles the backfill (`{ notes: <original text> }`) before the column drop so legacy rows still render as minimal cards. Operational note: Ben regenerates immediately after deploy to refill rows with full structured data. **Resolved: drop in same change.**
4. **`source` enum.** Tightest option — just `manual` and `device`. Bucket every external sync as `device` for now; split into named brands later via a small enum-expansion migration only if the UI needs to differentiate. **Resolved: `{manual, device}`.**

---

## 10. Status

- [x] §1 Current state mapped against actual code (2026-05-22)
- [x] §2 Design principles agreed (this doc)
- [x] §3 Persistence decision (JSONB, mirroring actual_detail)
- [x] §4 Tool schema drafted
- [x] §5 Migration plan drafted — single transactional migration with backfill
- [x] §6 Consumer cut-over sequence — single PR, all 20 steps
- [x] §7 Testing strategy
- [x] §8 Deferred list
- [x] §9 Open questions resolved (2026-05-22)
- [ ] Phase 2 PR opened
- [ ] Migration applied to production
- [ ] Ben regenerates plan post-deploy to refill structured data
