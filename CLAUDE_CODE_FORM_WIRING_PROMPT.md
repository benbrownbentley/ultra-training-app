# Claude Code prompt — Wire forms and preferences

Connect the athlete profile form to its action, persist preferences (theme,
units, notifications), wire the theme provider, and add the units conversion
layer. ~1 day of work.

---

```
Wire the remaining UI stubs and preference controls to real persistence
and runtime behavior.

TASK 1 — WIRE ATHLETE PROFILE FORM SUBMIT
File: app/_components/profile/AthleteForm.tsx
- The form currently renders all the fields but the submit isn't bound to
  saveAthleteProfile (the action exists at app/actions.ts:417).
- Wire the form's submit handler to call saveAthleteProfile(payload).
- Use useTransition for the loading state and disable the submit button
  while the action is in flight.
- Show inline error messaging if the action throws (a simple <p> below
  the form action bar).
- On success, the action's redirect("/profile") handles navigation.
- Verify all v1 must-have AND nice-to-have fields are present and saving:
  fitness_rating, weekly_volume_km, weekly_hours, longest_run_distance/
  date, years_running/ultras, ultras_completed, longest_race_distance/
  name/date, previous_endurance (multi-select chips), age, body_weight,
  sex, injury_notes, chronic_conditions, sleep_hours, stress_baseline,
  training_days, long_run_day, quality_day, strength_freq, time_of_day,
  job_type, gym_access, equipment, outdoor_terrain, cross_training_enjoys,
  max_hr, resting_hr, lactate_threshold_hr, vo2_max (the "Additional
  details" collapsible group), training_preferences (the freeform notes
  textarea at the bottom).

TASK 2 — ADD USER_PREFERENCES TABLE (or columns)
Create migration: supabase/migrations/2026MMDD_user_preferences.sql

Either: a new table `user_preferences` with one row per user (user_id PK +
unique, theme text default 'system', daily_reminder boolean default true,
regen_complete_notify boolean default true, weekly_summary boolean default
true). RLS policies matching the existing pattern.

OR: add the same columns to athlete_profile (since there's already one
row per user there). Slightly less clean separation but one less table.

Pick whichever feels right; document the choice in the migration comment.

TASK 3 — PERSIST PREFERENCES
File: app/profile/page.tsx (and the client component if any)

- Add server actions in app/actions.ts:
  · setTheme(theme: 'light' | 'dark' | 'system')
  · setUnitSystem(units: 'metric' | 'imperial')
  · setNotificationPreference(key: 'daily_reminder' | 'regen_complete' |
    'weekly_summary', value: boolean)
  Each calls requireUser() then updates the preference row (insert if
  missing via upsert).
- Wire the existing toggle/segmented controls on the Profile landing
  to these actions. Use useTransition for optimistic UI updates.
- Read the user's current preferences server-side and pass them to the
  Profile landing component as initial state.

TASK 4 — THEME PROVIDER
Install next-themes: npm install next-themes

- Wrap the root layout (app/layout.tsx) in <ThemeProvider attribute="class"
  defaultTheme="system" enableSystem>.
- The theme toggle on Profile calls setTheme(...) from next-themes' useTheme
  hook AND persists via the setTheme server action.
- On initial page load, read the persisted preference from the database
  and pass it as the defaultTheme to ThemeProvider — this avoids the
  flash-of-wrong-theme on first load for known users.
- Make sure globals.css already has the dark mode CSS variables (it
  does per the auth pages aesthetic) — confirm and adjust if needed.

TASK 5 — UNITS CONVERSION LAYER
Create lib/units.ts

- Pure functions:
  · formatDistance(km: number | string, units: UnitSystem): string
    — internal storage is always km (per PROJECT_BRIEF.md "Units handling")
    — returns "8.0 km" for metric, "5.0 mi" for imperial
    — accept string for the legacy weekly_volume text field that's mixed
  · formatElevation(m: number, units: UnitSystem): string
    — "+220 m" or "+722 ft"
  · formatWeight(kg: number, units: UnitSystem): string
    — "70 kg" or "154 lb"
  · formatPace(secPerKm: number, units: UnitSystem): string
    — "5:00 /km" or "8:03 /mi"
  · parseDistance(input: string, units: UnitSystem): number
    — for form inputs, converts back to km
- Apply throughout the display surfaces: Today screen workout cards,
  Plan tab week summaries, Profile athlete form, Race info edit form,
  Plan strip on bottom. Anywhere a distance / elevation / weight / pace
  is displayed.
- The user's units preference is read from athlete_profile.unit_system
  (already exists) — fetch it server-side and pass to client components
  that render data. Avoid prop-drilling by putting it on React context
  if the surface area gets big.

TASK 6 — EXPOSE logged_at FROM getPlan()
File: lib/supabase/server.ts

- The Today page currently passes loggedAtById: {} empty because getPlan()
  doesn't expose logged_at on workouts.
- Update getPlan() to include logged_at in the select clause and pipe it
  through the Day type into the returned plan.
- Update app/page.tsx to build the loggedAtById map from real data:
  `const loggedAtById = Object.fromEntries(plan.days.flatMap(d => d.workouts
   .filter(w => w.logged_at).map(w => [w.id, w.logged_at])))`
- Now the "DONE · 17:42" caption renders on completed workout cards.

TASK 7 — FIX IMPERIAL UNITS SUPPORT IN CLAUDE PROMPT
File: lib/claude.ts

- The SYSTEM_PROMPT currently says "Use metric units throughout (km for
  distance, min/km for pace)" — this conflicts with imperial users.
- Update the SYSTEM_PROMPT to say:
  "Use the unit system specified in the user prompt. Never hardcode metric
  or imperial — always honour what the user prompt requests."
- The user prompt already includes a "PLAN PARAMETERS" line with
  `Use ${args.profile.unit_system} units throughout: ${distUnit} for
  distance, ${paceUnit} for pace` — make sure this is the source of
  truth.
- Optional: add a defensive check after the tool returns workouts — if
  the profile is imperial but workout details contain "km" strings,
  flag a warning to the console (it'll inform iteration on the prompt).
- The formatRace and formatProfile functions in lib/claude.ts already
  conditionally use the right units — they're correct, no change needed.

CONSTRAINTS
- Don't put Supabase logic in components — extend lib/supabase/server.ts
- All new actions call requireUser() first
- Add zod schemas for all new action inputs
- Use the lib/brand.ts constant (assume it exists per the polish prompt;
  if not yet, hardcode "Vert" for now and the polish prompt will swap it)

VERIFICATION CHECKLIST
- Edit athlete profile: change weekly volume, fitness rating, body
  weight, training preferences. Save. Reload. Verify values persist.
- Toggle theme between Light, Dark, System on Profile. Verify the app
  re-renders with the new theme immediately and on next page load.
- Toggle Metric/Imperial on Profile. Verify Today screen distances,
  Plan tab volumes, and the wizard's race fields all show the new
  units. Internal database values remain metric.
- Toggle a notification preference. Verify it persists (will be acted
  on later when notifications are wired).
- Mark a workout done. Refresh Today. Verify "DONE · 17:42" caption
  shows on the card.
- Trigger a regen with profile.unit_system = 'imperial'. Verify
  Claude returns workouts with mi/ft, not km/m. If they come back
  metric, iterate on the prompt.
- npm run lint, npm run build, fix all errors.
```
