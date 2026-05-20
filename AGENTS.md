# AGENTS.md — Vert

This file is the single source of truth for any coding agent working in this repository.
Read it fully before writing a single line of code.

---

## What this app is

An adaptive ultra marathon training planner. The user enters a race goal and fitness baseline,
Claude generates a personalised training plan (daily gym + running), the user logs workouts,
and the plan regenerates based on accumulated data.

- **v1:** Single user (Ben), no auth, MVP features
- **v2:** Multi-user with Supabase auth and private plans per user
- **v3:** Mobile PWA, offline support, push notifications

Full product context lives in `PROJECT_BRIEF.md`. Read it when you need to understand scope,
build order, or what is explicitly out of scope.

---

## Tech stack

| Layer        | Choice                         | Version       |
|--------------|--------------------------------|---------------|
| Framework    | Next.js (App Router)           | 16.2.6        |
| Language     | TypeScript                     | ^5            |
| Styling      | Tailwind CSS                   | ^4            |
| Components   | shadcn/ui                      | latest        |
| Database     | Supabase (Postgres)            | —             |
| Auth         | Supabase Auth (v2+)            | —             |
| LLM          | Anthropic Claude API           | latest SDK    |
| Hosting      | Vercel (auto-deploy from GitHub) | —           |
| React        | React 19                       | 19.2.4        |

---

## Folder structure

### Current actual structure (as of 2026-05-16)

```
app/                         # Next.js App Router
  _components/               # Page-level components (underscore prefix = not a route)
    RegeneratePlanButton.tsx  # "Regenerate plan" button — calls regeneratePlan() server action
    WorkoutLogButtons.tsx     # Done / Skip buttons — calls logWorkout() server action
  actions.ts                 # Server Actions: logWorkout(), regeneratePlan()
  globals.css                # Global styles + Tailwind base
  layout.tsx                 # Root layout
  page.tsx                   # Home page (/) — shows today's workouts + weekly strip

lib/
  claude.ts                  # Anthropic SDK client + generateTrainingPlan() + all prompt logic
  plan.ts                    # Shared TypeScript types: Workout, Day, Race, Plan
  supabase.ts                # Supabase client + getPlan() read helper (uses publishable key)
  supabase-admin.ts          # Supabase service-role client for server-side writes

supabase/
  schema.sql                 # Full schema — re-running drops and recreates all tables
  migrations/
    001_workout_logging.sql  # Adds status + logged_at columns to workouts table
```

**IMPORTANT — shadcn/ui is NOT yet installed.** `components/ui/` does not exist.
Run `npx shadcn@latest init` before adding any shadcn components.

### Target structure as features are added

Follow these conventions when adding new routes and components:

```
app/
  _components/               # Components scoped to the home page only
  wizard/                    # Intake wizard route (/wizard)
    page.tsx
    _components/
  workout/
    [id]/                    # Workout drill-down (/workout/123)
      page.tsx

components/                  # Shared components used across multiple pages
  ui/                        # shadcn/ui primitives (auto-generated — do not hand-edit)
  training/                  # Training-domain shared components

lib/
  supabase.ts                # Read helpers (getPlan, getAthleteProfile, etc.)
  supabase-admin.ts          # Write helpers — server-side only
  claude.ts                  # All Anthropic SDK usage
  plan.ts                    # Types and pure business logic (no DB or API calls)
  utils.ts                   # General utilities: cn(), date helpers, formatters
```

---

## Next.js App Router — rules and patterns

This project uses the **App Router** (the `app/` directory), not the older Pages Router.
These are fundamentally different — do not mix patterns.

### Server Components vs Client Components

- **Default is Server Component.** Every file in `app/` is a Server Component unless marked otherwise.
- Add `"use client"` at the top of a file only when you need browser APIs, event handlers, or React hooks (`useState`, `useEffect`, etc.).
- Keep `"use client"` components as small and leaf-level as possible — push state down, keep data fetching up in Server Components.
- **Never** fetch data in a Client Component when a Server Component can do it instead.

