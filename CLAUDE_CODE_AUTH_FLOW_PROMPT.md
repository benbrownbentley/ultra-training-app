# Auth-flow polish batch

Five items that block v2 public launch: forgot-password flow, password show/hide toggle, password strength rules, email collision across providers, and auto-login after email verification. Plus one cleanup (drift in the password min-length constant). Ship as a single batch on a new branch off `main`, then PR.

Decisions captured in the Cowork planning pass (2026-05-27, recorded in `PROJECT_BRIEF.md` → Auth-flow batch):
- **Password rules:** 8 chars + at least 1 letter + at least 1 number. Configure server-side in Supabase Auth Settings; mirror in `lib/auth-constants.ts`; surface 3 live checkmarks under the sign-up password field.
- **Email collision:** app-level pre-check via admin API before `signUp`. If the email exists, show "This email is already registered — sign in instead" with a link. Also enable **Allow manual linking** in Supabase Auth → Providers.
- **Reset UX:** two separate routes — `/forgot-password` (request the email) and `/reset-password` (handle the token-hash, set a new password).
- **Auto-login after email verify:** pass `emailRedirectTo` on `signUp` pointing to `/auth/callback?next=/`; extend the callback route to handle the email-confirmation `token_hash` flow; let `app/page.tsx`'s existing empty-state logic route new users to `/wizard`.

## Branch + workflow

- Branch off `main`: `auth-flow-polish`
- Suggested commit grouping (one per item is fine; or batch related ones):
  1. Password rules: Supabase config note + `lib/auth-constants.ts` raise + live checkmarks UI + fix the literal-`8` drift
  2. Password show/hide toggle
  3. `/forgot-password` + `/reset-password` routes + `resetPassword` action
  4. Email-collision pre-check + admin helper
  5. `emailRedirectTo` on signUp + extend `/auth/callback` for token_hash
- After all items land, run `npm run typecheck && npm test && npm run lint` and confirm clean before PR.
- Keep comments at the standard Vert bar: every non-trivial block gets a comment that says **why**, not just what. Match the voice of the surrounding code.

---

## Item 1 — Password rules: 8 chars + 1 letter + 1 number

**Files:**
- `lib/auth-constants.ts` (raise + extend)
- `components/auth/auth-split.tsx` (use the constant, add live checkmarks under password field on signup)
- `app/(auth)/actions.ts` (signUp validation)
- Supabase dashboard (server-side enforcement)

**Step 1 — Supabase Auth Settings (manual, document in PR description):**

In the Supabase dashboard → Authentication → Policies → Password requirements:
- Minimum length: **8**
- Require: at least one lowercase + uppercase + number (Supabase has presets — pick "Letters and digits" which maps to letter + number, no symbol requirement)

This is the server-side enforcement floor. The client-side checks below mirror it but never replace it.

**Step 2 — `lib/auth-constants.ts`:**

Current (`lib/auth-constants.ts:6`):
```ts
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_TOO_SHORT_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
```

Replace with:
```ts
// Shared auth constraints — referenced from both client-side form validation
// and server-side action checks so the two stay in sync. Server-side enforcement
// lives in Supabase Auth Settings; raise these constants in lockstep with the
// dashboard setting.

export const PASSWORD_MIN_LENGTH = 8;

// One letter (a-z or A-Z) and one digit (0-9). No symbol required — keeps the
// rules memorable while still catching the worst passwords ("12345678", "password").
export const PASSWORD_HAS_LETTER = /[A-Za-z]/;
export const PASSWORD_HAS_NUMBER = /\d/;

export interface PasswordCheck {
  ok: boolean;
  hasLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
}

export function checkPassword(pw: string): PasswordCheck {
  const hasLength = pw.length >= PASSWORD_MIN_LENGTH;
  const hasLetter = PASSWORD_HAS_LETTER.test(pw);
  const hasNumber = PASSWORD_HAS_NUMBER.test(pw);
  return {
    ok: hasLength && hasLetter && hasNumber,
    hasLength,
    hasLetter,
    hasNumber,
  };
}

export const PASSWORD_REQUIREMENTS_MESSAGE =
  `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include a letter and a number.`;

// Kept for backwards-compat with changePassword's pre-existing short-circuit.
// Prefer checkPassword() for new code.
export const PASSWORD_TOO_SHORT_MESSAGE =
  `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
