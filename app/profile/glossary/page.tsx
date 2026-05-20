import { Fragment } from "react";
import { ENTRIES, GROUPS, entriesInGroup } from "@/lib/glossary";
import { TabBar } from "@/app/_components/today/TabBar";
import { ProfileDetailHeader } from "@/app/_components/profile/DetailHeader";
import {
  Group,
  RowDivider,
  SettingsRow,
} from "@/app/_components/profile/atoms";

export const dynamic = "force-static";

export default function GlossaryLandingPage() {
  // Touch ENTRIES to keep the import non-empty for callers that pre-load
  // a slug — the registry is the source of truth.
  void ENTRIES.length;

  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <ProfileDetailHeader backHref="/profile" backLabel="PROFILE" />
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 pt-5 sm:px-5">
          <div>
            <div
              className="font-mono text-[11px] uppercase text-zinc-500"
              style={{ letterSpacing: "0.2em" }}
            >
              — WORKOUT GLOSSARY
            </div>
            <h1
              className="m-0 mt-1.5 text-[26px] font-medium leading-tight text-zinc-950 dark:text-zinc-50"
              style={{ letterSpacing: "-0.02em" }}
            >
              Workout types
            </h1>
            <p className="m-0 mt-2.5 max-w-[460px] text-[14.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Reference for the workout types in your plan. Tap any type for
              details on what it is, what it does for your body, and how to do
              it well.
            </p>
          </div>

          {GROUPS.map((group) => {
            const items = entriesInGroup(group.id);
            if (items.length === 0) return null;
            return (
              <Group key={group.id} label={group.label}>
                {items.map((entry, i) => (
                  <Fragment key={entry.slug}>
                    {i > 0 && <RowDivider />}
                    <SettingsRow
                      label={entry.title}
                      sub={entry.tagline}
                      href={`/profile/glossary/${entry.slug}`}
                    />
                  </Fragment>
                ))}
              </Group>
            );
          })}
        </div>
      </div>
      <TabBar active="profile" />
    </div>
  );
}
