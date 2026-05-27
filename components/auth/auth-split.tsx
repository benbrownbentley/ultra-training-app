"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth-constants";

import { AuthShell } from "./auth-shell";
import { GoogleIcon } from "./google-icon";
import { PasswordRequirements } from "./password-requirements";

import type { AuthResult, OAuthResult } from "@/app/(auth)/actions";

export type AuthMode = "signin" | "signup";

interface AuthSplitProps {
  mode: AuthMode;
  action: (creds: { email: string; password: string }) => Promise<AuthResult>;
  googleAction?: () => Promise<OAuthResult>;
  initialError?: string;
}

export function AuthSplit({
  mode,
  action,
  googleAction,
  initialError,
}: AuthSplitProps) {
  const isSignup = mode === "signup";
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  // Toggle is component-local and resets to hidden on every mount — we never
  // persist a "show password" preference.
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(initialError ?? null);
  const [confirmEmail, setConfirmEmail] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const [googlePending, startGoogleTransition] = React.useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await action({ email, password });
      // On redirect (sign-in success / sign-up with active session) Next
      // navigates away before this line runs, so we only handle the cases
      // where the action returned a value.
      if (result.ok === false) {
        setError(result.error);
      } else if (result.status === "confirm_email") {
        setConfirmEmail(result.email);
      }
    });
  }

  function handleGoogle() {
    if (!googleAction) return;
    setError(null);
    startGoogleTransition(async () => {
      const result = await googleAction();
      if (result.ok) {
        // Hard navigation to the Supabase-returned OAuth provider URL.
        window.location.assign(result.url);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <AuthShell>
      {confirmEmail ? (
            <ConfirmEmailView email={confirmEmail} />
          ) : (
            <>
              <div className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                {isSignup ? "— NEW ATHLETE" : "— RETURNING"}
              </div>
              <h1 className="mb-2 text-[30px] font-medium leading-tight tracking-[-0.02em]">
                {isSignup ? "Lace up." : "Welcome back."}
              </h1>
              <p className="mb-7 text-sm text-zinc-600 dark:text-zinc-400">
                {isSignup
                  ? "Create an account to start your block."
                  : "Pick up where your training left off."}
              </p>

              <Button
                type="button"
                variant="outline"
                onClick={handleGoogle}
                disabled={!googleAction || googlePending || isPending}
                className="h-11 w-full text-sm font-medium"
              >
                <GoogleIcon />
                {googlePending ? "Redirecting…" : "Continue with Google"}
              </Button>

              <div className="my-5 flex items-center gap-3 font-mono text-[11px] tracking-[0.12em] text-zinc-400 dark:text-zinc-600">
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                OR
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col">
                <fieldset disabled={isPending} className="contents">
                  <div className="mb-3.5">
                    <Label
                      htmlFor="email"
                      className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500"
                    >
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="athlete@trail.run"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>

                  <div className="mb-3.5">
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <Label
                        htmlFor="password"
                        className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500"
                      >
                        Password
                      </Label>
                      {!isSignup && (
                        <Link
                          href="/forgot-password"
                          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          Forgot?
                        </Link>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={isSignup ? "new-password" : "current-password"}
                        placeholder="••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={isSignup ? PASSWORD_MIN_LENGTH : undefined}
                        className="h-11 pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Live rule checklist — sign-up only, and only once the
                      user starts typing (see PasswordRequirements). */}
                  {isSignup && password.length > 0 && (
                    <PasswordRequirements pw={password} />
                  )}

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
                    {isPending
                      ? isSignup
                        ? "Creating account…"
                        : "Signing in…"
                      : isSignup
                        ? "Create account"
                        : "Sign in"}
                    {!isPending && <ArrowRight className="ml-1" data-icon="inline-end" />}
                  </Button>
                </fieldset>
              </form>

              <div className="mt-5.5 text-center text-sm text-zinc-600 dark:text-zinc-400">
                {isSignup ? "Already training? " : "First ultra? "}
                <Link
                  href={isSignup ? "/sign-in" : "/sign-up"}
                  className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {isSignup ? "Sign in" : "Create an account"}
                </Link>
              </div>
            </>
          )}
    </AuthShell>
  );
}

function ConfirmEmailView({ email }: { email: string }) {
  return (
    <div className="flex flex-col">
      <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <MailCheck className="h-5 w-5" />
      </div>
      <div className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
        — CHECK YOUR INBOX
      </div>
      <h1 className="mb-2 text-[30px] font-medium leading-tight tracking-[-0.02em]">
        Confirm your email.
      </h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        We sent a confirmation link to{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{email}</span>.
        Click it to activate your account, then come back to sign in.
      </p>
      <Link
        href="/sign-in"
        className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        Back to sign in →
      </Link>
    </div>
  );
}