```

**Step 3 — `app/(auth)/actions.ts` signUp validation:**

`signUp` currently does no client-input validation before hitting Supabase. Add the same `checkPassword` short-circuit that `changePassword` has (around `actions.ts:151`). Insert at the top of `signUp`:

```ts
const check = checkPassword(password);
if (!check.ok) {
  return { ok: false, error: PASSWORD_REQUIREMENTS_MESSAGE };
}
```

Server-side this is defence-in-depth — Supabase will reject too, but a clean error message beats Supabase's `AuthApiError: Password should be at least 8 characters`.

Also update `changePassword` (`actions.ts:147`) to use `checkPassword` for the same level of validation. Replace `if (newPassword.length < PASSWORD_MIN_LENGTH)` with the full check.

**Step 4 — `components/auth/auth-split.tsx` checkmarks under password field on signup:**

After the password `Input` block (`auth-split.tsx:207-217`), in the sign-up branch only, render a 3-row checkmark hint list:

```tsx
{isSignup && password.length > 0 && (
  <PasswordRequirements pw={password} />
)}
```

Define `PasswordRequirements` as an internal component in this file:

```tsx
function PasswordRequirements({ pw }: { pw: string }) {
  const check = checkPassword(pw);
  return (
    <ul
      aria-live="polite"
      className="mb-3 flex flex-col gap-1 font-mono text-[10.5px] uppercase tracking-[0.15em]"
    >
      <RequirementRow ok={check.hasLength} label={`${PASSWORD_MIN_LENGTH}+ characters`} />
      <RequirementRow ok={check.hasLetter} label="At least one letter" />
      <RequirementRow ok={check.hasNumber} label="At least one number" />
    </ul>
  );
}

function RequirementRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-zinc-500 dark:text-zinc-500">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Circle className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-700" />
      )}
      <span className={ok ? "text-emerald-700 dark:text-emerald-400" : ""}>
        {label}
      </span>
    </li>
  );
}
```

Import `CheckCircle2` and `Circle` from `lucide-react` alongside the existing `ArrowRight` + `MailCheck` imports.

Don't render the list until the user has typed at least one character — a list of red Xs on first focus is worse UX than just letting them start typing.

**Step 5 — Fix the literal-`8` drift in `auth-split.tsx:215`:**

Current:
```tsx
minLength={isSignup ? 8 : undefined}
```

Replace with:
```tsx
minLength={isSignup ? PASSWORD_MIN_LENGTH : undefined}
```

Import `PASSWORD_MIN_LENGTH` from `@/lib/auth-constants`.

**Acceptance:**
- Supabase Auth Settings shows min length 8 + letter/number requirement.
- Typing in the sign-up password field shows 3 checkmark rows; each turns emerald + filled when its rule is met.
- A 7-character password is rejected client-side with the friendly message before hitting Supabase.
- A 10-character all-letters password is rejected ("missing a number").
- Sign-in form is unchanged (no checkmark list, since we don't want existing users seeing rules they can't change in this flow).

---

## Item 2 — Password show/hide toggle

**File:** `components/auth/auth-split.tsx`

Add an eye/eye-off button inside the password input on both signin and signup. Sits at the right edge of the input, vertically centred, ~36px wide.

**Implementation:**

1. Add state at the top of `AuthSplit`:
   ```tsx
   const [showPassword, setShowPassword] = React.useState(false);
   ```

2. Wrap the existing password `<Input>` in a relative container, render the toggle button absolutely positioned inside. The `Input` component already supports custom right-padding via className — use `pr-11` to reserve space for the icon.

3. Toggle button:
   ```tsx
   <button
     type="button"
     onClick={() => setShowPassword((v) => !v)}
     aria-label={showPassword ? "Hide password" : "Show password"}
     className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100"
   >
     {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
   </button>
   ```

4. The `Input`'s `type` prop becomes `{showPassword ? "text" : "password"}`.

5. Import `Eye` and `EyeOff` from `lucide-react`.

**Voice / behaviour notes:**
- The toggle should be `type="button"` so it doesn't submit the form.
- `aria-label` toggles between "Show" and "Hide" so screen readers announce the state change.
- Toggle state is component-local — never persist it. Each time the page mounts, password is hidden.
- Same component, same behaviour on both signin and signup. The toggle has no relationship to the `confirmEmail` view — it's not rendered there.

**Acceptance:**
- Eye icon visible at the right edge of the password input on both `/sign-in` and `/sign-up`.
- Click toggles between password / text type.
- Click does not submit the form.
- Screen reader announces "Show password" → "Hide password" correctly.
- Mobile: the icon is tappable (full 36×36 hit area, not just the visual glyph).

---

## Item 3 — `/forgot-password` + `/reset-password` routes

Two new routes under `app/(auth)/`. Both reuse `AuthSplit`'s right-pane shell where possible — wrap them in the same `<div className="grid min-h-screen ...">` outer structure so the trail panel + form layout matches sign-in / sign-up exactly.

If `AuthSplit` is too coupled to the sign-in/sign-up branching to reuse cleanly, extract the layout shell (the outer grid + the left trail panel) into a new `AuthShell` component that both `AuthSplit` and the new pages compose. Keep `AuthSplit` doing its own thing; just lift the chrome.

### 3a — `/forgot-password` page

**Route:** `app/(auth)/forgot-password/page.tsx`

**UX:**
- Eyebrow: `— RESET ACCESS`
- Headline: "Forgot your password?"
- Subhead: "Enter your email and we'll send a reset link."
- One field: email
- Primary button: "Send reset link"
- Secondary link: "Back to sign in →"

**Success state** (after submit succeeds):
- Eyebrow: `— CHECK YOUR INBOX`
- Headline: "Reset link sent."
- Body: "We sent a reset link to **{email}**. Click it to set a new password."
- Link: "Back to sign in →"

This mirrors the `ConfirmEmailView` post-signup pattern (`auth-split.tsx:262-287`).

**Server action — add to `app/(auth)/actions.ts`:**

```ts
/**
 * Sends a password-reset email via Supabase. Returns `ok: true` even when the
 * email doesn't exist in our database — same response either way to prevent
 * email-enumeration via the reset form. Supabase silently no-ops on
 * non-existent emails by design, so the user just sees "check your inbox"
 * regardless.
 */
export async function requestPasswordReset({ email }: { email: string }): Promise<AuthResult> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) return { ok: false, error: "Could not determine request origin." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${proto}://${host}/reset-password`,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, status: "confirm_email", email };
}
```

Note: reuses the `confirm_email` status from `AuthResult` so the same "check your inbox" UI works without a new result type. If you want a dedicated `reset_sent` status, define it on the type union — your call. The `confirm_email` reuse is simpler.

### 3b — `/reset-password` page

**Route:** `app/(auth)/reset-password/page.tsx`

**Flow:**
1. User clicks the link in their email. Supabase redirects to `/reset-password?token_hash=...&type=recovery` (the link format depends on the email template — see Supabase docs; the default is `token_hash` + `type`).
2. The page component reads `token_hash` from search params and calls `supabase.auth.verifyOtp({ token_hash, type: "recovery" })` on mount (client-side, since it needs the session cookie to be written for the subsequent `updateUser` call).
3. On success, show a new-password form: two fields (new password + confirm), live checkmark rules under the first field (reuse `PasswordRequirements` from Item 1 — extract it to its own file if needed).
4. On submit, call `supabase.auth.updateUser({ password })`, then redirect to `/sign-in?reset=success` (or just `/` since the user is now signed in via the recovery session — check Supabase's behaviour and prefer `/` if it works).
5. On token verification failure (expired, malformed, already used), show "This link has expired or is invalid. Request a new reset link." with a back-link to `/forgot-password`.

**Structure of `reset-password/page.tsx`:**

```tsx
// Server component that just renders the client form — it needs to read the
// token_hash from search params and call client-side Supabase, so the heavy
// lifting lives in a "use client" child.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const params = await searchParams;
  return <ResetPasswordForm tokenHash={params.token_hash} type={params.type} />;
}
```

`ResetPasswordForm` is a client component (new file: `components/auth/reset-password-form.tsx`) that:
- On mount, if no `tokenHash`, renders the "invalid link" state.
- On mount, if `tokenHash` present, calls `verifyOtp` and tracks state: `"verifying" | "ready" | "invalid"`.
- In `"ready"` state, renders the new-password + confirm form with the password requirements list.
- On submit, calls `supabase.auth.updateUser({ password })` and redirects on success.

Use the browser-side Supabase client: `import { createClient } from "@/lib/supabase/client"`.

**Server action — add to `app/(auth)/actions.ts`:**

```ts
/**
 * Updates the password for the recovery-session user. Called from the
 * /reset-password page after the user enters a new password. Validates
 * server-side, just like signUp's check.
 */
