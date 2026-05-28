import { NextResponse } from "next/server";
import { after } from "next/server";
import {
  applyPostAdvanceSideEffects,
  runAdvanceJobEngine,
  scheduleSelfAdvance,
} from "@/lib/regen-advance-engine";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Server-to-server endpoint that drives the next step of a chunked
// regen job. Called by `after()` callbacks fired from the prior step
// (either the `advanceJob` server action or this route handling the
// previous phase), so the chain advances even when the client has
// navigated away from `/regen`.
//
// Auth: shared secret header (REGEN_ADVANCE_SECRET). These calls
// aren't authenticated as a user — the originating call was, this is
// just the server talking to itself. The user_id is read from the
// job row inside `runAdvanceJobEngine` so the orchestrator still
// operates on the correct user's data.
//
// Idempotency: the engine short-circuits on terminal job statuses
// (complete / failed / cancelled) and on kicking-off (which the
// client owns). Duplicate self-fetches that arrive after the chain
// has already moved on return cleanly.
//
// Failure handling: anything non-2xx from this route doesn't bubble
// to a user — the original caller already returned its response. We
// rely on the lazy client-side watchdog (PR 4) and the daily janitor
// (PR 4) to catch chains that silently die after a route failure.
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = req.headers.get("x-regen-advance-secret");
  if (!process.env.REGEN_ADVANCE_SECRET) {
    // Misconfiguration. Don't accept any caller — we'd otherwise be
    // an unauthenticated server-side trigger for Claude calls.
    return NextResponse.json(
      { error: "regen advance secret not configured" },
      { status: 500 },
    );
  }
  if (secret !== process.env.REGEN_ADVANCE_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const jobId =
    body && typeof body === "object" && "jobId" in body
      ? (body as { jobId: unknown }).jobId
      : undefined;
  if (typeof jobId !== "number" || !Number.isInteger(jobId)) {
    return NextResponse.json({ error: "bad jobId" }, { status: 400 });
  }

  // Pull user_id from the job row — server-to-server calls don't
  // carry a session, so the job is the only authoritative source for
  // which user owns this chain. The engine then re-filters by this
  // userId on every read so a mismatched jobId still can't leak
  // cross-user data.
  const { data: jobRow, error: jobLookupErr } = await supabaseAdmin
    .from("plan_generation_jobs")
    .select("user_id")
    .eq("id", jobId)
    .maybeSingle<{ user_id: string }>();
  if (jobLookupErr) {
    return NextResponse.json(
      { error: jobLookupErr.message },
      { status: 500 },
    );
  }
  if (!jobRow) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  const result = await runAdvanceJobEngine({
    userId: jobRow.user_id,
    jobId,
  });
  applyPostAdvanceSideEffects(result);

  if (result.ok && result.status === "pending") {
    // Keep the chain moving. Same pattern as the action — fire the
    // next self-fetch via after() so it lands as a fresh function
    // invocation with its own 60s budget.
    after(async () => {
      await scheduleSelfAdvance(jobId);
    });
  }

  return NextResponse.json(result);
}
