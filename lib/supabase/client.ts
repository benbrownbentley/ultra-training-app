import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Use this inside Client Components (files marked
 * with "use client") that need to read or write through the user's session.
 * Each call returns a fresh instance.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
