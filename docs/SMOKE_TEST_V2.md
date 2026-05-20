# V2 manual smoke test

Run through this checklist locally before each deploy and again on
production once the build promotes. Failures get logged in
`PROJECT_BRIEF.md` under "V2 finishing work".

## Test email addresses

**Don't** use Mailinator, 10minutemail, or other public throwaways —
anyone can read the confirmation link during the test window. Use one
of:

- Gmail `+tag` addressing (`your.address+vert-test1@gmail.com`,
  `+vert-test2@`, …)
- SimpleLogin or DuckDuckGo Email Protection aliases
- A second email account you control

Pick a consistent prefix (e.g. `+vert-test`) so the periodic cleanup
sweep can grep them all out of the Supabase Auth dashboard.

## Happy path

1. **Sign-up** with a new email. Confirm via the link Supabase sends.
2. **Land on `/wizard`.** Complete every step:
   - Welcome → Get started
   - A race (e.g. UTMB 2026)
   - Add at least one B race
   - Fitness baseline
   - Experience
   - About you
   - Health
   - Schedule
   - Equipment → "Generate my plan"
3. **Generating screen** appears, then **Today** loads with a plan.
4. **Log a workout done** from Today.
5. **Refresh Today.** Verify the "DONE · HH:MM" caption shows on the
   logged card.
6. **Tap REGEN** in the plan strip. Sheet opens with context rows.
7. Type a short note ("Push the volume this week").
8. Tap **Regenerate**. /regen loads with a diff.
9. Verify the **FROM YOUR COACH** card shows coach-voice copy that
   references your note.
10. Tap **Accept new plan.** "PLAN UPDATED" briefly, then back to Today
    with the new plan.
11. Open **Journal.** Verify any pre-regen entries now show "SEEN"
    instead of "PENDING".
12. **Navigate to Plan, Journal, Profile.** Every page renders.

## Profile edits

13. **Profile → Athlete profile.** Change weekly volume, save. Verify
    the value persists after navigating away + back.
14. **Profile → Race calendar.** Tap the A race → change priority to
    B → save. Verify the calendar reorders.
15. **Add a new B race.** Save. Verify it shows under the existing A.
16. **Delete a race** via the in-form Delete affordance. Confirm modal,
    then verify it's gone.

## Account & preferences

17. **Profile → Account → Change email.** Type a new address + current
    password. Verify the success message points you to both inboxes;
    verify the PENDING pill appears on the EMAIL row.
18. **Sign out of all devices.** Open a second browser, sign in there,
    then from the first browser trigger sign-out-everywhere. Refresh
    the second browser — should bounce to /sign-in.
19. **Disconnect Google for a Google-only user.** Verify the friendly
    error: "Set a password first — google is your only sign-in method."
20. **Toggle Units → Imperial.** Today + Plan + week drilldown all show
    `mi` / `ft`. Database values remain metric.
21. **Toggle Theme → Dark.** Whole app re-renders in dark mode
    immediately; reload to verify persistence.
22. **Toggle a notification preference.** No visible effect yet —
    notifications aren't wired — but the toggle state persists across
    reload.

## Race calendar past-race treatment

23. Edit one of your races and set its date to last week. Save.
24. Open the Race Calendar. Verify the past race shows as
    **COMPLETED** with strikethrough on the name.

## Two-user isolation

25. Open an incognito window. Sign up with a SECOND test address.
26. Complete the wizard for account 2.
27. Verify account 2 sees NO data from account 1 (workouts, journal,
    race, profile).
28. From account 1, trigger another regen + accept. Verify account 2 is
    unaffected.

## Cleanup

29. From account 2's Profile → Account → **Delete account.** Type the
    email to confirm. Account is wiped + signed out.
30. Try to sign in again with account 2's credentials — should fail.

---

## Known smoke-test caveats

- Each Playwright run (when we add it) creates a real user in whatever
  Supabase project `.env.local` points at. Until a separate staging
  project lands, these accumulate. Sweep periodically by grepping for
  the `+vert-test` prefix in the Supabase Auth dashboard.
- Sign-out-all-devices uses Supabase's global session revocation. There
  can be a 5–30 second delay before a stale session on a second browser
  notices. A hard refresh forces the check.
