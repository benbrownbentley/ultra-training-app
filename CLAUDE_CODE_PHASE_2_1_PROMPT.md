# Claude Code Prompt — Phase 2.1 (Generation Instrumentation + Friendly Error UX)

Paste everything below the line into Claude Code in Warp. Self-contained.

---

## Your task

Implement **Phase 2.1** of the Vert roadmap — two small, focused additions that pair together as one PR:

1. **Generation instrumentation** — add server-side logging so future decisions about token volume, chunking, and `why` cap sizing are data-driven rather than guessed.
2. **Friendly generation-failure error state** — replace the Vercel default white-screen 504 with a branded retry UX on every page that triggers plan generation.

This work follows the **Phase 2 deploy on 2026-05-22**, which surfaced a Vercel Hobby tier timeout problem (full plan generation now exceeds 60s due to ~3× output token growth). Phase 2.5 (chunked generation) is the architectural fix and comes next. Phase 2.1 is what makes Phase 2.5 possible to design well and what gives users a non-broken error experience in the meantime.

Full context lives in `PROJECT_BRIEF.md` → "Phase 2.1 — Immediate Phase 2 follow-ups (2026-05-22)" and "Phase 2.5 — Chunked plan generation" sections.

## Required reading (in this order, before any code changes)

1. `AGENTS.md` — coding standards, no `any`, JSDoc on exports, Vitest tests for `lib/` business logic, shadcn/ui discipline.
2. `PROJECT_BRIEF.md` — read three sections specifically:
   - "Phase 2.1 — Immediate Phase 2 follow-ups (2026-05-22)" — the scope of this PR
   - "Phase 2.5 — Chunked plan generation" — for context on what comes next (the instrumentation here informs that work)
   - "Phase 2 timeout-architecture deferrals (2026-05-22)" — what's explicitly OUT of scope
   - The existing "Regeneration result page" section deeper in the file — for the error-state design language (`— SIGNAL LOST`, `— REST DAY`, athletic vocabulary, em-dash labels). The friendly error state for generation timeouts should extend this same voice.
3. `lib/claude.ts` — read `generateTrainingPlan` end-to-end (the entry point at the bottom, plus the retry mechanic around it).
4. `app/_components/regen/StateError.tsx` (if it exists) — the existing regen error state; the friendly generation-failure state should match its visual language.
5. `app/wizard/_components/` — find the wizard's submit + generating screen; the error state needs to live alongside the existing "Generating your plan…" atmospheric screen.

## Part 1 — Generation instrumentation (~30 minutes)

### What to add

In `lib/claude.ts`, after every successful `generateTrainingPlan` call (right after the validator passes — both on first attempt and on retry success), emit a single structured log line that captures:

