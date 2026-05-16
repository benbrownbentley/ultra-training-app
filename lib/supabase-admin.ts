import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Add SUPABASE_SECRET_KEY to .env.local and Vercel — it must never be exposed to the browser.",
  );
}

export const supabaseAdmin = createClient(url, secret, {
  auth: { persistSession: false },
});
