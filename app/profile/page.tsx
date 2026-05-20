import { createClient, getRace } from "@/lib/supabase/server";
import { daysBetween, getTodayISO } from "@/lib/utils";
import { TabBar } from "@/app/_components/today/TabBar";
import { ProfileTabHeader } from "@/app/_components/profile/ProfileHeader";
import {
  ActionRow,
  Group,
  RowDivider,
  SegmentedRow,
  SettingsRow,
  ToggleRow,
} from "@/app/_components/profile/atoms";
import { SignOutRow } from "@/app/_components/profile/SignOutRow";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const [{ data: userRes }, race] = await Promise.all([
    supabase.auth.getUser(),
    getRace(),
  ]);
  const user = userRes.user;
  const todayIso = getTodayISO();

  // Derive a friendly race summary for the YOUR TRAINING row.
  const raceSummary = race
    ? `${race.name} · ${weeksOutLabel(daysBetween(todayIso, race.date))}`
    : "No race configured";

  // Email gets used as a hint on the Account row.
  const email = user?.email ?? "—";
  const displayName = user?.user_metadata?.full_name ?? email.split("@")[0];

  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <ProfileTabHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 pt-5 pb-6 sm:px-5">
          <div>
            <div
              className="font-mono text-[11px] uppercase text-zinc-500"
              style={{ letterSpacing: "0.2em" }}
            >
              — PROFILE
            </div>
            <h1
              className="m-0 mt-1 text-[26px] font-medium leading-tight text-zinc-950 dark:text-zinc-50"
              style={{ letterSpacing: "-0.02em" }}
            >
              {displayName}
            </h1>
            <span
              className="font-mono text-[12px] text-zinc-600 dark:text-zinc-400"
              style={{ letterSpacing: "0.04em" }}
            >
              {email}
            </span>
          </div>

          <Group label="YOUR TRAINING">
            <SettingsRow
              label="Athlete profile"
              sub="Fitness, experience, equipment, preferences"
              href="/profile/athlete"
            />
            <RowDivider />
            <SettingsRow
              label="Race calendar"
              sub={raceSummary}
              href="/profile/race"
            />
          </Group>

          <Group label="REFERENCE">
            <SettingsRow
              label="Workout glossary"
              sub="What each session type is and why"
              href="/profile/glossary"
            />
          </Group>

          <Group label="PREFERENCES">
            <SegmentedRow
              label="Units"
              options={["Metric", "Imperial"]}
              value="Metric"
              helper="All distances, elevation, and weight throughout the app."
            />
            <RowDivider />
            <SegmentedRow
              label="Theme"
              options={["Light", "Dark", "System"]}
              value="System"
            />
            <RowDivider />
            <ToggleRow
              label="Daily workout reminder"
              sub="A morning nudge for today's plan"
              defaultOn
            />
            <RowDivider />
            <ToggleRow
              label="Regeneration complete"
              sub="Notify when your plan is updated"
              defaultOn
            />
            <RowDivider />
            <ToggleRow
              label="Weekly summary"
              sub="Sunday recap of the week's work"
              defaultOn
            />
          </Group>

          <Group label="ACCOUNT">
            <SettingsRow
              label="Email & password"
              hint={email}
              href="/profile/account"
            />
            <RowDivider />
            <SignOutRow />
          </Group>

          <Group label="DATA">
            <ActionRow label="Export as CSV" tone="accent" />
            <RowDivider />
            <ActionRow label="Export as JSON" tone="accent" />
            <RowDivider />
            <ActionRow
              label="Delete account"
              tone="destructive"
              href="/profile/account?delete=1"
            />
          </Group>

          <div className="flex justify-center py-2">
            <span
              className="font-mono text-[10.5px] uppercase text-zinc-400 dark:text-zinc-600"
              style={{ letterSpacing: "0.18em" }}
            >
              VERT · 2026 BLOCK
            </span>
          </div>
        </div>
      </div>
      <TabBar active="profile" />
    </div>
  );
}

function weeksOutLabel(days: number): string {
  if (days < 0) return "race day passed";
  if (days <= 14) return `${days} day${days === 1 ? "" : "s"} out`;
  return `${Math.round(days / 7)} weeks out`;
}