export async function completePasswordReset({
  newPassword,
}: {
  newPassword: string;
}): Promise<AuthResult> {
  const check = checkPassword(newPassword);
  if (!check.ok) return { ok: false, error: PASSWORD_REQUIREMENTS_MESSAGE };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  redirect("/");
}
```

**Acceptance:**
- `/sign-in` → click "Forgot?" → routes to `/forgot-password` (no more `href="#"`).
- Enter email → submit → "Check your inbox" state.
- Receive email → click link → land on `/reset-password` → password form renders.
- Enter mismatched passwords → inline error "Passwords don't match."
- Enter weak password → checkmark rules show which ones are unmet.
- Enter valid new password → submit → land on `/` (signed in).
- Reuse the email link a second time → "This link has expired or is invalid."
- Direct-visit `/reset-password` with no token → "invalid link" state.

**Wire up the "Forgot?" link:**

In `auth-split.tsx:200`, change `href="#"` → `href="/forgot-password"`.

---

## Item 4 — Email-collision pre-check + Supabase manual linking

**Problem:** Currently if a user signs up with an email that already exists (via either method), Supabase returns `{ data: { user: ..., session: null }, error: null }` — looks like success, but no email is sent. User sees "check your inbox" forever. This is Supabase's anti-enumeration default behaviour.

**Fix has two parts: an app-level pre-check (so we can show a clear error) and a Supabase config change (so future identity-merging is possible).**

### 4a — Supabase dashboard change (manual, document in PR description)

In Supabase → Authentication → Providers → enable **"Allow manual linking"** (sometimes labelled "Manual identity linking").

This unlocks `supabase.auth.linkIdentity()` for future use (e.g., a user who signed up via Google later wants to add a password). We won't ship that UI in this batch, but the toggle has to be on or the flow is impossible later — and it has no downside today.

### 4b — App-level pre-check before `signUp`

**File:** `app/(auth)/actions.ts`

Add a helper that uses the admin client to look up the email:

```ts
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Returns true if a user already exists with this email, regardless of how
 * they originally signed up. Uses the service-role admin client so it can
 * see across all identities. Never expose this function or its result
 * directly to the client without rate-limiting consideration — it's an
 * email-enumeration oracle.
 */