### Data fetching

- Fetch data directly in Server Components using `async/await` — no `useEffect` + `fetch` pattern.
- Use React's `cache()` for deduplicating expensive server-side fetches within a single request.
- Route Handlers (`route.ts`) replace the old `pages/api/` pattern. Use them for API endpoints.
- GET Route Handlers are **not cached by default** in Next.js 15+. Add explicit caching headers or use `revalidate` exports when you want caching.

### Routing conventions

| File              | Purpose                                      |
|-------------------|----------------------------------------------|
| `page.tsx`        | Renders a route — makes the URL accessible   |
| `layout.tsx`      | Wraps child pages — persists across navigation |
| `loading.tsx`     | Skeleton/spinner shown while page loads      |
| `error.tsx`       | Error boundary for this route segment        |
| `route.ts`        | API Route Handler (GET, POST, etc.)          |
| `(folder)/`       | Route group — organises files, not in URL    |
| `[param]/`        | Dynamic route segment                        |

### Server Actions

- Use Server Actions (functions with `"use server"`) for form submissions and mutations.
- Place them in dedicated `actions/` files or inline in Server Components — not in Client Components.
- Always validate inputs server-side; never trust client data.

---

## Supabase — rules and patterns

### Two clients — use the right one

**Never use the browser client on the server or vice versa.**

```typescript
// lib/supabase/client.ts — use this in Client Components ("use client" files)
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// lib/supabase/server.ts — use this in Server Components, Route Handlers, Server Actions
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* Server Component — mutations handled by middleware */ }
        },
      },
    }
  )
}
```

### Middleware (required for auth)

Auth session refresh must happen in `middleware.ts` at the project root.
Server Components cannot set cookies, so middleware handles token refresh on every request.

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  await supabase.auth.getUser() // refreshes session
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### API keys

Use the new-style keys when available:
- `NEXT_PUBLIC_SUPABASE_URL` — always public
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — publishable key (safe for browser)
- `SUPABASE_SERVICE_ROLE_KEY` — **secret, server-only, never expose to client**

### Database conventions

- All tables use snake_case column names (Postgres convention)
- Always use Row Level Security (RLS) — never rely solely on application-level checks
- Foreign keys and indexes should be explicit in migration files

---

## shadcn/ui — rules and patterns

### Installation

shadcn/ui components are added individually, not as a full package install.

```bash
# Install a component
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add form
```

Components are generated into `components/ui/` — treat these as primitives,
**do not hand-edit them**. Customise via Tailwind classes at the usage site.

### Usage pattern

```typescript
// Import from the generated component path
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent } from "@/components/ui/card"

// Always use shadcn/ui primitives rather than raw HTML for interactive elements
// Good:
<Button variant="outline" onClick={handleSubmit}>Log Workout</Button>

// Avoid:
<button className="border rounded px-4 py-2" onClick={handleSubmit}>Log Workout</button>
```

### Available components to install when needed

Buttons, inputs, forms, cards, modals (Dialog), dropdowns (Select), calendars (Calendar),
tables (Table), badges, toasts (Sonner), navigation menus, tabs, and more.
Run `npx shadcn@latest add [component-name]` when a new primitive is required.

---

## Frontend aesthetics

<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:

Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.

Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.

Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.

Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>

**Note:** This project uses shadcn/ui + Tailwind. Apply aesthetic ambition within that system — extend via Tailwind config (custom fonts, colors, keyframes) rather than fighting the component library.

---

## Anthropic Claude API — rules and patterns

### Client setup

```typescript
// lib/anthropic.ts
import Anthropic from '@anthropic-ai/sdk'

// This module is server-only. Never import it in Client Components.
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // Never expose this to the client
})
```

### Calling the API

```typescript
// Always use the latest stable model
const response = await anthropic.messages.create({
  model: 'claude-opus-4-6', // or claude-sonnet-4-6 for faster/cheaper responses
  max_tokens: 4096,
  messages: [
    {
      role: 'user',
      content: prompt,
    },
  ],
})

const text = response.content[0].type === 'text' ? response.content[0].text : ''
```

