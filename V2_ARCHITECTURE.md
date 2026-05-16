# V2 Architecture — Auth & Multi-User

_Decided: 2026-05-16_

This document is the authoritative plan for v2. Claude Code should read this before writing
any auth-related code. Every decision here was made deliberately — don't deviate without
checking with Ben first.

---

## What v2 adds

- Email/password sign-up and login
- Google OAuth login
- Every user gets their own private race, athlete profile, and training plan
- v1 data is wiped on launch (no migration of existing data needed)

---

## Auth provider

**Supabase Auth** — already included in the project, no new services needed.

Two methods to enable in the Supabase dashboard:
1. Email/password (enable "Email provider" in Authentication → Providers)
2. Google OAuth (enable "Google provider", add Client ID + Secret from Google Cloud Console)

No new environment variables are needed in the app — Google OAuth credentials are configured
in the Supabase dashboard only.

---

## Data model changes

Every table gets a `user_id` column that ties each row to a specific Supabase Auth user.
This is the foundation of all multi-user data isolation.

### Schema changes (new migration file)

```sql
-- v2: add user_id to all tables and lock down RLS

-- 1. Add user_id to race
alter table race
  add column user_id uuid not null references auth.users(id) on delete cascade;

-- 2. Add user_id to athlete_profile
alter table athlete_profile
  add column user_id uuid not null references auth.users(id) on delete cascade;

-- 3. Add user_id to workouts
alter table workouts
  add column user_id uuid not null references auth.users(id) on delete cascade;

-- 4. Add indexes for user_id lookups (important for performance at scale)
create index race_user_id_idx on race (user_id);
create index athlete_profile_user_id_idx on athlete_profile (user_id);
create index workouts_user_id_idx on workouts (user_id);

-- 5. Drop the v1 "public read" policies
drop policy if exists "Public read race" on race;
drop policy if exists "Public read workouts" on workouts;
drop policy if exists "Public read athlete_profile" on athlete_profile;

-- 6. Replace with user-scoped policies (authenticated users can only see/edit their own data)
create policy "Users read own race" on race
  for select using (auth.uid() = user_id);
create policy "Users insert own race" on race
  for insert with check (auth.uid() = user_id);
create policy "Users update own race" on race
  for update using (auth.uid() = user_id);
create policy "Users delete own race" on race
  for delete using (auth.uid() = user_id);

create policy "Users read own athlete_profile" on athlete_profile
  for select using (auth.uid() = user_id);
create policy "Users insert own athlete_profile" on athlete_profile
  for insert with check (auth.uid() = user_id);
create policy "Users update own athlete_profile" on athlete_profile
  for update using (auth.uid() = user_id);
create policy "Users delete own athlete_profile" on athlete_profile
  for delete using (auth.uid() = user_id);

create policy "Users read own workouts" on workouts
  for select using (auth.uid() = user_id);
create policy "Users insert own workouts" on workouts
  for insert with check (auth.uid() = user_id);
create policy "Users update own workouts" on workouts
  for update using (auth.uid() = user_id);
create policy "Users delete own workouts" on workouts
  for delete using (auth.uid() = user_id);
```

**Important:** Since we're wiping v1 data, the migration does not need to backfill existing
rows with a user_id — a clean deploy handles this automatically.

---

## Supabase client migration

The current `lib/supabase.ts` uses the base `@supabase/supabase-js` client, which does not
handle auth session cookies. For v2, we need two clients from `@supabase/ssr`.

**Delete:** `lib/supabase.ts` and `lib/supabase-admin.ts`

**Replace with:**

```
lib/
  supabase/
    client.ts       ← browser client (use in "use client" components)
    server.ts       ← server client (use in Server Components, Server Actions, Route Handlers)
    admin.ts        ← service-role client (plan generation only — bypasses RLS)
```

### `lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'

// Use this in Client Components ("use client" files) that need Supabase.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

### `lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Use this in Server Components, Server Actions, and Route Handlers.
// Reads and writes session cookies automatically.
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component context — cookie mutations handled by middleware
          }
        },
      },
    }
  )
}
```

### `lib/supabase/admin.ts`

```typescript
import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS. Use only for server-side plan generation
// where we need to write workouts on behalf of the user. Never expose to client.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)
```

---

## Middleware (required for auth)

Create `middleware.ts` at the project root. This runs on every request and refreshes the
user's session token. Without it, users get silently logged out.

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes session — do not remove
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users away from protected routes
  const isAuthRoute = request.nextUrl.pathname.startsWith('/sign-in') ||
    request.nextUrl.pathname.startsWith('/sign-up') ||
    request.nextUrl.pathname.startsWith('/auth')

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  // Redirect authenticated users away from sign-in/sign-up
  if (user && isAuthRoute && !request.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

---

## New routes

| Route | Purpose |
|-------|---------|
| `/sign-in` | Login page — email/password form + "Continue with Google" button |
| `/sign-up` | Sign-up page — email/password form + "Continue with Google" button |
| `/auth/callback` | OAuth callback handler — exchanges code for session, redirects to `/` |

### `/app/auth/callback/route.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Handles the redirect back from Google OAuth.
// Supabase sends a `code` param — we exchange it for a session.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}/`)
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`)
}
```

---

## Server action changes

All server actions must:
1. Get the current user from the server Supabase client
2. Throw if no user is found (never trust that middleware caught everything)
3. Scope all DB queries with `.eq('user_id', user.id)`
4. Pass `user_id` on all inserts

### Pattern to follow

```typescript
// At the top of every server action that touches the DB:
const supabase = await createClient() // from lib/supabase/server.ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) throw new Error('Not authenticated')

// All queries then include:
.eq('user_id', user.id)   // on reads and updates
// and inserts include:
{ ...data, user_id: user.id }
```

### Which actions use admin vs. server client

| Action | Client to use | Reason |
|--------|---------------|--------|
| `logWorkout` | server client | user updates their own row — RLS handles it |
| `regeneratePlan` | admin client for writes | plan generation deletes + inserts many rows; admin avoids per-row RLS overhead |
| `submitWizard` | admin client for writes | same as above |
| All reads (`getPlan`, `getAthleteProfile`) | server client | RLS scopes to user automatically |

Even when using the admin client for writes, always get the user from the server client first
and pass `user_id` explicitly on every insert. Never assume the admin client is the safety net.

---

## New package to install

```bash
npm install @supabase/ssr
```

The existing `@supabase/supabase-js` stays — the admin client still uses it directly.

---

## Build order for v2

Follow this order exactly. Each step should deploy and work before starting the next.

1. **Install `@supabase/ssr`** and migrate the Supabase clients (`lib/supabase/` directory)
2. **Add `middleware.ts`** — test that unauthenticated users are redirected to `/sign-in`
3. **Run the data model migration** in Supabase (add `user_id`, update RLS policies)
4. **Build `/sign-in` and `/sign-up` pages** with email/password forms
5. **Add `/auth/callback` route** for OAuth
6. **Enable Google OAuth** in Supabase dashboard (Ben does this manually)
7. **Update all server actions** to get user and scope queries
8. **Update all read helpers** in `lib/supabase/server.ts` to scope by `user_id`
9. **End-to-end test on staging:** sign up → wizard → plan generated → log workout → regenerate

---

## What does NOT change in v2

- The Claude plan generation logic in `lib/claude.ts` — unchanged
- The wizard UI and form fields — unchanged
- The workout logging UI — unchanged
- The home page layout — unchanged (just needs auth-aware data fetching)
- The DB schema structure (columns, types) — only `user_id` is added
