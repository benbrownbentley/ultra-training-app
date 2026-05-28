"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/app/(auth)/actions";

import { AuthShell } from "./auth-shell";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset({ email });
      // The action returns ok even for unknown emails (anti-enumeration), so
      // success always lands on the same "check your inbox" state.
      if (result.ok === false) {
        setError(result.error);
      } else {
        setSentTo(result.email);
      }
    });
  }

  return (
    <AuthShell>
      {sentTo ? (
        <div className="flex flex-col">
          <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <MailCheck className="h-5 w-5" />
          </div>
          <div className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
            — CHECK YOUR INBOX
          </div>
          <h1 className="mb-2 text-[30px] font-medium leading-tight tracking-[-0.02em]">
            Reset link sent.
          </h1>
          <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
            We sent a reset link to{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {sentTo}
            </span>
            . Click it to set a new password.
          </p>
          <Link
            href="/sign-in"
            className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Back to sign in →
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
            — RESET ACCESS
          </div>
          <h1 className="mb-2 text-[30px] font-medium leading-tight tracking-[-0.02em]">
            Forgot your password?
          </h1>
          <p className="mb-7 text-sm text-zinc-600 dark:text-zinc-400">
            Enter your email and we&apos;ll send a reset link.
          </p>

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
                {isPending ? "Sending…" : "Send reset link"}
                {!isPending && <ArrowRight className="ml-1" data-icon="inline-end" />}
              </Button>
            </fieldset>
          </form>

          <div className="mt-5.5 text-center text-sm text-zinc-600 dark:text-zinc-400">
            <Link
              href="/sign-in"
              className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Back to sign in →
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
