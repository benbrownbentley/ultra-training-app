import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Daily janitor. Sweeps plan_generation_jobs that have been
// in-flight (status='pending' or 'kicking-off') for more than 1h
// without an update, marking them `failed` with
// `failure_code = 'stalled'` so zombie rows don't accumulate and
// the banner UI presents a retry path instead of "Generating
// forever". The lazy client-side watchdog (RegenStatusProvider)
// catches stuck chains at the 3-minute mark when the user opens the
// app; this cron is the safety net for users who never come back to
// trigger the lazy watchdog.
//
// Auth: Vercel signs cron requests with the project's CRON_SECRET
// header. Verify it on every call — without that, this endpoint
// becomes an unauthenticated mass-fail trigger. CRON_SECRET is set
// in Vercel → Project → Settings → Environment Variables.
//
// Schedule: configured in vercel.json (`0 8 * * *` — 08:00 UTC
// daily). Vercel Hobby supports daily-only crons; the lazy
// watchdog covers the within-the-day case so the daily floor is
// sufficient for v2.

// Vercel cron runs only on production deployments by default — no
// runtime/preview safeguard needed beyond the secret check.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET
    ? `Bearer ${process.env.CRON_SECRET}`
    : null;
  if (!expected) {
    // Misconfiguration. Returning 500 surfaces the bad deploy in
    // Vercel logs without letting unauthenticated callers in.
    console.error(
      "[regen-janitor] CRON_SECRET not set — refusing to run sweep",
    );
    return NextResponse.json(
      { error: "cron secret not configured" },
      { status: 500 },
    );
  }
  if (auth !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 401 });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Sweep both kicking-off (stuck precreate, runMetaPlanForJob never
  // landed) and pending (mid-phase chain that died). cancelled +
  // complete + failed are already terminal — don't re-touch them.
  const { data, error } = await supabaseAdmin
    .from("plan_generation_jobs")
    .update({
      status: "failed",
      failure_code: "stalled",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("status", ["pending", "kicking-off"])
    .lt("updated_at", oneHourAgo)
    .select("id");

  if (error) {
    console.error("[regen-janitor] sweep failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const swept = data?.length ?? 0;
  console.log(`[regen-janitor] swept ${swept} stalled jobs`);
  return NextResponse.json({ swept });
}