- Total output tokens (read from the Anthropic SDK response's `usage.output_tokens` field)
- Total input tokens (`usage.input_tokens`) — useful context for understanding total cost
- Wall-clock duration in seconds (capture `Date.now()` at call start vs. after parse)
- Workout count
- `why` character-length distribution: `avg`, `max`, `count_over_400`, `count_over_480`, `count_under_50`
- Whether this was a wizard run (first plan) or a regen — pass an arg through `GeneratePlanArgs` if needed

Use `console.log` with a stable prefix so the logs are greppable in Vercel's log viewer:

```
[plan-gen-metrics] { tokens_out: 24500, tokens_in: 8200, duration_s: 248, workouts: 126, why_avg: 312, why_max: 498, why_over_400: 47, why_over_480: 8, why_under_50: 2, is_wizard: false }
```

Also log when validation fails on first attempt + retry is firing, and when retry succeeds vs. throws — useful for understanding how often we hit the retry path. Reuse the existing `[generateTrainingPlan]` prefix (or whatever the current logs use) for those — only the metrics line gets the `[plan-gen-metrics]` prefix.

### Why structured

JSON-shaped logs are trivially greppable + parseable later (jq, simple node scripts, or just eyeballed). The whole point is "Ben runs a few regens, scrolls through Vercel logs, eyeballs the distribution, and informs Phase 2.5 chunk sizing." Don't make him scrape `Total tokens: 24500 (input 8200, output 24500)` style logs.

### What NOT to do

- Do not wire PostHog or any external analytics tool. PostHog is a Phase 4 item per PROJECT_BRIEF.md. Console logs land in Vercel automatically.
- Do not store the metrics in the database. Logs are sufficient. If we ever need historical data, we'll wire PostHog in Phase 4.
- Do not change the `why` cap or any other Phase 2 design decisions. This is observation, not action.
- Do not bypass the existing auto-retry-once mechanism. Just observe it.

### Tests

Add one Vitest spec for the metrics-calculation helper (extract the why-length distribution math into a pure function so it's testable). One test verifying `avg`, `max`, `count_over_400`, `count_under_50` compute correctly over a fixture array of strings. The `console.log` call itself doesn't need a test.

## Part 2 — Friendly generation-failure error state (~1-2 hours)

### Current behavior (broken)

When `generateTrainingPlan` times out (Vercel 504 at 60s on Hobby), the user sees:

- **On wizard submission** — atmospheric "Generating your plan…" screen freezes, then Vercel's default white-on-white 504 error page replaces the whole app
- **On regen sheet** — the "Generating…" state freezes, then the same white 504
- **No retry path, no message, no clue what happened**

This is also the failure mode when Anthropic API has a transient error, the auto-retry-once exhausts itself, or any other generation failure that throws.

### Target behavior

A branded error state with:

- **Voice** — athletic vocabulary matching the existing `— SIGNAL LOST` / `— REST DAY` framing already specced for regen errors (see PROJECT_BRIEF.md → "Regeneration result page" → error state). Don't invent a new design language; extend the existing one.
- **Message** — the user sees something like "— LOST THE SIGNAL · The plan didn't finish generating in time. The next attempt usually lands cleanly." (or similar — write it in the existing voice). Acknowledge the problem, set expectations, offer the next action.
- **Action** — a single primary CTA: "Try again" (re-triggers the same generation). On the wizard, an additional secondary "Edit setup" link that returns to wizard step 1 in case the user wants to change inputs that affect plan size (e.g., compress the date window).
- **No technical detail leaked** — no Vercel error codes, no stack traces, no "504 Gateway Timeout." The user doesn't need to know.

### Entry points to wire

The generation error state needs to handle failures at every entry point that calls `generateTrainingPlan`:

1. **Wizard submission** (`app/wizard/page.tsx` or the wizard's submit server action). On failure, the atmospheric "Generating…" screen transitions to the error state instead of unmounting into a 504.
2. **Regen sheet → preview generation** (`app/actions.ts → previewPlan` and the regen-result page). The existing regen flow already has a `StateError` for *regen* errors — confirm whether this catches the timeout case too. If yes, just verify the copy matches the voice. If no, extend `StateError` to handle the generation-timeout case explicitly.
3. **Home page generation** — the `app/page.tsx` (Today) has the empty-state redirect to `/wizard` for new users with no plan. Wizard timeout handling covers this case; nothing extra needed.

### Implementation pattern

Server actions that call `generateTrainingPlan` already throw on failure (the retry mechanic + validation already handle the soft path; what reaches the action layer is hard failures). Wrap each call in a try/catch, distinguish timeout-shaped errors from other failures, and surface a typed error to the UI. The UI then renders the friendly state instead of letting Next.js's default error boundary catch it (which shows the white 504).

For timeout detection: Vercel's 504 manifests as a function-execution-timeout error. Look for `error.name === "AbortError"`, `error.message.includes("timeout")`, or a 60-second wall-clock check before Claude returns. Be defensive — any uncaught throw from `generateTrainingPlan` should land on the friendly state, not the Next.js default.

### Visual reference

The existing `StateError` component (`app/_components/regen/StateError.tsx` or similar) is the pattern. Reuse the same components and tokens where possible. The wizard's atmospheric "Generating…" state lives in `app/_components/wizard/` or `app/wizard/` — extend that state machine with a new "Error" state alongside the existing "Generating" / "Success" states.

### Tests

- One Vitest spec for the typed-error-from-server-action shape (the action returns `{ ok: true, plan }` or `{ ok: false, code: "generation_timeout" | "validation_failed" | "anthropic_error" | "unknown" }`).
- One React Testing Library / smoke test that mounts the wizard error state and verifies the Retry button is present + the message renders.
- Do not test the actual 504 timeout — that's a Vercel concern, not testable in unit tests.

## What you must NOT do

- Do not implement Phase 2.5 (chunked generation) in this PR. That's the next session's work after Ben has logging data to inform chunk sizing.
- Do not upgrade Vercel to Pro (`vercel.json` changes, `maxDuration` bumps beyond what's already in place). The maxDuration values already in the code are fine — they activate automatically on Pro if/when Ben upgrades, and are no-ops on Hobby.
- Do not change the `why` cap from 500 chars. The instrumentation from Part 1 is the input to the cap-revisit decision, which happens in a future session.
- Do not touch any Phase 3 backlog items.
- Do not introduce PostHog, Sentry, or any external observability tool. Console.log is sufficient for Phase 2.1.
- Do not add `any` types anywhere.

## Verification before declaring done

Per AGENTS.md item 5:

- `npm run lint` — must pass with zero errors.
- `npm run build` — must complete successfully.
- `npm run test` — full suite must pass. Expect a small increase in test count (one or two new tests per part).

## Done definition

- `[plan-gen-metrics]` log lines appear in Vercel logs after every plan generation, with the documented JSON shape.
- Wizard, regen sheet, and any other generation entry point handle timeout / generic failure with the branded error state — no more Vercel white-screen 504s reaching users.
- All Vitest tests pass.
- PR description includes: (a) link to `PROJECT_BRIEF.md` Phase 2.1 section, (b) the JSON-shaped log line example so Ben knows what to grep for, (c) screenshots of the new error state on at least the wizard and regen entry points, (d) one-line note that Phase 2.5 is the next architectural step and requires the data this PR produces.

## Operational note for Ben (not implementation work)

After this PR merges and deploys:

1. Force a regen on prod (which will likely 504 because Hobby's 60s ceiling is still in effect). The error state should render cleanly instead of the white 504.
2. The retry will likely also 504 — that's expected, this PR doesn't fix the timeout itself.
3. The logging line for any *successful* generation will appear in Vercel logs. To get a successful generation on Hobby, Ben can either:
   - Wait until Phase 2.5 ships chunked generation, OR
   - Temporarily shorten the race date in the wizard to a 4-week window for testing purposes (a 4-week plan fits 60s), generate, capture metrics, then restore the real race date

The point of Part 1 is to capture metrics from *any* successful generation so we know the per-workout token cost. A 4-week test generation tells us 90% of what we need to know for Phase 2.5 sizing.

Good luck. The spec sections in PROJECT_BRIEF.md are the source of truth — when in doubt, re-read the relevant section.
