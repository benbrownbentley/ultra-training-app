import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { TabBar } from "@/app/_components/today/TabBar";
import { ProfileDetailHeader } from "@/app/_components/profile/DetailHeader";
import { AccountClient } from "@/app/_components/profile/AccountClient";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const [{ data }, identitiesRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getUserIdentities(),
  ]);
  const email = data.user?.email ?? "—";
  // Surface only the provider names — disconnect action takes the
  // provider string and looks up the identity row server-side, so the
  // client doesn't need to ferry the full identity object.
  const connectedProviders = (
    identitiesRes.data?.identities?.map((i) => i.provider) ?? []
  ).filter((p) => p !== "email");

  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <ProfileDetailHeader />
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 pt-5 sm:px-5">
          <div>
            <div
              className="font-mono text-[11px] uppercase text-zinc-500"
              style={{ letterSpacing: "0.2em" }}
            >
              — ACCOUNT
            </div>
            <h1
              className="m-0 mt-1.5 text-[26px] font-medium leading-tight text-zinc-950 dark:text-zinc-50"
              style={{ letterSpacing: "-0.02em" }}
            >
              Email & password
            </h1>
          </div>

          <Suspense fallback={null}>
            <AccountClient
              email={email}
              connectedProviders={connectedProviders}
            />
          </Suspense>
        </div>
      </div>
      <TabBar active="profile" />
    </div>
  );
}
