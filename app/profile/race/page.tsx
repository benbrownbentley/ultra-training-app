import Link from "next/link";
import { listRaces } from "@/lib/supabase/server";
import { TabBar } from "@/app/_components/today/TabBar";
import { ProfileDetailHeader } from "@/app/_components/profile/DetailHeader";
import { RaceCard } from "@/app/_components/profile/RaceCard";

export const dynamic = "force-dynamic";

export default async function RaceCalendarPage() {
  const races = await listRaces();

  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <ProfileDetailHeader backHref="/profile" backLabel="PROFILE" />
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 pt-5 sm:px-5">
          <div>
            <div
              className="font-mono text-[11px] uppercase text-zinc-500"
              style={{ letterSpacing: "0.2em" }}
            >
              — RACE CALENDAR
            </div>
            <h1
              className="m-0 mt-1.5 text-[26px] font-medium leading-tight text-zinc-950 dark:text-zinc-50"
              style={{ letterSpacing: "-0.02em" }}
            >
              Your races
            </h1>
            <span
              className="mt-1 inline-block font-mono text-[11.5px] text-zinc-600 dark:text-zinc-400"
              style={{ letterSpacing: "0.04em" }}
            >
              Sorted by priority — A races first.
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {races.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-zinc-200 px-3.5 py-4 text-center text-[13px] text-zinc-500 dark:border-zinc-800">
                No races yet. Add one to anchor your plan.
              </div>
            ) : (
              races.map((race) => <RaceCard key={race.id ?? race.name} race={race} />)
            )}
            <Link
              href="/profile/race/new"
              className="flex items-center justify-center gap-2 rounded-[12px] border border-dashed border-zinc-200 px-4 py-3.5 text-[14px] font-medium text-zinc-950 dark:border-zinc-800 dark:text-zinc-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Add another race
            </Link>
          </div>
        </div>
      </div>
      <TabBar active="profile" />
    </div>
  );
}
