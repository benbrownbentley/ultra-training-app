# Claude Code prompt — Scaffold the four missing routes

The Profile and Plan tabs link to routes that don't exist yet. The actions
are already wired in `app/actions.ts`; this is mostly form-to-action plumbing.
~1 day of work.

---

```
Build four missing routes. Each has its server action already defined in
app/actions.ts — this is route scaffolding, not new business logic.

ROUTE 1 — /profile/race (race calendar landing)
Path: app/profile/race/page.tsx

- Server Component. Fetch all races for the current user via
  lib/supabase/server.ts (add a helper if one doesn't exist:
  getRaces() → Race[], ordered by priority A→B→C then by date).
- Render the race calendar layout from the design:
  · Back link "← Profile" top-left
  · Section label "— RACE CALENDAR"
  · Title "Your races"
  · Sub-line "Sorted by priority — A races first."
  · One card per race using RaceCard component (already exists at
    app/_components/profile/RaceCard.tsx — pass it the race row)
  · A race: emerald-filled badge "A · PRIMARY TARGET"
  · B race: emerald-outlined badge "B · TUNE-UP RACE"
  · C race: dimmed badge "C · TRAINING-GRADE"
  · Past races (date < today): "COMPLETED" badge + strikethrough on name
  · Each card has an "Edit" link routing to /profile/race/[id]
  · "+ Add another race" affordance at the bottom routing to /profile/race/new
- Bottom tab bar with PROFILE active.

ROUTE 2 — /profile/race/[id] (edit race) and /profile/race/new (add race)
Path: app/profile/race/[id]/page.tsx

- One file handles both add and edit. If id === 'new', render an empty form;
  otherwise fetch the race by id (verifying user_id) and pre-populate.
- Server Component wrapping a client RaceForm component (the form exists
  at app/_components/profile/RaceForm.tsx — pass it the optional race row).
- Form layout matches the design:
  · Back link "← Race calendar"
  · Section label "— EDIT RACE" (or "— ADD RACE" for new)
  · "— PRIORITY" segmented control [A] [B] [C] with helper text per option
  · "— RACE DETAILS" group: race name, race date, distance (number + unit
    suffix per user pref), elevation gain (m or ft), terrain chip
    multi-select
  · "— RACE GOAL" group: target finish time (optional), effort intent
    segmented control (Competitive / Finish strong / Just finish for A/B;
    locked to Training-grade for C)
  · "— ADDITIONAL DETAILS" collapsible group: elevation loss, cutoff time,
    climate, course profile, aid station support
- Form submit calls saveRace(payload). Action redirects to /profile/race
  on success (already wired).
- Delete affordance: "Delete race" red text link in the action bar. Calls
  deleteRace(id). Requires a confirmation modal — use shadcn AlertDialog or
  similar. Only visible when editing (not when adding).

ROUTE 3 — /profile/account (email, password, sign out)
Path: app/profile/account/page.tsx

- Server Component. Fetch the user via requireUser-style server-side check
  and pass email + connected providers to a client AccountClient component
  (already exists at app/_components/profile/AccountClient.tsx).
- Layout matches the design:
  · Back link "← Profile"
  · Section label "— ACCOUNT"
  · Title "Email & password"
  · "— EMAIL" group: current email shown, "Change email" link → inline
    form with new email + current password fields
  · "— PASSWORD" group: "Change password" link → inline form with current
    password + new password + confirm new password fields
  · "— CONNECTED ACCOUNTS" group: lists OAuth providers (Google in v2),
    "Disconnect" inline action for each. "Connect Google" if not connected.
  · "— SECURITY" group: "Sign out of all devices" link with confirmation
- Add server actions in app/(auth)/actions.ts as needed:
  · changeEmail(newEmail: string, currentPassword: string)
  · changePassword(currentPassword: string, newPassword: string)
  · disconnectProvider(provider: 'google' | ...)
  · signOutAllDevices()
- Use the standard Supabase auth admin patterns. RLS doesn't apply to
  auth.users so use the admin client carefully + always re-check user.id.

ROUTE 4 — /plan/week/[n] (per-week drill-down)
Path: app/plan/week/[n]/page.tsx

- The [n] param is the week index (1–18 for the canonical 18-week block,
  but should support any number).
- Server Component. Fetch the plan via getPlan(), filter to the days that
  belong to the requested week (week start computed from plan start date
  + (n-1)*7).
- Layout matches the design:
  · Back link "← Plan"
  · Section label "— WEEK [N] OF [TOTAL] · [PHASE] · [WEEKS] WEEKS TO [RACE]"
  · Title "Mon [start] — Sun [end]" (the week's date range)
  · Sub-pill "BUILD PHASE · WEEK [N] OF [phase-total]" — position within
    the phase, not the whole block
  · Week summary tiles (data-tile pattern): VOL · VERT · QUALITY · PHASE
    (compute these from the workouts in the week)
  · Each day expanded into a full workout card section:
    · Day header: "MON 16 MAY" mono uppercase + day summary
      ("Easy 8km · Z1-Z2")
    · One WorkoutCard per workout for that day, with motif backgrounds
      and Log done / Skip buttons
    · Rest days shown as a peaceful "— REST" section with the "Recovery
      is the work" copy from the brief
  · Bottom tab bar with PLAN active

PATTERNS TO FOLLOW
- See app/profile/page.tsx for the Profile tab landing pattern
- See app/profile/athlete/page.tsx for a sub-route with a client form
- See app/plan/page.tsx for the Plan tab with week sections
- All forms use shadcn/ui primitives (already installed: Button, Input,
  Label, Textarea, Select, RadioGroup, Separator). Add Dialog, Sheet,
  Slider, Tabs, Toggle as needed via `npx shadcn@latest add <name>`.
- Server Components by default; "use client" only for form handlers,
  date pickers, sliders
- Use zod for action input validation
- Match the em-dash mono section labels with tracking-[0.2em] convention

CONSTRAINTS
- Don't put Supabase queries inline in pages — extend lib/supabase/server.ts
  with new helpers (getRaces(), getRaceById(id), etc.)
- Don't duplicate the auth pattern — actions already use requireUser()
- Don't add a Vert wordmark string; if you reference the brand in copy,
  add a lib/brand.ts constant first (or use the existing one if it now
  exists). See PROJECT_BRIEF.md "Brand name centralisation".

VERIFICATION CHECKLIST
- Run npm run lint and npm run build, fix all errors
- Manually test: navigate from Profile → Race info → Edit a race → save
  → verify the change reflects on Today / Plan
- Add a new race, set it as B priority, save, verify it appears in the
  calendar list under the A race
- Delete a race, verify it's gone
- Navigate from Plan tab → tap a week → see per-week view → tap a
  workout → drill-down to /workout/[id]
- Sign out from Profile → Account, sign back in, verify session persists
- Change email + change password flows work end-to-end
```