async function userExistsByEmail(email: string): Promise<boolean> {
  // admin.listUsers() with a filter is the cleanest path. listUsers takes
  // pagination params but supports filtering by email via the query API.
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });
  if (error) return false; // Fail open — let signUp surface the real error.
  // listUsers doesn't accept an email filter directly; the result includes
  // all users, so we have to filter in-memory. For low user counts this is
  // fine; if user count grows past ~1000, switch to admin.getUserByEmail
  // (newer Supabase versions) or a dedicated profile lookup.
  return data.users.some((u) => u.email?.toLowerCase() === email.toLowerCase());
}
```

**Note on the listUsers approach:** at low user counts (early-launch, <100 users) this is fine. The cost is one API call per signup. **TODO comment in the code:** "Switch to `admin.getUserByEmail(email)` when we're on a Supabase version that supports it — see https://supabase.com/docs/reference/javascript/auth-admin-getuserbyemail (Supabase JS v2.43+)." Check the version in package.json and if `getUserByEmail` is available, prefer it.

**Update `signUp`:**

```ts
export async function signUp({ email, password }: Credentials): Promise<AuthResult> {
  const check = checkPassword(password);
  if (!check.ok) return { ok: false, error: PASSWORD_REQUIREMENTS_MESSAGE };

  // App-level email collision check. Supabase's default behaviour is to
  // return "success" with session=null when the email already exists, which
  // would silently leave the user on the "check your inbox" screen forever.
  // Surface the real state so they can sign in (or reset password) instead.
  if (await userExistsByEmail(email)) {
    return {
      ok: false,
      error: "This email is already registered. Sign in instead, or reset your password.",
    };
  }

  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) return { ok: false, error: "Could not determine request origin." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // See Item 5 — this routes the email-confirmation link back through
      // our callback so the user is signed in automatically.
      emailRedirectTo: `${proto}://${host}/auth/callback?next=/`,
    },
  });

  if (error) return { ok: false, error: error.message };
  if (data.session) redirect("/");
  return { ok: true, status: "confirm_email", email };
}
```

**Acceptance:**
- Sign up with a new email → "check your inbox" state.
- Sign up with an email that's already registered via email/password → error: "This email is already registered. Sign in instead, or reset your password."
- Sign up with an email that's already registered via Google → same error.
- Supabase Auth → Providers → "Allow manual linking" toggle is on.

**Edge case to handle:** If `userExistsByEmail` returns true but the user actually wanted to sign in, they currently have to click "Sign in" link manually. Future polish: include "Sign in" and "Reset password" buttons inline in the error message. Not in this batch.

---

## Item 5 — Auto-login after Supabase email verification

**Problem:** Today, `signUp` doesn't pass `emailRedirectTo`, so Supabase uses the project's Site URL setting. That URL is currently the prod Vercel URL, so:
- Signing up from localhost dev → email link goes to prod, user is confused.
- Even on prod, the link goes to `/` but the session isn't established until the user enters credentials again. There's no auto-login.

**Fix has two parts: pass `emailRedirectTo` (covered in Item 4's `signUp` rewrite above), and extend `/auth/callback` to handle the email-confirmation token-hash flow.**

### 5a — `emailRedirectTo` on signUp

Already specified in Item 4's `signUp` rewrite. The URL is `${origin}/auth/callback?next=/`.

The `?next=/` query param tells the callback where to send the user *after* exchanging the token. Today, the callback always sends to `/`. We're going to make it respect `next` so it can be reused for future flows (e.g., post-reset, post-OAuth with a deep-link). For this batch, `next=/` is the only value we'll use.

### 5b — Extend `/auth/callback` to handle `token_hash`

**File:** `app/auth/callback/route.ts`

Current code (lines 13-29) only handles the OAuth `?code=` parameter. Email-confirmation links use `?token_hash=` + `?type=signup` (or `type=email_change`, etc.).

**Replace the route with:**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback. Handles two distinct Supabase flows that funnel through
 * the same URL:
 *
 *   1. OAuth (Google) — Supabase redirects with `?code=`. Exchange for
 *      a session via exchangeCodeForSession.
 *   2. Email confirmation (signup verification, email change, etc.) —
 *      Supabase redirects with `?token_hash=` + `?type=`. Exchange via
 *      verifyOtp.
 *
 * On any failure path we bounce to /sign-in with an error marker so the
 * UI can surface it instead of silently looping.
 *
 * The `?next=` param controls where the user lands after a successful
 * exchange. Defaults to "/" if absent. Validate it's a same-origin path
 * before redirecting to avoid open-redirect abuse.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = sanitiseNext(searchParams.get("next")) ?? "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (tokenHash && type) {
    // type is one of "signup" | "email_change" | "recovery" | "invite" | "magiclink"
    // We let Supabase validate it — passing through whatever's in the URL.
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "email_change" | "recovery" | "invite" | "magiclink",
    });
    if (error) {
      return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
}

/**
 * Allow only same-origin relative paths in `next`. Prevents an attacker
 * from crafting an email link that bounces an authenticated user to
 * another site (open redirect / phishing setup).
 */
function sanitiseNext(value: string | null): string | null {
  if (!value) return null;
  // Must start with / and must NOT start with // (which would be protocol-relative).
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
```

