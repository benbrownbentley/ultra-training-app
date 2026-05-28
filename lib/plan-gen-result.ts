// Typed result envelope for plan-generation server actions. Used so
// the client UI can distinguish the failure mode and render the
// branded error state with appropriate copy, rather than the Vercel
// default 504 white-screen.
//
// `generation_timeout` covers any time-budget exhaustion — Anthropic
// SDK abort, Vercel function kill, or the client receiving an HTML
// 504. Client code catching a thrown exception of unknown shape
// should default to this code, since timeout is the dominant failure
// mode on Hobby (see PROJECT_BRIEF.md → "Phase 2 deployed 2026-05-22").
//
// `validation_failed` is the structural validator after the
// auto-retry-once has exhausted itself — Claude couldn't produce a
// schema-valid plan twice.
//
// `anthropic_error` is any other Anthropic SDK-shaped error: 4xx,
// 5xx, network from the function out to the API.
//
// `unknown` is the catch-all so a new failure mode never falls off
// the wire. Client copy treats it identically to `generation_timeout`.
//
// `already_in_flight` is the typed signal that a user-initiated
// regen was rejected because the user already has an in-progress
// generation job. The banner is the recovery surface — no separate
// error screen — so client UX is "swap the Regenerate button copy"
// rather than render the full error layout.

export type PlanGenErrorCode =
  | "generation_timeout"
  | "validation_failed"
  | "anthropic_error"
  | "already_in_flight"
  | "unknown";

/**
 * The failure half of every plan-generation server action's return
 * envelope. Each action defines its own success shape (e.g.
 * `{ ok: true; previewId: number }` for previewPlan) and unions it
 * with this type for the error path. Flat shape — no nested `value`
 * field — keeps client-side discrimination simple:
 *
 * ```
 * const r = await previewPlan(notes);
 * if (!r.ok) { renderError(r.code); return; }
 * router.push(`/regen?preview=${r.previewId}`);
 * ```
 */
export interface PlanGenFailure {
  ok: false;
  code: PlanGenErrorCode;
  // Short debug ID surfaced in the error UI's mono footer. Generated
  // server-side from a timestamp + random nonce. Not stable across
  // requests; purely for the user to reference in support.
  requestId: string;
}

/**
 * User-facing copy keyed by error code. Each entry follows the
 * existing athletic-vocabulary framing (`— SIGNAL LOST`, `— REST
 * DAY`) specced for regen errors in PROJECT_BRIEF.md. The wizard and
 * regen error states both consume this map, so changing copy in one
 * place updates every surface.
 */
export const PLAN_GEN_ERROR_COPY: Record<
  PlanGenErrorCode,
  { eyebrow: string; title: string; body: string }
> = {
  generation_timeout: {
    eyebrow: "LOST THE SIGNAL",
    title: "The plan didn't finish in time.",
    body: "Generation ran longer than our window. Your plan is safe — give it another go and the next attempt usually lands cleanly.",
  },
  validation_failed: {
    eyebrow: "OFF COURSE",
    title: "We couldn't build a clean plan on this pass.",
    body: "The first two passes both missed the mark. One more run usually does it — sometimes the model just needs a fresh start.",
  },
  anthropic_error: {
    eyebrow: "REST DAY",
    title: "Looks like our servers are having a rest day.",
    body: "Your plan is safe and unchanged. Give us a minute — we'll be back at it shortly.",
  },
  unknown: {
    eyebrow: "REST DAY",
    title: "Looks like our servers are having a rest day.",
    body: "Your plan is safe and unchanged. Give us a minute — we'll be back at it shortly.",
  },
  // Fallback copy only — the banner is the primary surface for this
  // code, so the full ErrorShell layout should rarely render this.
  already_in_flight: {
    eyebrow: "STILL RUNNING",
    title: "Your last regen is still in flight.",
    body: "Check the banner at the top of the page — tap it to watch progress, or wait for it to finish before kicking off another.",
  },
};

/**
 * Categorises a thrown error from generateTrainingPlan into one of the
 * documented codes. Defensive — anything we don't recognise lands on
 * `unknown` so the client still gets a typed envelope.
 */
export function classifyGenerationError(err: unknown): PlanGenErrorCode {
  if (err == null) return "unknown";
  const message =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message?: unknown }).message ?? "")
      : "";
  const name =
    typeof err === "object" && err !== null && "name" in err
      ? String((err as { name?: unknown }).name ?? "")
      : "";

  // Validation failure surfaces with the exact prefix from
  // generateTrainingPlan's throw after retry exhaustion.
  if (message.includes("failed validation after retry")) {
    return "validation_failed";
  }
  // Abort / timeout-shaped errors. Anthropic SDK abort is `AbortError`;
  // generic message-based detection picks up Vercel-level signals too.
  if (
    name === "AbortError" ||
    name === "TimeoutError" ||
    /timeout|timed out|ETIMEDOUT|aborted/i.test(message)
  ) {
    return "generation_timeout";
  }
  // Anthropic SDK error classes inherit a `status` field for HTTP
  // responses. Treat anything with a numeric status as an API error.
  if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status?: unknown }).status === "number"
  ) {
    return "anthropic_error";
  }
  return "unknown";
}

/**
 * Generates a short request-id for the error UI's mono footer. Used
 * when the action doesn't already have a stable id (Next.js's
 * `error.digest` is only available inside route error boundaries).
 */
export function makeRequestId(): string {
  // Date.now() bottom 4 digits + 4 random hex digits = 8 chars,
  // matching the existing ErrorShell footer truncation.
  const ts = Date.now().toString(16).slice(-4);
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0");
  return `${ts}${rand}`;
}
