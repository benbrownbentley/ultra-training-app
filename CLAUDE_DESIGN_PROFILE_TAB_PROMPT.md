# Claude Design prompt — Vert Profile tab + sub-routes

Paste this prompt into Claude Design. The previous chat may have been long —
if you're starting a new Claude Design chat, see the "Starting from a fresh
chat" note at the bottom and attach reference screenshots from earlier
passes.

---

```
Design the Profile tab for Vert plus its sub-routes.

PURPOSE
The fourth tab in the bottom nav. Home for account info, athlete profile,
race info, preferences, data, and account management. iOS-Settings-style
menu pattern: grouped sections + sub-routes for substantive content +
inline toggles for short preferences.

LAYOUT
Mobile-first. Mobile (~390px wide) AND desktop (centered, max ~720px).
Full dark mode AND light mode. Same visual language as all previous
screens — emerald-500 primary, Geist Sans + Geist Mono, em-dash mono
section labels with tracking-[0.2em].

PROFILE TAB LANDING

Anatomy (top to bottom):
1. Header bar — no back link (tab destination); settings cog can be
   omitted on this tab (the Profile tab IS settings, essentially)
2. Section label: "— PROFILE"
3. Five grouped sections, each with em-dash mono group header,
   separated by subtle dividers:

   GROUP 1: "— YOUR TRAINING"
   - "Athlete profile" — row with right-chevron, routes to /profile/athlete
   - "Race info" — row with right-chevron, routes to /profile/race
   - "Edit setup" — row with right-chevron, opens /wizard pre-filled

   GROUP 2: "— REFERENCE"
   - "Workout glossary" — row with right-chevron, routes to /profile/glossary
     (the glossary itself will be designed in a separate pass; show it as
     a row here)

   GROUP 3: "— PREFERENCES"
   - Inline toggle/segmented controls, no sub-routes:
     · "Units" — segmented control: [Km] [Mi]
     · "Theme" — segmented control: [Light] [Dark] [System]
     · "Daily workout reminder" — toggle on/off
     · "Regeneration complete" — toggle on/off
     · "Weekly summary" — toggle on/off

   GROUP 4: "— ACCOUNT"
   - "Email & password" — row with right-chevron, routes to /profile/account
   - "Sign out" — inline action; shows confirmation sheet before signing out

   GROUP 5: "— DATA"
   - "Export as CSV" — inline action button
   - "Export as JSON" — inline action button
   - "Delete account" — dim destructive link at the bottom of the
     section (red-ish but understated), opens delete confirmation modal

4. Bottom tab bar (Profile active)

Row format for menu items (rows that route to sub-pages):
- Tappable full-width
- Left side: label in Geist Sans body
- Right side: small chevron icon (Tabler ti-chevron-right) in dim color
- 0.5px divider between rows within a group

Toggle row format (for preferences):
- Tappable full-width
- Left side: label in Geist Sans body
- Right side: toggle switch or segmented control
- Same divider treatment

ATHLETE PROFILE SUB-ROUTE (/profile/athlete)

Anatomy:
- Back link top-left: "← Profile"
- Section label: "— ATHLETE PROFILE"
- Title: "Your training context"
- Form fields, grouped:

  "— FITNESS BASELINE"
  - Current fitness self-rating (1-5 scale with descriptions:
    "Just starting out" → "Highly trained / racing competitively")
  - Weekly mileage (number input, with unit per user pref)
  - Years of running (number input)
  - Years of ultra running (number input)

  "— EXPERIENCE"
  - Previous endurance experience — multi-select chips:
    First ultra · Multiple ultras · Marathon experience · Triathlon ·
    Other endurance
  - Longest race completed — freeform text or distance picker

  "— INJURY HISTORY"
  - Free-text textarea for past injuries
  - Note: "Current injuries are tracked in Journal — see your active
    injury reports there." (small dim text linking to Journal)

  "— EQUIPMENT & ACCESS"
  - Gym access — toggle yes/no
  - Equipment chips multi-select: Treadmill · Indoor trainer · Weights ·
    Pool · Trails nearby · Hills nearby

  "— CROSS-TRAINING PREFERENCES"
  - Multi-select chips: Cycling · Swimming · Hiking · None

  "— TRAINING PREFERENCES" (this is the v1 home for "prefer X to Y" thoughts)
  - Freeform textarea
  - Placeholder: "Anything Claude should consider about how you like to
    train? e.g., 'I prefer split squats to walking lunges', 'I hate
    treadmill runs', 'Long runs always on Saturday morning'."
  - Small note below: "In a future update, this will become a structured
    list of swap rules. For now, freeform notes work fine."

- Action bar (sticky bottom on mobile):
  · "Cancel" link (left)
  · "Save changes" emerald CTA (right)
- Saving routes back to Profile landing with a confirmation toast

RACE INFO SUB-ROUTE (/profile/race)

Anatomy:
- Back link top-left: "← Profile"
- Section label: "— RACE INFO"
- Title: "Your target race"
- Form fields:

  "— RACE DETAILS"
  - Race name (text input)
  - Race date (date picker)
  - Distance (number input + unit selector km/mi)
  - Elevation gain (number input + unit m/ft)
  - Terrain (chip multi-select: trail, road, mountain, technical, mixed)
  - Course profile (optional: link to race website or notes)

  "— RACE GOAL"
  - Target finish time (time input, optional — courses vary too much to be precise)
  - Effort intent — segmented control: [Competitive] [Finish strong] [Just finish]

- Action bar:
  · "Cancel"
  · "Save changes" emerald CTA

- Below the form, a "Countdown" display in mono:
  "12 weeks · 84 days · until UTMB 2026"
  (Shown only when race is in the future)

ACCOUNT SUB-ROUTE (/profile/account)

Anatomy:
- Back link top-left: "← Profile"
- Section label: "— ACCOUNT"
- Title: "Email & password"
- Form sections:

  "— EMAIL"
  - Current email displayed (e.g., "ben@trail.run")
  - "Change email" link → opens an inline form with new email + current
    password fields

  "— PASSWORD"
  - "Change password" link → opens an inline form with current password +
    new password + confirm new password fields

  "— CONNECTED ACCOUNTS"
  - Lists OAuth providers connected (e.g., Google) with "Disconnect" links
  - "Connect Google" if not connected

  "— SECURITY"
  - "Recent sign-ins" — a small list of recent session activity (device,
    location, date) — optional v1
  - "Sign out of all devices" link (action with confirmation)

- Action bar: minimal — most changes happen inline within their sections

DELETE-ACCOUNT CONFIRMATION (modal/sheet)

When user taps "Delete account" on Profile landing:
- Modal opens (centered on desktop, bottom sheet on mobile)
- Title: "— DELETE ACCOUNT"
- Body: "This will permanently delete your account, all your training
  data, and your Journal entries. This action can't be undone."
- Friction step: "Type your email to confirm:" with a text input that
  must exactly match the account email
- Two actions: "Cancel" link (left) and "Permanently delete" (destructive
  red button, only enabled when the typed email matches)

STATES TO DESIGN

PROFILE TAB LANDING:
A. Default state (all sections visible, current values in toggles)

ATHLETE PROFILE SUB-ROUTE:
B. Default state (form pre-filled with existing user values)

RACE INFO SUB-ROUTE:
C. Default state (form pre-filled with existing race values)

ACCOUNT SUB-ROUTE:
D. Default state (email shown, password fields collapsed)

DELETE CONFIRMATION:
E. Modal/sheet open with email-confirmation requirement

CONTENT TO USE

For State A (Profile landing) — show:
- Athlete profile, Race info, Edit setup as enabled rows
- Workout glossary as enabled row
- Units: Km selected · Theme: System selected · all 3 notification
  toggles ON by default
- Email & password: ben.bentley@createmusicgroup.com (or any
  realistic placeholder)
- Sign out, Export as CSV, Export as JSON, Delete account

For State B (Athlete profile) — populated with:
- Fitness baseline 4/5, 65 km/week, 12 years running, 5 years ultras
- Previous experience: Multiple ultras + Marathon experience selected
- Longest race: "Cascade Crest 100"
- Injury history: "Right achilles tendinopathy 2024, recovered with PT.
  Occasional left ITB tightness."
- Equipment: Gym access ON, with Weights + Pool + Trails nearby selected
- Cross-training: Cycling + Hiking selected
- Training preferences: "Long runs on Saturday morning. I prefer split
  squats to walking lunges. Avoid treadmill if possible."

For State C (Race info) — populated with:
- Race name: UTMB
- Race date: 26 Aug 2026
- Distance: 171.5 km
- Elevation: +10,040 m
- Terrain: Trail + Mountain + Technical
- Target finish time: 35:00 hours
- Effort intent: Finish strong
- Countdown: "14 weeks · 101 days · until UTMB 2026"

For State D (Account) — Email: ben@trail.run

DESIGN NOTES

- The Profile tab landing should feel scannable like iOS Settings —
  generous row heights, clear group separation, easy thumb reach
- Section dividers between groups are slightly more prominent than row
  dividers within a group
- Toggles use a consistent visual (segmented controls for multi-option,
  binary toggles for on/off)
- All form sub-routes use the same form pattern: grouped fields with
  em-dash mono group headers, sticky-bottom save action on mobile
- The destructive "Delete account" button uses an actual red (not the
  emerald destructive token) since the action is irreversible
- Sign out confirmation should be lighter friction than delete — just a
  yes/no, no email-typing requirement
- All numerals Geist Mono, tabular
- Em-dash mono section labels everywhere with tracking-[0.2em]
- Dark mode required for every state

DELIVERABLE

5 states × mobile + desktop × light + dark = 20 frames base.

States A–D: 4 frames each (mobile + desktop × light + dark) = 16 frames
State E (delete confirmation): 2 frames (mobile only, light + dark)

Total: 18 frames.

Note: workout glossary route (/profile/glossary) is deferred to a
separate design pass. Show it as a row on the Profile landing here,
but don't design the glossary screen itself in this pass.
```