### Route Handler pattern for plan generation

All Claude API calls go through a Route Handler — never call the API from a Client Component.

```typescript
// app/api/plan/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export async function POST(request: NextRequest) {
  const { raceDate, distanceKm, weeklyRunningKm, fitnessLevel } = await request.json()

  // Validate inputs before calling the API
  if (!raceDate || !distanceKm) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: buildPlanPrompt({ raceDate, distanceKm, weeklyRunningKm, fitnessLevel }) }],
  })

  const plan = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ plan })
}
```

### Structured output

When the API should return structured data (e.g., a JSON training plan), instruct it explicitly
in the prompt and parse the response. Use a try/catch around `JSON.parse`.

---

## Mobile-readiness rules

Vert is built in Next.js as a mobile-first responsive web app for v1 and v2. A React Native
(Expo) mobile app is deferred to v3+. These rules are **load-bearing**, not aspirational —
the strategic decision (locked in 2026-05-18, see `PROJECT_BRIEF.md` → Mobile strategy) is
that Vert is the *brain* (adaptive AI plan), not the *tracker*. Device sync (Garmin / Apple
Health / Strava) is the planned activity-input path, and a future native app remains a real
option contingent on user demand. Both require `lib/` to be cleanly portable.

The goal: when v3 arrives, `lib/` moves to the Expo app unchanged and only the UI layer
needs to be rebuilt. Follow these rules on every file you touch.

### Keep business logic out of the UI

All logic that isn't rendering belongs in `lib/`, not in components or pages.

```typescript
// ✅ Good — logic lives in lib/, component just calls it
import { calculateWeeklyLoad } from '@/lib/plan'
export function WeekSummary({ workouts }: Props) {
  const load = calculateWeeklyLoad(workouts)
  return <p>{load} TSS this week</p>
}

// ❌ Bad — business logic embedded in a component
export function WeekSummary({ workouts }: Props) {
  const load = workouts.reduce((sum, w) => sum + (w.tss ?? 0), 0)
  return <p>{load} TSS this week</p>
}
```

### Wrap browser APIs in service files

Never call browser APIs (`localStorage`, `navigator`, `window`, `document`) directly in
components or `lib/` files. Wrap them in a service in `lib/platform/` so the mobile app can
swap in the React Native equivalent (AsyncStorage, expo-location, etc.) without touching
business logic.

```typescript
// lib/platform/storage.ts
// Wraps localStorage so React Native can swap in AsyncStorage later
export const storage = {
  get: (key: string) => localStorage.getItem(key),
  set: (key: string, value: string) => localStorage.setItem(key, value),
  remove: (key: string) => localStorage.removeItem(key),
}

// Usage in components:
import { storage } from '@/lib/platform/storage'
storage.set('lastViewedWeek', weekOffset.toString())
```

### Keep Supabase queries in lib/

All Supabase read/write logic belongs in `lib/supabase.ts` or `lib/supabase-admin.ts`,
never inline in components. This is already the pattern — maintain it. These files move to
the Expo app unchanged.

### No Next.js-specific imports in lib/

Files in `lib/` must not import from `next/*` (e.g. `next/headers`, `next/navigation`).
Those imports are Next.js-only and will break in React Native. Keep `lib/` pure TypeScript.

### Server actions are API contracts

Treat every server action in `app/actions.ts` (or feature-scoped `actions/` files) as an
API endpoint a future native client will call. Practical consequences:

- Inputs validated with `zod` (or equivalent), not trusted blindly
- Errors returned as typed shapes, not thrown for the UI to catch
- No tight coupling to Next.js form internals where avoidable
- Authorisation (`requireUser()`) at the top of every mutation, every time

If a server action can't easily be reimagined as a JSON HTTP endpoint, the logic is in the
wrong place — move it down into `lib/` and have the action be a thin wrapper.

