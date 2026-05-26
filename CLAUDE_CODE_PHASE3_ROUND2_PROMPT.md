# Phase 3 polish — round 2

Six items surfaced from Ben's 2026-05-25 smoke test of the merged Phase 3 polish batch (commits `782fcae` + `35a6e5f` + `85a205e` + `1de9115` on `main`). One P0 regression, four polish items, one new feature ask. Ship as a single batch on a new branch off `main`, then PR.

## Branch + workflow

- Branch off `main`: `phase-3-polish-round-2`
- One commit per item is fine, or group `1+2` (Today card behaviour fixes) and `3+4` (Today card visual/layout) — your call. Item 5 and 6 are standalone.
- After all six land, run `npm run typecheck && npm test && npm run lint` and confirm clean before PR.
- Keep comments at the standard Vert bar: every non-trivial block gets a comment that says **why**, not just what. Match the voice of the surrounding code.

---

## Item 1 — 🔴 P0: Unskip button is a no-op

**File:** `app/_components/today/WorkoutCard.tsx`
**Evidence:** line 379 — the Unskip button in the `skipped` variant wires `onClick={onSkip}`. The card is already skipped, so the click does nothing.

**Fix:**

1. Add an `onUnskip?: () => void` prop on `CardFooter`'s `FooterProps` (alongside `onSkip`, `onUnlog`, etc — see the prop type around line 264).
2. Destructure it in the function signature (~line 289).
3. Change line 379 from `onClick={onSkip}` → `onClick={onUnskip}`.
4. Pass the handler from the parent `WorkoutCard` (around line 244, in the `<CardFooter ... />` JSX block): `onUnskip={() => setStatus("pending")}`.

**Important — status name:** `lib/plan.ts:8` defines `WorkoutStatus = "pending" | "completed" | "skipped"`. The un-skipped status is **`"pending"`** (NOT `"scheduled"` — earlier memory had this wrong; verified by reading the type today).

**Behaviour notes:**

- `logWorkout(id, "pending")` is the right server-side call. It's already used elsewhere via `setStatus("pending")` for the unlog flow (see WorkoutCard.tsx:108–119) — `loggedAt` is set to `null` for `pending`, which is the correct reset.
- No toast for the skipped → pending transition. The existing `setStatus` only fires `unlogged` toast on `completed → pending` (line 108), which we want to keep that way. Silent revert is the right UX for Unskip.
- Acceptance: tap Unskip on a skipped Today card → card immediately re-renders as the `upcoming` variant with Log done / Skip buttons restored.

**Tracked as:** TECH_DEBT.md TD-011 (close it out in the same PR).

---

## Item 2 — "+ ADD ACTUALS" missing on Today logged card

**File:** `app/_components/today/WorkoutCard.tsx`
**Evidence:** the conditional at line 312 — `{!actualsCaptured && (...)}` — is too eager. `actualsCaptured = hasActuals(workout)` (line 88), and `hasActuals` is defined at lines 61–71.

