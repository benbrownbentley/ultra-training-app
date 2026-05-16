# AGENTS.md — Ultra Marathon Training App

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

```
app/                    # Next.js App Router — all pages and API routes live here
  layout.tsx            # Root layout: fonts, global providers, <html> shell
  page.tsx              # Home page (/)
  globals.css           # Global styles + Tailwind base imports
  (auth)/               # Route group for auth pages — does NOT affect URL
    login/page.tsx
    signup/page.tsx
  dashboard/
    page.tsx            # Main dashboard (/dashboard)
  api/                  # API Route Handlers (server-side only)
    plan/
      generate/route.ts # POST /api/plan/generate — calls Claude API
      route.ts          # GET /api/plan — fetch current plan

components/             # Shared UI components
  ui/                   # shadcn/ui primitives (auto-generated, do not hand-edit)
  [feature]/            # Feature-specific components, e.g. components/training/WorkoutCard.tsx

lib/                    # Shared utilities and service clients
  supabase/
    client.ts           # Browser-side Supabase client (for Client Components)
    server.ts           # Server-side Supabase client (for Server Components + Route Handlers)
    middleware.ts        # Auth token refresh middleware helper
  anthropic.ts          # Anthropic SDK client + prompt helpers
  plan.ts               # Training plan types and business logic
  utils.ts              # General utilities (cn(), dates, formatting)

types/                  # Shared TypeScript types and interfaces
  index.ts

middleware.ts           # Next.js middleware — runs on every request for auth session refresh

public/                 # Static assets served at root URL
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