### Activity data carries a `source` field

Workout-log records have a `source` column (`manual` / `strava` / `garmin` / `apple_health`).
v1 always writes `manual`. When adding any code that creates or reads activity records,
respect the field — don't filter it out, don't hardcode `'manual'` outside the v1 write path,
and don't add new write paths without considering what `source` should be set to. The field
is the seam for v2+ device-sync work, and treating it as first-class now avoids a destructive
migration later.

---

## Code quality standards

These are non-negotiable. Apply them to every file, every time.

### Comments

- **Why, not what.** Explain the reason behind a decision, not what the code literally does.
- Every exported function needs a JSDoc comment describing its purpose, parameters, and return value.
- Non-obvious logic blocks get an inline comment.

```typescript
/**
 * Builds the Claude prompt for generating a training plan.
 * Includes race goal, current fitness baseline, and any accumulated
 * workout logs so the model can personalise the output.
 */
function buildPlanPrompt(params: PlanPromptParams): string {
  // Claude performs better when the constraints are listed before the ask,
  // so we structure: context → constraints → output format → request.
  return `...`
}
```

### TypeScript

- No `any` types. Define explicit interfaces and types in `types/index.ts`.
- Enable strict mode (already set in `tsconfig.json` — do not weaken it).
- Use `zod` for runtime validation of external data (API responses, form inputs, route handler bodies).

### File and naming conventions

- React components: PascalCase (`WorkoutCard.tsx`)
- Utility functions and hooks: camelCase (`useTrainingPlan.ts`)
- Route files follow Next.js conventions exactly (`page.tsx`, `layout.tsx`, `route.ts`)
- One component per file; no barrel files unless explicitly needed

### Environment variables

- `NEXT_PUBLIC_` prefix = safe for browser. Everything else is server-only.
- Never hardcode secrets. Never commit `.env.local`.
- Document every variable in `.env.example` with a description.

### Error handling

- Route Handlers always return typed JSON errors with appropriate HTTP status codes.
- Never swallow errors silently — log them and surface appropriately.
- User-facing error messages must be human-readable, not stack traces.

---

## Agent-specific instructions

When working autonomously in this codebase:

1. **Read this file and `PROJECT_BRIEF.md` first.** Every session, every time.
2. **Follow the build order** in `PROJECT_BRIEF.md`. Do not skip ahead.
3. **Every step ends with a working, deployable state.** Do not leave the app broken.
4. **Use shadcn/ui components** for all UI elements — no custom one-offs.
5. **Run `npm run lint` and `npm run build`** before declaring a task complete. Fix all errors.
6. **Write tests** for business logic in `lib/` when adding non-trivial functions.
   - Testing framework: **Vitest** (unit + integration). Run with `npm run test`.
   - E2E framework: **Playwright** — added later once complete user flows exist.
   - Test files live alongside source: `lib/plan.test.ts` next to `lib/plan.ts`.
   - Do not test trivial getters or UI rendering — focus on logic that would be hard to debug by hand.
   - **First session task:** install and configure Vitest before writing any feature code.
7. **When in doubt about scope**, refer to `PROJECT_BRIEF.md` — if something isn't in there, ask before building it.
8. **Comment as you go** — do not leave uncommented code to clean up later.
9. **Keep components small and focused.** If a component exceeds ~150 lines, split it.
10. **Environment variables**: check `.env.example` before assuming a variable exists. Add new ones there with a description.
11. **Suggest a code review after each major feature.** When you complete a significant feature (a new route, a new DB table, auth integration, a complete UI flow, etc.), explicitly prompt Ben to do a code review before starting the next feature. The suggested message is: *"This feature is complete and deployed. Before we start the next one, I recommend doing a quick code review in Cowork — just ask Claude there to 'run a code review on the codebase.' It catches security issues and code quality problems while the context is fresh."* This is non-blocking — if Ben wants to continue, that's fine — but always surface the suggestion.