**Symptom:** after marking a *running* workout done (retro-log on yesterday's card), the `+ ADD ACTUALS →` link does not appear. The same flow on a *strength* workout works correctly. So whatever is unexpectedly non-null is happening to running but not strength.

**Investigation step (do this before patching):**

1. Reproduce: in dev, mark yesterday's running workout done, then inspect the row in Supabase or via a `console.log` from a server action. Identify *which* `actual_*` field is non-null on the freshly-logged running row.
2. Trace where that field gets populated. Suspects, in order:
   - `app/actions.ts:logWorkout` (lines 124+) — should only touch `status` + `logged_at`. If it's touching anything else, that's the bug.
   - The data fetch path in `lib/supabase/server.ts` — does it default any `actual_*` field to an empty string / empty object / `0` when reading? Check the select + any mapping.
   - The `Workout` type / DB schema default — is `actual_detail` defaulted to `{}` server-side? (`saveActuals` at `app/actions.ts:211` writes `a.detail ?? null`, so user-initiated path is fine, but a column default could fire on insert.)

**Likely fix shape:**

- If a field is being defaulted to a non-null empty value: fix at the data layer (column default → `null`, or read-path coerces empty `{}` → `null`).
- If the data is genuinely `null` but `hasActuals` still returns true: the bug is in `hasActuals` — most likely treat the column `actual_detail = {}` (empty object) as "no actuals". A defensive `hasActuals` could become:
  ```ts
  function hasActuals(w: Workout): boolean {
    return (
      w.actual_duration_min != null ||
      w.actual_distance_km != null ||
      w.actual_elevation_gain_m != null ||
      w.actual_hr_avg != null ||
      w.actual_rpe != null ||
      (w.actual_notes != null && w.actual_notes.length > 0) ||
      hasMeaningfulDetail(w.actual_detail)
    );
  }
  function hasMeaningfulDetail(d: ActualDetail | null | undefined): boolean {
    if (d == null) return false;
    // An empty object {} should count as "no actuals". Treat detail as
    // populated only if any inner array has at least one entry.
    return Boolean(
      (d.sets && d.sets.length > 0) ||
      (d.zones && d.zones.length > 0) ||
      (d.exercises && d.exercises.length > 0) ||
      (d.added_exercises && d.added_exercises.length > 0) ||
      (d.skipped_exercises && d.skipped_exercises.length > 0),
    );
  }
  ```

Prefer fixing at the data layer if it's a deterministic default; fall back to the defensive `hasActuals` change if the data is messy across legacy rows.

**Acceptance:** retro-log a running workout from yesterday's Today card → `+ ADD ACTUALS →` link appears in the logged footer. Same flow on strength still works. Existing rows that already have real actuals continue to *not* show the link.

---

## Item 3 — `× UNLOG` needs more affordance

**File:** `app/_components/today/WorkoutCard.tsx` (lines 321–329)

Current treatment is `text-zinc-400` ghost text — too easy to miss. Reshape to a small bordered chip-style pill. Lower visual weight than `+ ADD ACTUALS →` (which is the primary action on this row) but high enough that it reads as interactive.

**Design direction:**

- Same height as the existing chip-style buttons used elsewhere in the wizard (the `+ Add B race` reshape from commit `1c78c42` is the precedent). Roughly `h-7` or `h-8`.
- Subtle border: `border-zinc-200 dark:border-zinc-800`.
- Background transparent in both themes; on hover, a faint tint (`hover:bg-zinc-50 dark:hover:bg-zinc-900/40`).
- Text colour stays muted (`text-zinc-500 dark:text-zinc-500`) so it still reads as the destructive-ish secondary action.
- Keep the `× UNLOG` label and mono uppercase styling (`font-mono text-[10.5px] uppercase`, `letterSpacing: 0.18em`).
- Keep `pointer-events-auto` so the click registers above the card-overlay link.

**Acceptance:** Unlog reads as tappable at a glance but doesn't compete visually with `+ ADD ACTUALS →`. Side-by-side mock check on mobile and desktop, light + dark.

---

## Item 4 — `+ ADD NOTE` should sit inline with Unskip on the skipped card

**File:** `app/_components/today/WorkoutCard.tsx`

**Today's layout:**

- Lines 208–231: a `justify-between` row above `CardFooter`. Left side: `› Skipped` status indicator. Right side: `+ ADD NOTE` button.
- Lines 366–387: `CardFooter`'s `skipped` variant has `Log retrospectively` + `Unskip` in its own action row.

**Target layout (mirrors the logged variant's `+ ADD ACTUALS →` / `× UNLOG` pairing):**

- The "Skipped" status indicator row stays where it is, but loses the `+ ADD NOTE` button on the right side. Drop `justify-between`/flex-1 — it becomes a simple left-aligned status badge.
- The action row in `CardFooter` skipped variant now reads: `Log retrospectively` (primary, emerald) · `Unskip` (ghost) · `+ ADD NOTE` (emerald uppercase, same treatment as `+ ADD ACTUALS →`).

**Implementation:**

- Move the `+ ADD NOTE` button JSX from the upper row into the skipped branch of `CardFooter`.
- `noteSheetOpen` state and `<NoteSheet>` mount stay in the parent `WorkoutCard`. Pass an `onAddNote?: () => void` prop on `CardFooter` and wire it like the other handlers.
- Match the `+ ADD ACTUALS →` styling on the logged variant for visual symmetry: `text-emerald-700 dark:text-emerald-400`, mono uppercase, no border (it's a ghost link, not a chip — the Log Retrospectively button is the primary).

**Acceptance:** Skipped card's action row reads `Log retrospectively · Unskip · + ADD NOTE`. The upper row shows only `› Skipped`. Tapping `+ ADD NOTE` opens the existing `NoteSheet` with `skippedPrefill`.

---

## Item 5 — Strength drill-down: replace "Done?" pill with mobility-style checkbox

**Files:**

- Source pattern: `app/_components/workout/atoms.tsx:518` — `RoutineRow` (mobility per-exercise; circular emerald checkbox at the start of the row).
- Target: `app/_components/workout/StrengthExerciseRow.tsx:219` — current "Done?" pill on the right side.

**Design:**

- Strength exercise rows gain a circular checkbox at the **start** of the row (mirroring `RoutineRow`'s leftmost slot).
- One tap to check (marks the exercise done at planned values — i.e., today's `onMarkDoneAtPlanned` behaviour at line 215). One tap to uncheck (clears the row's logged sets — effectively the "Mark not done" path).
- The existing "× skip exercise" button on the right column (lines 222–237) stays where it is — skipping ≠ marking done, and the skipped pathway already has `UNDO` handling.
- The expanded per-set inputs view (line 244+) continues to work the same way; tapping the header still toggles expansion.

**Behaviour notes:**

- Today's "Done?" pill only appears when `sets.length === 0`. The new checkbox should follow the same conditional: visible whenever no sets are logged. When sets *are* logged, the checkbox shows as checked (since `sets.length > 0` ≡ "done") and tapping it again clears those sets.
- Be careful with the un-check flow: clearing logged sets is destructive. Add a small confirmation? **Defer the destructive-confirm question to Ben** — leave a TODO comment in the un-check branch and ship the simpler tap-to-clear behaviour for now. (Mobility's `RoutineRow` does silent toggle; strength carries more user-entered state, so the analogy isn't perfect.)
- Reuse `RoutineRow`'s circular SVG check pattern verbatim for visual consistency. Don't fork a new check glyph.

**Acceptance:**

- Strength exercise rows show a circular checkbox at the start. Tap → marks done at planned values (sets get populated, row collapses with the planned summary). Tap again → clears sets back to none.
- "Done?" pill is removed.
- The skip × button and the existing UNDO flow are unchanged.
- Mobility (RoutineRow) and Physio (PhysioExerciseRow) rows are not touched.

---

## Item 6 — Plan page: per-day completion glyph on each day pill

**File:** `app/_components/plan/WeekSection.tsx` (the day-pill loop at lines 81–138).

**Today's behaviour:** the day pill shows the primary workout kind icon (`WorkoutKindIcon` at line 117), or a `CheckMini` if `isDayDone` (every workout completed, line 87). There's no distinction between skipped, missed, or partially logged days.

**Target:** small status glyph overlaid on (or beside) the kind icon, derived per day:

- ✓ **logged** (emerald) — all workouts on the day have `status === "completed"`.
- × **skipped** (zinc, muted) — all workouts on the day have `status === "skipped"`.
- ! **missed** (amber) — at least one workout on the day is `classifyWorkout(...) === "missed"` (pending + past).
- For today + future days, no glyph — just the kind icon.

**Implementation:**

1. Add a helper near the top of `WeekSection.tsx` (or in `lib/plan-derive.ts` if it feels more at home there — your call):
   ```ts
   type DayStatus = "logged" | "skipped" | "missed" | null;
   function dayCompletionStatus(day: PlanDay, todayIso: string): DayStatus {
     if (day.workouts.length === 0) return null; // rest day
     if (day.date >= todayIso) return null;       // today or future — no retroactive glyph
     const variants = day.workouts.map((w) => classifyWorkout(w.status, day.date, todayIso));
     if (variants.every((v) => v === "logged")) return "logged";
     if (variants.every((v) => v === "skipped")) return "skipped";
     if (variants.some((v) => v === "missed")) return "missed";
     // Mixed states (e.g., 1 logged + 1 skipped) — fall back to logged-or-skipped majority
     // or return null. Default: "logged" if any logged, else "skipped".
     if (variants.some((v) => v === "logged")) return "logged";
     return "skipped";
   }
   ```
   Use `classifyWorkout` from `lib/workout-variant.ts` (already imported via `@/app/_components/today/icons`'s neighbours — check or add the import).

2. In the day-pill JSX block (line 113 onward), replace the `isDayDone ? <CheckMini /> : <WorkoutKindIcon />` ternary with a small composite:
   - Render the kind icon as the base layer (so resting kind context is preserved on logged/skipped days too).
   - Overlay or position-beside a small status glyph in the upper-right of the pill (or top-corner — pick the cleanest mobile-first treatment).
   - Use existing icon primitives where possible: `CheckMini` for logged. New small `×` and `!` SVGs at matching size (~9–10px) — keep them inline in `WeekSection.tsx` or factor into `app/_components/today/icons.tsx` if they're reusable.

3. Colours: `text-emerald-500` for logged, `text-zinc-400 dark:text-zinc-600` for skipped, `text-amber-500` for missed. Today's `isToday` highlight (emerald border + bg tint) is unchanged.

4. **Don't** show the status glyph on today or future days — only past days. Today's row gets the normal kind icon plus the existing emerald "today" treatment.

**Acceptance:**

- Scanning the Plan view week-strip: past days show ✓ / × / ! glyphs as appropriate. Today shows the kind icon with emerald highlight. Future days show kind icon only.
- Rest days (no workouts) show nothing extra — same as today.
- Multi-workout days with mixed statuses fall back to the precedence rule (logged > skipped, missed wins if anything is missed).

---

## After all six items land

1. `npm run typecheck && npm test && npm run lint` — all clean.
2. Self-smoke (no need to spin up E2E): in dev, walk through each item. Confirm the P0 (Unskip) on a real skipped card.
3. Commit messages: `fix:` for #1 and #2, `feat:` for #6, `style:` for #3 and #4, `refactor:` for #5 (or one squashed `feat: phase 3 polish round 2` if you prefer).
4. Open a PR. Title: `phase 3 polish round 2 — Unskip fix + Today/Plan polish (6 items)`. Body: paste the six item titles + one-line acceptance for each.
5. Close TECH_DEBT TD-011 in the same PR.

After merge → the auth-flow batch is next (forgot password, password show/hide, password strength, email collision, auto-login on email verify). That batch needs a Cowork planning pass first to nail down password rules, email-collision UX, and the reset/redirect flow — don't try to spec it in code without that planning round.
