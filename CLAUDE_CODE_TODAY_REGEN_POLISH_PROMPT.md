# Claude Code Prompt — Phase 3 polish batch (Today + Regen + Skip/Miss + Claude-name audit)

Paste everything below the line into Claude Code in Warp. Self-contained.

---

## Your task

Implement the next batch of Phase 3 polish — **13 items grouped into 4 logical commits** on a new branch off `main`. After today's wizard polish batch landed, this closes most of the remaining Phase 3 work, leaving only auth-flow polish (forgot password, password show/hide, etc.) for the final Phase 3 batch.

Full context lives in `PROJECT_BRIEF.md` → Phase 3 → "Smoke-test findings (2026-05-21)", "Wizard consistency findings (2026-05-21, continued)", and "Roadmap notes (2026-05-25)".

## Branch setup

```bash
git checkout main
git pull origin main
git checkout -b phase-3-polish-today-regen-misc
```

## Required reading (in this order, before any code changes)

1. `AGENTS.md` — coding standards.
2. `PROJECT_BRIEF.md` → Phase 3 section. Items already closed in this batch (don't re-spec):
   - A5 (workout-card variant logic) — closed by Phase 2.5's `classifyWorkout` rewrite. Annotate as closed in the brief at the end.
   - A6 (skipped drill-down lock) — closed as intentional. The drill-down's new behavior (allow retro-log from skipped state, with "+ Add note" affordance per C15 below) is the desired final state.
   - C14 (+ ADD ACTUALS routing) — closed as intentional. The current behavior (link to drill-down's ActualsForm) is correct; inline sheet would be too heavy for strength's collapsible exercise rows.
   - C16 (Travel journal entry) — already wired in `app/_components/journal/AddEntrySheets.tsx`.
3. `lib/workout-variant.ts` — the canonical `classifyWorkout` helper that drives Today / Plan / drill-down rendering.
4. `app/_components/today/WorkoutCard.tsx` — Today card, all five variants (upcoming / logged / skipped / missed / future) and the action-row layout. Focus areas for items A1, A2, C15.
5. `app/_components/today/Header.tsx` — Today's header. Focus for items A3, A4.
6. `app/_components/plan/PlanHeader.tsx`, `app/_components/journal/JournalHeader.tsx`, `app/_components/profile/ProfileHeader.tsx` — sibling tab headers. Focus for A4.
7. `app/_components/regen/RegenActionBar.tsx` + `app/_components/regen/StateResult.tsx` + `app/_components/regen/StateMinor.tsx` + `app/_components/regen/RegenPageClient.tsx` — regen result UX. Focus for B7–B10, B13.
8. `app/_components/generating/GeneratingPhaseState.tsx` — atmospheric generating screen with the timer. Focus for B11.
9. `lib/preview.ts` — `summarisePlannedDetailForDiff` and the diff plumbing. Focus for B12.
10. `lib/claude.ts` — SYSTEM_PROMPT + user prompt builders. Focus for C17 (Claude-name audit).
11. `app/workout/[id]/page.tsx` + components — drill-down. Focus for C15 (missed banner).
12. `app/_components/journal/AddEntrySheets.tsx` — Journal entry sheets including the "note" type. Focus for C15 (pre-filled note flow).

## Decisions already made (don't re-litigate)

These were settled with Ben in the planning session — implement them directly:

- **A6 (skipped retro-log)** — keep the current "allow retro-log from skipped state" pattern. Don't add a lock or require Un-skip first. The drill-down's banner ("You can still log this retrospectively…") is the intended final UX.
- **C14 (+ ADD ACTUALS routing)** — keep the link-to-drill-down pattern. Don't replace with an inline sheet.
- **C15 (skip + missed handling)** — *no immediate prompt on skip*. Both skipped and missed already feed Claude via the adherence-summary block (`computeAdherence` + `formatAdherenceSummary` in `lib/claude.ts`). The new affordance is an optional pre-filled Journal note + a Regen-sheet hint when there are unprocessed skips/misses since the last accepted preview. See "Part 3" below for the full design.
- **C17 (Claude-name audit)** — replace every user-facing "Claude" string with product voice: "we", "the app", "Vert" (the working brand), or "this plan" / "the plan" depending on context. Also enforce in the SYSTEM_PROMPT so future generations don't reintroduce it.

---

# Part 1 — Commit 1: Today + workout cards (items A1, A2, A3, A4)

Branch commit: `feat: today + workout card polish — log/unlog toggle, tap target, phase indicator, header alignment`

### A1 — Add unlog affordance to the Today card

**Problem.** The Today card's upcoming variant shows separate "Log done" + "Skip" buttons. After logging, the card flips to the logged variant which has **no unlog affordance** on the Today card — users have to navigate to the drill-down to mark incomplete. Add an explicit unlog control to the Today card that flips state in place.

**Decision:** the unlog control is an **explicit ghost text link in the logged variant's action row**, not a tappable pill. Rationale: a tappable `DONE ✓` pill looks like a status badge — users won't discover it's interactive. An explicit text label (`× UNLOG`) is unambiguous and matches the existing `+ ADD ACTUALS →` text-link pattern in the same row. Pattern: immediate action + toast-with-undo (no confirmation modal).

**Spec.**

- Keep the upcoming variant's "Log done" + "Skip" pair as-is.
- Keep the `CheckCircle` icon in the top-right of the logged variant's eyebrow row — it's the passive status indicator. Don't repurpose it.
- In the logged variant's action row (the one currently rendering `+ ADD ACTUALS →` on the left and `DONE · {time}` on the right), add a second ghost text link between them:
  ```
  + ADD ACTUALS →   × UNLOG                     DONE · 10:42 AM
  ```
  - Styling: monospace uppercase, `text-[10.5px]`, `0.18em` letter-spacing — match `+ ADD ACTUALS →` exactly
  - Color: `text-zinc-400 dark:text-zinc-600` (resting), `text-zinc-600 dark:text-zinc-400` on hover (lower visual weight than `+ ADD ACTUALS →` because unlog should not compete for attention)
  - Glyph: a small `×` character (or a tiny X SVG matching the close-button style elsewhere) before the word UNLOG
  - `pointer-events-auto` on the link itself so it captures the click without breaking the card overlay Link (which lives at z-0)
- **Tap behavior — immediate action, no confirmation modal:**
  1. Calls `logWorkout(id, "pending")` server action immediately
  2. On success, the card re-renders as the upcoming variant (status flips back to pending)
  3. The existing `LoggedToast` component (in `app/_components/today/LoggedToast.tsx`) slides in with copy `Unlogged ✓` and a right-aligned `Undo →` action
  4. The toast auto-dismisses after 5 seconds. Tapping `Undo →` within that window calls `logWorkout(id, "completed")` to revert and dismisses the toast
- **Why no confirmation modal:** the action is fully reversible via the toast's Undo, and any captured actuals on the workout row persist through the status flip (the server action clears `logged_at` but doesn't delete actuals). Worst case from a fat-finger tap: card flips to upcoming + 5-second window to undo. That's safer and faster than a modal.

**Reuse / adapt:**

- `LoggedToast.tsx` is currently used for the "Logged ✓" toast after marking done. Either parameterize it to accept different message + action props (`label`, `actionLabel`, `onAction`), or split it into a small `Toast` primitive + thin wrapper for each call site. The latter is cleaner if you anticipate more toast surfaces (skip, unskip, etc.).

**What NOT to do.**
- Don't add a global "Are you sure?" modal. Toast undo is the safety net.
- Don't replace the CheckCircle indicator or add a "DONE" pill — discoverability for the unlog action comes from the explicit text label in the action row, not from making the status badge interactive.
- Don't change the upcoming variant's two-button layout.
- Don't touch the drill-down's existing "Mark as incomplete" affordance — that lives in a different surface (the drill-down's sticky bottom action bar) and the Phase 3 polish doesn't need cross-surface unification.

### A2 — Workout card tap target gap

**Problem.** The action-row container on the upcoming variant has `pointer-events-auto` covering its full row width (line ~308 of `WorkoutCard.tsx`). Clicking in the empty space inside the row but outside a button (e.g., right of "Skip") lands on the container, has no handler, and **doesn't fall through** to the absolute `<Link>` overlay beneath (the Link is `z-0`, the content is `z-10`, and `pointer-events: auto` doesn't pass clicks through to z-siblings underneath).

**Spec.**

- In `WorkoutCard.tsx`, change the action-row container from `pointer-events-auto` to `pointer-events-none`.
- Move `pointer-events-auto` onto each `<button>` and `<Link>` directly — so only the actual control hit areas capture clicks; empty space falls through to the card overlay Link.
- Apply this fix to **all variants' action rows** in the file: upcoming, logged, missed, skipped (anywhere a row container currently sets `pointer-events-auto`).
- Verify by clicking just to the right of "Skip" on a today's-pending card — should now open `/workout/${id}`.

### A3 — Phase indicator missing on Today header

**Problem.** Today's Header renders `— {phase}` from a prop. The current value being passed shows up as `— WK 1/13 · 82D OUT` (week + race countdown). The design spec calls for the **periodization phase name** — BASE / BUILD / PEAK / TAPER — *plus* the week marker. Right now phase name is missing entirely.

**Use the existing phase helper — don't reinvent.** The Plan view already has a canonical periodization helper at `lib/plan-derive.ts:16`:

```ts
export type PlanPhase = "base" | "build" | "peak" | "taper";

export function computePhase(weekN: number, totalWeeks: number): PlanPhase {
  if (totalWeeks <= 3) return "build";
  const taperStart = Math.max(1, totalWeeks - 1);
  const peakStart = Math.max(1, totalWeeks - 4);
  const buildStart = Math.max(1, Math.ceil(totalWeeks / 3));
  if (weekN >= taperStart) return "taper";
  if (weekN >= peakStart) return "peak";
  if (weekN >= buildStart) return "build";
  return "base";
}

export function phaseLabel(phase: PlanPhase): string {
  return { base: "BASE", build: "BUILD", peak: "PEAK", taper: "TAPER" }[phase];
}
```

This is the same helper that drives the Plan view's per-week phase badge and the Volume sparkline's phase-tinted bands. Single source of truth — reuse it for the Today header.

**Spec.**

- Trace where `phase` is computed for the Today page (likely in `app/page.tsx` or `TodayPageClient`'s data fetch).
- Compute the current week number and total weeks from the plan data (the Plan view does this; mirror the pattern).
- Call `computePhase(currentWeekN, totalWeeks)` → `phaseLabel(result)` to get the display string (e.g., `"BUILD"`).
- **Header format:** match the Plan view's existing format for consistency across tabs. Plan view's WeekSection renders:
  ```
  — WEEK {weekNum} OF {totalWeeks} · {phaseLabel(phase)}
  ```
  Use the same format in the Today header:
  ```
  — WEEK 6 OF 18 · BUILD
  ```
  This is a small change from the original brief item's specced `BUILD · W6/18` format, but the consistency win across tabs outweighs matching the literal brief copy.
- The current `phase` prop on `<Header phase={...} />` is being passed a week + countdown string. Replace the value being passed with the new format. The race countdown (`82D OUT`) already lives elsewhere (`PlanStrip` below the header carries the day-count + total-volume info), so don't double-render it in the header.
- Verify on mobile width — the new string should fit comfortably alongside the centered logo at narrow viewports.

**What NOT to do.**
- Don't add a new database column for `phase` — `computePhase` is pure-derived.
- Don't reimplement the phase math; reuse `computePhase` / `phaseLabel` directly.
- Don't break the existing Plan tab's phase-pill UI — this change is Today-header-only.

### A4 — Header alignment inconsistent across tabs

**Problem.** Today's Header wraps in `mx-auto flex max-w-[720px]` (logo on left, phase label absolutely-centered within the 720px column). Plan / Journal / Profile headers use `flex items-center justify-between` with no max-width wrap — logos flush to the screen edge on wide desktops. Inconsistent.

**Spec.**

- Update `PlanHeader.tsx`, `JournalHeader.tsx`, `ProfileHeader.tsx` to use the same outer-wrapper pattern as `Header.tsx`:
  ```tsx
  <div className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
    <div className="mx-auto flex max-w-[720px] items-center px-4 py-3.5 sm:px-5">
      <VertLogo ... />
      {/* tab-specific right-side content if any */}
    </div>
  </div>
  ```
- Plan / Journal / Profile don't have a phase label, but the inner container should still be `max-w-[720px] mx-auto` for visual rhythm.
- After the change, the Vert logo should appear at the same horizontal position on all four tabs on desktop (~1/3 from the left within the centered 720px column).

---

# Part 2 — Commit 2: Regen sheet + diff polish (items B7, B8, B9, B10, B11, B12, B13)

Branch commit: `feat: regen + diff polish — button widths, sticky actions, accept-flash, timer survival, title-level diff, unsaved warning`

### B7 — "Accept new plan" button too wide

In `RegenActionBar.tsx`, the Accept button uses `flex-1` which stretches it to fill the row. Wizard submit uses fixed sizing (`px-4` only). Make Accept match the wizard pattern: drop `flex-1`, give it the same `h-11 px-4` sizing as the wizard's "Generate my plan" / "Continue" buttons. The result: Accept and "Regenerate again" sit as equally-sized fixed-width buttons rather than Accept dominating.

### B8 — Regen actions sticky-bottom

`RegenActionBar.tsx` is currently a plain border-top container at the end of the result page. On long diffs, the action row scrolls off-screen.

- Apply `sticky bottom-0` to the outer container so the action row stays visible during scroll on both mobile and desktop.
- Include `pb-[max(env(safe-area-inset-bottom),18px)]` (matches the wizard's pattern) so iOS safe-area is respected.
- Add a subtle shadow above the sticky bar so it visually separates from scrolled content (e.g., `shadow-[0_-12px_24px_rgba(0,0,0,0.12)]` or similar — match the existing visual language).
- Verify the diff content area has enough bottom padding (~80px) so the last diff row isn't hidden under the sticky bar.

### B9 — "Keep current plan" alignment

Currently right-aligned via `<div className="mt-2.5 flex justify-end">`. The smoke test flagged it as "appears shifted too far right" — visually adrift from the action group above.

- Move "Keep current plan" to **inline with the action group**, positioned to the left of the primary buttons (mirrors a typical "Cancel | Save" pattern):
  ```tsx
  <div className="flex items-center gap-2.5">
    <Link href="/" className="...">Keep current plan</Link>
    <span className="flex-1" />
    <Link href="/regen?state=generating">Regenerate again</Link>
    <Link href="/regen?state=accepted">Accept new plan</Link>
  </div>
  ```
- Keep visual hierarchy: "Keep current plan" is a ghost text link, "Regenerate again" is an outlined button, "Accept new plan" is the primary filled button. So even when inline, hierarchy is clear.

### B10 — Generating-screen flash after accepting a plan

In `RegenPageClient.tsx`, the `phase` state flips to "generating" before a router push transitions away. The brief flicker of `StateGenerating` between Accept-click and the route change is the bug.

- Add a separate state flag (`accepting: boolean`) tracked in the same component.
- When the user clicks Accept, set `accepting = true` immediately, then call the commit action, then router.push to home. Render guard:
  ```tsx
  if (accepting) return <StateAccepted />;  // or whatever post-accept screen renders
  if (phase === "generating") return <StateGenerating />;
  ```
- The Regenerate-again path keeps the old behavior (it really IS generating again).

### B11 — Regen timer resets on page refresh

In `GeneratingPhaseState.tsx` line ~69, the timer captures `startedAt = Date.now()` in a useEffect — so refreshing the page resets the clock. Real elapsed time is lost.

- The persistent `plan_generation_jobs` row has a `created_at` (or similar — verify column name). The polling endpoint already returns this row. Read `created_at` from the polling response and use that as the timer origin instead of `Date.now()`.
- Also consider: on the very first mount (before the first poll lands), fall back to `Date.now()` so the timer starts immediately rather than waiting for the first poll.
- After the first poll, switch the timer origin to the persisted `created_at`. The displayed elapsed seconds should then survive any number of refreshes.
- Make sure timezone handling is correct — Postgres `created_at` is typically UTC; convert to ms via `new Date(createdAt).getTime()`.

### B12 — Diff strength/mobility title-level summary

In `lib/preview.ts`, `summarisePlannedDetailForDiff` for `gym` / `physio` returns `${dur}${exercises.map((e) => e.name).join(", ")}` — full list of exercise names. For `mobility`, same pattern. Running shows title-level info already (distance / duration / pace).

- Change strength (`kind === "gym"`) and physio summary to: `{duration} min · {exercise count} exercises` (e.g., `45 min · 8 exercises`).
- Change mobility summary to: `{duration} min · {movement count} movements` (e.g., `20 min · 10 movements`).
- Cross-training summary stays as-is (already title-level).
- Hike summary stays as-is.
- Run summary stays as-is.
- This affects the `DayDiff` rendering in the regen result page — verify the diff still reads cleanly after the change (per-exercise detail belongs on the drill-down, not the diff).
- Update any tests in `lib/preview.test.ts` that assert the old comma-joined format.

### B13 — Unsaved-plan warning when leaving the diff

Currently, navigating away from the regen result page (back button, tab switch, manual URL change, refresh) without clicking Accept silently discards the previewed plan.

- Add a `beforeunload` handler to the regen result page (`StateResult.tsx` and `StateMinor.tsx`) that fires only when `phase === "result"` and the user hasn't committed:
  ```tsx
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!isCommitting && !isAccepted && !isDiscarded) {
        e.preventDefault();
        e.returnValue = "";  // required for Chrome
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isCommitting, isAccepted, isDiscarded]);
  ```
- For Next.js router-driven navigation (back button, tab switch within the app), `beforeunload` doesn't fire. Need a parallel guard:
  - Next.js 15 App Router doesn't have a built-in route-change blocker. The cleanest pattern is to intercept the back button via `history.pushState` (push a dummy state on mount, listen for `popstate`, show a custom confirmation modal, then either router.back if confirmed or pushState again to cancel).
  - For tab-switch within the bottom tab bar: wrap the tab Links in a custom component that shows the confirmation modal first.
  - **Pragmatic alternative:** skip the in-app navigation guard for this batch and only ship `beforeunload`. Note in the commit body that in-app nav guard is deferred. Real-world: users mostly leave via back button (handled by `beforeunload` on full page navigations).
- Confirmation message: "Your new plan won't be saved — leave anyway?" with [Stay] and [Leave] buttons.
- Don't fire on Accept-click or Keep-current-plan-click (those are clean exits — the flags above track that).

---

# Part 3 — Commit 3: Skip + missed annotation flow (item C15)

Branch commit: `feat: skip + missed annotation — pre-filled journal note + regen-sheet recency hint`

### The design (settled)

Both skipped and missed workouts already feed Claude via the adherence-summary block (`computeAdherence` + `formatAdherenceSummary` in `lib/claude.ts`). **No automatic journal entry is created.** The new affordance is:

1. **Optional pre-filled Journal note** — surfaced as an inline `+ ADD NOTE` affordance:
   - On the Today card's **skipped** variant (right after the user taps Skip)
   - On the drill-down's **missed banner** (currently reads "MISSED · YOU CAN STILL LOG THIS" — append the same affordance there)
   - Both open the existing Journal "note" entry sheet (`AddEntrySheets.tsx`) with a pre-filled body: `"Skipped: {workout title} on {YYYY-MM-DD} — "` (for skipped) or `"Missed: {workout title} on {YYYY-MM-DD} — "` (for missed). Cursor lands after the trailing space so the user can type why.
   - If the user dismisses the sheet without saving, no journal entry is created. Just the adherence signal exists (which is fine — Claude still sees the skip via `computeAdherence`).
   - If they save, the entry goes into the journal feed as a regular Note, with `consumed = false`, picked up by the next regen via the existing `journal_entries.consumed` pipeline.

2. **Regen-sheet hint** — surface a recency callout when adherence shows unprocessed skipped + missed workouts since the last accepted preview:
   - In `RegenerateSheet.tsx`, just below the existing "Recent context Claude already has:" block (or near it), render a one-line:
     ```
     RECENT SKIPS · {count} since last update · {short list of dates / kinds}
     ```
     Example: `RECENT SKIPS · 3 since last update · Mon · Wed · Fri`
   - Tappable: expanding it shows the list of skipped/missed workouts and an inline "Add a note about these" link that opens the journal note sheet (same pre-filled flow).
   - This block only renders when count > 0.
   - Replace the existing "Adding notes will give Claude more to work with" copy if it overlaps — the new hint is more specific.

### Implementation steps

1. **Extend `AddEntrySheets.tsx`** to accept an optional `prefill?: { type: "note"; body: string }` prop. When set, the note sheet opens with the textarea pre-filled. Cursor positioning after the open: `textareaRef.current?.setSelectionRange(prefill.body.length, prefill.body.length)`.
2. **Today card skipped variant** (`WorkoutCard.tsx`):
   - Below the current "Skipped" text indicator, add a new line: `+ ADD NOTE` — same monospace uppercase styling as "+ ADD ACTUALS → " on logged variant
   - On click, opens the parent's AddEntrySheets (which lives in the Today page client) with the pre-filled body
3. **Drill-down missed banner** (`app/workout/[id]/page.tsx` or the banner component it uses):
   - Append a second line to the banner: `+ Add note about why this didn't happen`
   - Same pre-filled flow
4. **Regen sheet hint** (`RegenerateSheet.tsx`):
   - Query the journal pipeline for skipped + missed workouts since the last accepted preview (or last 14 days if no accepted preview)
   - Server-side: extend `getRegenContext` (or wherever the sheet's data is fetched) to include `recentSkipsCount` + a list of dates/kinds
   - Render the new RECENT SKIPS block when count > 0
   - Tappable expansion: list view + inline "Add a note about these" link
5. **Cross-page note flow** — when the user taps "+ ADD NOTE" on the Today card or drill-down, the AddEntrySheets is opened in the same page context. No new route, no navigation. The journal entry is created inline.

### Edge cases to handle

- Workout has been deleted between the user tapping Skip and the note flow opening: don't crash, just show a generic pre-fill like `"Skipped a workout on {date} — "`.
- User taps + ADD NOTE multiple times on the same skipped card: each opens the sheet fresh (no concurrent state issues). Multiple notes per skip is OK — the journal feed already supports it.
- Adherence summary shows zero skips: don't render the hint block at all in the regen sheet (no zero-state needed).

---

# Part 4 — Commit 4: Claude-name audit (item C17)

Branch commit: `chore: remove "Claude" from user-facing copy + enforce in system prompt`

### Audit checklist

Sweep these locations for any user-facing "Claude" string and replace with product voice:

1. **`lib/claude.ts` SYSTEM_PROMPT itself** — does the prompt tell the model to use a particular voice or refer to itself as Claude? Search the prompt text for `Claude` (excluding code comments). If present, remove and add a new voice rule (see below).
2. **UI strings** — grep `app/` for any user-facing string containing "Claude" (excluding code comments and import paths):
   - `app/_components/journal/InjuryForm.tsx:46` — error message: `"Pick a body part so Claude knows where to back off."` → `"Pick a body part so we know where to back off."`
   - `app/_components/profile/AthleteForm.tsx:577` — placeholder: `"Recovered injuries Claude should know about."` → `"Recovered injuries we should know about."`
   - `app/_components/workout/atoms.tsx:258` — hint: `"...anything Claude should weigh into the next plan update."` → `"...anything we should weigh into the next plan update."`
   - `app/_components/regen/RegenerateSheet.tsx:200` — label: `"Recent context Claude already has:"` → `"Recent context we already have:"`
   - `app/_components/regen/RegenerateSheet.tsx:229` — hint: `"Adding notes will give Claude more to work with..."` → `"Adding notes will give us more to work with..."`
   - Any others surfaced by a `grep -rn "Claude" app/` pass — check each match and replace if user-facing.
3. **Workout `why` rationale strings** — the per-workout Claude-generated `why` field (replaced STUB_WHY in Phase 2). The system prompt that drives this generation needs an explicit rule that the model must not refer to itself by name.

### SYSTEM_PROMPT addition

Add a section near the top of the SYSTEM_PROMPT (after the opening role / persona block):

```
## Voice

You are the coach behind this athlete's training plan. You speak as the plan and the coaching system — never as a model or named AI.

- Use "we", "this plan", "the workout", or coach voice ("we built this session to…", "today calls for…").
- Never refer to yourself as Claude, an AI, a model, or an assistant.
- Never apologize for being AI ("As an AI, I…"), and never disclaim authority on training matters.
- The athlete is your reader. Speak directly and with the confidence of a coach.
```

### Tests

If `lib/claude.test.ts` has any assertions on prompt content, make sure the new voice block is reflected. Don't snapshot the entire prompt — that's brittle. Just assert the voice block is present.

Add a small test that runs `formatProfile` + `formatHistory` + assembles a prompt + asserts the word `Claude` does not appear in the OUTPUT (separate from the prompt itself):
```ts
it("never refers to itself as Claude in the output", async () => {
  // mock the API to return a sample workout `why`
  // assert that the rendered why string doesn't contain /\bClaude\b/i
});
```

### Brand-name centralisation reminder

`lib/brand.ts` already exists as the canonical brand-string source (per PROJECT_BRIEF.md). When you replace "Claude" with product voice, **prefer "we" over hard-coding the brand name** — most replacements should be first-person plural. Only use `BRAND` (from `lib/brand.ts`) where the product needs to identify itself by name (e.g., a footer credit). Keep find-and-replace cheap for the eventual rebrand.

---

# Final verification

Before opening the PR:

```bash
npx tsc --noEmit            # exit 0
npm test                     # full vitest suite — all passing
npm run lint                 # if configured
npm run dev                  # local smoke pass
```

### Local smoke checklist

1. **Commit 1 (Today + cards):**
   - On the Today screen, click the dead space to the right of "Skip" on a today's-pending card → drill-down opens (A2)
   - Header shows `— {PHASE} · W{n}/{m}` format (A3)
   - Open Plan / Journal / Profile in sequence — Vert logo sits at the same horizontal position on all four tabs on desktop (A4)
   - Log a workout, then tap the new DONE pill on the logged card → unlog confirmation flow → card returns to upcoming variant (A1)

2. **Commit 2 (Regen):**
   - Trigger a regen, accept it: no flash of the generating screen during the redirect (B10)
   - Scroll a long regen diff: action bar stays sticky at the bottom (B8)
   - Accept button is the same width as wizard submit (B7)
   - "Keep current plan" sits inline with the action group, not floating right (B9)
   - Refresh the page mid-regen: timer continues from real elapsed time, not zero (B11)
   - Diff shows strength as "45 min · 8 exercises" not a comma-joined list (B12)
   - Trigger a regen, try to navigate away on the result page: confirmation prompt fires (B13)

3. **Commit 3 (Skip + missed):**
   - Tap Skip on a today's-pending card → card flips to skipped variant → tap "+ ADD NOTE" → Journal note sheet opens pre-filled with "Skipped: {title} on {date} — " → cursor after the dash
   - Skip a few workouts, open the Regen sheet → "RECENT SKIPS · 3 since last update" block visible → tap to expand
   - Open a past missed workout in the drill-down → banner shows "+ Add note about why this didn't happen" → opens pre-filled flow

4. **Commit 4 (Claude-name audit):**
   - Run `grep -rn "Claude" app/` — only matches in code comments and import paths remain; no user-facing strings reference Claude
   - Generate a regen, inspect the `why` strings on the new workouts — none mention Claude by name

---

# PR title + body

When all four commits are clean, push the branch and open a PR:

**Title:** `Phase 3 polish — Today + Regen + Skip/Miss + Claude-name audit`

**Body:**
```
Four commits closing 13 Phase 3 items from the 2026-05-21 smoke-test findings + 2026-05-25 roadmap notes.

- Commit 1 — Today + workout cards: log/unlog toggle (A1), tap target fix (A2), phase indicator in header (A3), header alignment unified across all four tabs (A4)
- Commit 2 — Regen + diff: Accept button width (B7), sticky-bottom action bar (B8), Keep-current-plan alignment (B9), suppress generating-screen flash on accept (B10), regen timer survives refresh via plan_generation_jobs.created_at (B11), diff title-level for strength/mobility (B12), unsaved-plan beforeunload guard (B13)
- Commit 3 — Skip + missed annotation: + ADD NOTE affordance on skipped Today card + missed drill-down banner, pre-filled journal note flow, Regen-sheet recency hint when adherence shows unprocessed skips/misses
- Commit 4 — Claude-name audit: replaced every user-facing "Claude" string with product voice ("we", "this plan"); added voice rule to SYSTEM_PROMPT to prevent regression

Already-closed items annotated in PROJECT_BRIEF.md after merge: A5 (variant logic — closed by Phase 2.5), A6 (skipped retro-log — intentionally changed), C14 (+ ADD ACTUALS routing — intentional), C16 (Travel journal — already wired).

Remaining Phase 3: auth-flow polish (forgot password, password show/hide, password strength, email collision, auto-login after email verify) — separate PR.
```

When the PR is ready, hand the URL back to Ben for review/merge.
