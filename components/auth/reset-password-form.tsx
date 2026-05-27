"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { completePasswordReset } from "@/app/(auth)/actions";

import { AuthShell } from "./auth-shell";
import { PasswordRequirements } from "./password-requirements";

// "verifying" while we exchange the recovery token; "ready" once it's valid
// and we can show the new-password form; "invalid" for missing/expired/used
// tokens.
type Phase = "verifying" | "ready" | "invalid";

export function ResetPasswordForm({
  tokenHash,
  type,
}: {
  tokenHash?: string;
  type?: string;
}) {
  const [phase, setPhase] = React.useState<Phase>(
    tokenHash ? "verifying" : "invalid",
  );
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!tokenHash) return; // phase is already "invalid"
    let cancelled = false;
    const supabase = createClient();
    // verifyOtp runs client-side so the browser client writes the recovery
    // session cookies — the completePasswordReset server action then reads
    // them to authorise the password update.
    supabase.auth
      .verifyOtp({
        token_hash: tokenHash,
        type: (type ?? "recovery") as EmailOtpType,
      })
      .then(({ error: otpError }) => {
        if (cancelled) return;
        setPhase(otpError ? "invalid" : "ready");
      });
    return () => {
      cancelled = true;
    };
  }, [tokenHash, type]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    startTransition(async () => {
      const result = await completePasswordReset({ newPassword: password });
      // Success redirects to / server-side; only the failure path returns.
      if (result.ok === false) {
        setError(result.error);
      }
    });
  }

  if (phase === "verifying") {
    return (
      <AuthShell>
        <div className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
          — VERIFYING
        </div>
        <h1 className="mb-2 text-[30px] font-medium leading-tight tracking-[-0.02em]">
          Checking your link…
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          One moment while we confirm your reset link.
        </p>
      </AuthShell>
    );
  }

  if (phase === "invalid") {
    return (
      <AuthShell>
        <div className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
          — LINK EXPIRED
        </div>
        <h1 className="mb-2 text-[30px] font-medium leading-tight tracking-[-0.02em]">
          This link has expired.
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Reset links can only be used once and expire after a short window.
          Request a fresh one to continue.
        </p>
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Request a new reset link →
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
        — SET A NEW PASSWORD
      </div>
      <h1 className="mb-2 text-[30px] font-medium leading-tight tracking-[-0.02em]">
        Choose a new password.
      </h1>
      <p className="mb-7 text-sm text-zinc-600 dark:text-zinc-400">
        Pick something you&apos;ll remember — you&apos;ll be signed in once it&apos;s set.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col">
        <fieldset disabled={isPending} className="contents">
          <div className="mb-3.5">
            <Label
              htmlFor="new-password"
              className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500"
            >
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11"
            />
          </div>

          {password.length > 0 && <PasswordRequirements pw={password} />}

          <div className="mb-3.5">
            <Label
              htmlFor="confirm-password"
              className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500"
            >
              Confirm password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="h-11"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="mt-2 h-11 w-full bg-emerald-500 text-sm font-semibold text-emerald-950 shadow-[0_6px_18px_rgba(16,185,129,0.25)] hover:bg-emerald-400 dark:hover:bg-emerald-400"
          >
            {isPending ? "Updating…" : "Update password"}
            {!isPending && <ArrowRight className="ml-1" data-icon="inline-end" />}
          </Button>
        </fieldset>
      </form>
    </AuthShell>
  );
}