**Acceptance:**
- New signup (localhost dev): submit signup → "check your inbox" state → click email link → land on `/` signed in → `app/page.tsx`'s existing empty-state logic routes to `/wizard`.
- New signup (prod): same as above, on the prod domain.
- Google OAuth still works (the `?code=` path).
- Manually visit `/auth/callback?next=https://evil.com` → bounced to `/sign-in?error=auth_failed` (open-redirect protection).
- Manually visit `/auth/callback?next=//evil.com` → same protection.
- Manually visit `/auth/callback?next=/wizard` → after exchange, lands on `/wizard` (the `next` param works as intended).

### 5c — Supabase email template (manual config, document in PR description)

In Supabase → Authentication → Email Templates → Confirm signup, the default template uses a `{{ .ConfirmationURL }}` variable. That URL is built from `Site URL` + path. To make this work cleanly, the `Site URL` setting in Supabase → Authentication → URL Configuration needs to be the deployment's base URL:
- Prod Supabase project: `https://app.benbrownbentley.com`
- (Future) Staging Supabase project: `http://localhost:3000` or the Vercel preview URL

For now, leave Site URL as the prod URL — once staging is set up (Phase 4 hygiene), this gets revisited. Note in the PR that this is the staging-environment dependency.

In the template body, the link should hit `{{ .ConfirmationURL }}` which Supabase generates as `https://<site-url>/auth/confirm?token_hash=...&type=signup` by default. Since we're using `emailRedirectTo` on signUp, Supabase will instead use that URL — so the email link goes to `/auth/callback?next=/&token_hash=...&type=signup`. Verify in the dashboard that the template still works (you may need to update the template's link to `{{ .ConfirmationURL }}` if it's been customised).

---

## Cleanup: stale `8` in auth-split.tsx

Covered in Item 1 step 5. Bundled here for visibility — search the codebase for any other `8` literal related to password length and replace with the constant.

```bash
grep -rn "minLength.*8" app/ components/ lib/
```

---

## Verification checklist (run after all 5 items merged)

- [ ] `npm run typecheck` clean
- [ ] `npm test` 118/118 pass (or whatever the current baseline is — check `npm test` output on `main` before starting)
- [ ] `npm run lint` clean
- [ ] Manual smoke test on localhost:
  - [ ] Sign-up with valid new email + valid password → email arrives → click link → land on `/wizard`
  - [ ] Sign-up with weak password → checkmark rules show the failing rule(s) → submit blocked
  - [ ] Sign-up with already-registered email → friendly error
  - [ ] Sign-up with already-Google-registered email → same friendly error
  - [ ] Forgot password → enter email → "check your inbox" → click link → reset form → submit → land signed in
  - [ ] Forgot password with non-existent email → "check your inbox" (no enumeration leak)
  - [ ] Re-use a reset link a second time → "invalid link" state
  - [ ] Show/hide eye toggle works on sign-in and sign-up; doesn't submit form; persists locally during typing only
- [ ] Production deploy after smoke passes
- [ ] Repeat smoke test on prod (single-account)

## Tech-debt updates

- Close **TD-007** (Password reset flow) — link to the PR.
- Add a follow-up note to **TD-009** if `STRENGTH_FREQ_OPTS` consolidation is still open; the new constants module pattern in `lib/auth-constants.ts` is the same shape.

## PROJECT_BRIEF.md updates

After this batch ships:
- Mark the four "Phase 3 Smoke-test findings (2026-05-21)" auth items as ✅ Closed by `<batch-commits>`.
- Add a "Phase 3 auth-flow batch (2026-05-27)" subsection summarising the decisions captured here.
- Update the **Pre-v2 hygiene** section to flag the staging-environment dependency mentioned in Item 5c.

---

## Out of scope (deferred)

- Adding the "Add a password to your Google account" / "Add Google to your password account" UX. Requires the manual-linking toggle (Item 4a) plus a Profile-page flow — separate batch.
- Magic-link signin. Supabase supports it; we just don't surface it. Decision: not in this batch.
- 2FA / passkeys. Future feature, not v2-launch-critical.
- Rate limiting on signup / forgot-password. Supabase has some built-in protection; if abuse becomes a problem post-launch, layer Vercel KV-based rate limiting.
- A "Resend confirmation email" CTA on the `ConfirmEmailView`. Currently the user can only restart signup. Polish item for a later batch.