---

## Starting from a fresh chat?

If you're starting a new Claude Design chat (context window concerns), do these
three things before pasting the prompt:

1. Confirm the design system is set up (same codebase + brand notes).
2. Attach reference screenshots from earlier passes — at minimum:
   - The Today screen (shows tab bar, plan strip, card pattern)
   - The Journal tab (shows the section/group + entry-row pattern)
   - The Regenerate sheet (shows sheet/modal styling)
3. Paste this preamble at the top of the prompt:

> This continues a multi-screen design pass for an app called Vert. The visual
> language is established in the codebase and in the attached reference
> screenshots. Match those exactly:
>
> - Emerald-500 primary, Geist Sans (body) + Geist Mono (labels, data,
>   microcopy), em-dash mono section labels with tracking-[0.2em], full
>   dark mode support
> - Bottom tab bar (TODAY / PLAN / JOURNAL / PROFILE) visible on every
>   tab destination
> - Form patterns from the Journal injury route (em-dash mono group
>   headers, sticky-bottom save actions on mobile)
> - The Profile tab is the fourth tab in the bottom nav

## What to look for in the result

- Profile landing scans like iOS Settings — clean rows, clear groups
- Group headers in em-dash mono make organization obvious
- Toggles and segmented controls are visually consistent and obvious
- Sub-route forms feel like an extension of the Journal forms (same patterns)
- Delete confirmation has real friction (email typing) — it's irreversible
- Sign-out confirmation is lighter friction
- Dark mode shows all controls and toggles in legible contrast

## Next after this

1. **Workout-type glossary** (`/profile/glossary`) — separate small pass
2. **Wizard polish** — bring the existing intake wizard into the new design system
3. **Landing / marketing page** — for v2 public launch
