"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { ElevationProfile } from "./elevation-profile";
import { GoogleIcon } from "./google-icon";
import { TopoBackground } from "./topo-background";
import { VertLogo } from "./vert-logo";

// Race context for the left panel. Lifted to a constant so it's trivial to
// move to props or a CMS once we have more than one target race.
const RACE = {
  block: "18-WEEK BUILD · UTMB 2026",
  stats: [
    ["DISTANCE", "171.5", "km"],
    ["VERT GAIN", "10 040", "m"],
    ["CUTOFF", "46:30", "hrs"],
  ] as const,
};

export type AuthMode = "signin" | "signup";

interface AuthSplitProps {
  mode: AuthMode;
  onSubmit?: (creds: { email: string; password: string }) => void | Promise<void>;
  onGoogle?: () => void | Promise<void>;
}

export function AuthSplit({ mode, onSubmit, onGoogle }: AuthSplitProps) {
  const isSignup = mode === "signup";
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (onSubmit) {
      await onSubmit({ email, password });
    } else {
      // Visual-only stub until Supabase Auth is wired in v2.
      console.log("[auth-split] submit", { mode, email });
    }
  }

  async function handleGoogle() {
    if (onGoogle) {
      await onGoogle();
    } else {
      console.log("[auth-split] google", { mode });
    }
  }

  return (
    <div className="grid min-h-screen w-full bg-zinc-50 text-zinc-950 lg:grid-cols-[1.05fr_1fr] dark:bg-zinc-950 dark:text-zinc-50">
      {/* LEFT — trail panel (always dark green, hidden below lg) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-b from-[#052e1f] via-[#064e3b] to-[#065f46] p-9 text-emerald-50 lg:flex dark:from-[#020a07] dark:via-[#052e1f] dark:to-[#064e3b]">
        <TopoBackground color="#34d399" opacity={0.22} dense />

        <div className="relative">
          <VertLogo size="lg" className="text-emerald-50" />
        </div>

        <div className="relative">
          <div className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-300">
            {RACE.block}
          </div>
          <h2 className="max-w-[360px] text-[42px] font-medium leading-[1.05] tracking-[-0.02em]">
            Train for the
            <br />
            distance that
            <br />
            scares you.
          </h2>
        </div>

        <div className="relative border-t border-emerald-300/25 pt-4.5">
          <ElevationProfile
            stroke="#6ee7b7"
            fill="rgba(110,231,183,0.18)"
            height={70}
            width={360}
          />
          <div className="mt-3.5 grid grid-cols-3 gap-4.5">
            {RACE.stats.map(([label, value, unit]) => (
              <div key={label}>
                <div className="font-mono text-[10px] tracking-[0.18em] text-emerald-300">
                  {label}
                </div>
                <div className="mt-1 font-mono text-[22px] font-medium tracking-[-0.01em]">
                  {value}
                  <span className="ml-1 text-[11px] text-emerald-200">{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* RIGHT — form */}
      <main className="flex flex-col justify-center px-6 py-12 sm:px-14 sm:py-14">
        <div className="mx-auto w-full max-w-[360px]">
          {/* Mobile-only logo above the title */}
          <div className="mb-8 lg:hidden">
            <VertLogo size="md" />
          </div>

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
            className="h-11 w-full text-sm font-medium"
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 font-mono text-[11px] tracking-[0.12em] text-zinc-400 dark:text-zinc-600">
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            OR
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col">
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
                    href="#"
                    className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    Forgot?
                  </Link>
                )}
              </div>
              <Input
                id="password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              className="mt-2 h-11 w-full bg-emerald-500 text-sm font-semibold text-emerald-950 shadow-[0_6px_18px_rgba(16,185,129,0.25)] hover:bg-emerald-400 dark:hover:bg-emerald-400"
            >
              {isSignup ? "Create account" : "Sign in"}
              <ArrowRight className="ml-1" data-icon="inline-end" />
            </Button>
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
        </div>
      </main>
    </div>
  );
}
