"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import type { UnitSystem } from "@/lib/plan";
import {
  clientSetNotificationPreference,
  clientSetTheme,
  clientSetUnitSystem,
} from "@/lib/preferences-client";
import { Group, RowDivider, SegmentedRow, ToggleRow } from "./atoms";

type ThemeId = "light" | "dark" | "system";

interface Props {
  unitSystem: UnitSystem;
  theme: ThemeId;
  dailyReminder: boolean;
  regenCompleteNotify: boolean;
  weeklySummary: boolean;
}

const UNIT_OPTIONS = ["metric", "imperial"] as const;
const UNIT_LABELS: Record<UnitSystem, string> = {
  metric: "Metric",
  imperial: "Imperial",
};
const THEME_OPTIONS = ["light", "dark", "system"] as const;
const THEME_LABELS: Record<ThemeId, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

// Writes go straight to Supabase from the browser (see
// lib/preferences-client.ts). Server Actions trigger a full RSC tree
// auto-refresh after every call — that's what was producing the
// 22-request cascade and the multi-second toggle latency. Theme
// is handled client-side by next-themes; units need a one-shot
// router.refresh() so the current page's unit-converted text
// catches up; notifications don't affect any rendered surface.
export function PreferencesGroups({
  unitSystem,
  theme,
  dailyReminder,
  regenCompleteNotify,
  weeklySummary,
}: Props) {
  const router = useRouter();
  const { setTheme: setNextTheme } = useTheme();
  // Toggles fire optimistically — no isPending gate. If the write
  // fails, local state rolls back and the inline error appears.
  const [, startTransition] = useTransition();

  const [units, setUnits] = useState<UnitSystem>(unitSystem);
  const [themeId, setThemeId] = useState<ThemeId>(theme);
  const [daily, setDaily] = useState(dailyReminder);
  const [regen, setRegen] = useState(regenCompleteNotify);
  const [weekly, setWeekly] = useState(weeklySummary);
  // Surfaces any persist failure inline so the toggle doesn't silently
  // diverge from server state. Cleared the next time the user pokes a row.
  const [error, setError] = useState<string | null>(null);

  function logFailure(
    r: { ok: false; error: string; code?: string; hint?: string },
  ) {
    console.error("[Preferences] save failed", r);
  }

  function pickUnits(next: UnitSystem) {
    const prev = units;
    setUnits(next);
    setError(null);
    startTransition(async () => {
      const r = await clientSetUnitSystem(next);
      if (!r.ok) {
        logFailure(r);
        setUnits(prev);
        setError("Couldn't save — try again.");
        return;
      }
      // Units affect every distance/elevation/weight string in the
      // app. One router.refresh() updates the current page's RSC; the
      // other tabs are force-dynamic and re-fetch on next navigation.
      router.refresh();
    });
  }

  function pickTheme(next: ThemeId) {
    const prev = themeId;
    setThemeId(next);
    setNextTheme(next);
    setError(null);
    startTransition(async () => {
      const r = await clientSetTheme(next);
      if (!r.ok) {
        logFailure(r);
        setThemeId(prev);
        setNextTheme(prev);
        setError("Couldn't save — try again.");
      }
      // next-themes already swapped the document class — no refresh.
    });
  }

  function flipDaily(value: boolean) {
    const prev = daily;
    setDaily(value);
    setError(null);
    startTransition(async () => {
      const r = await clientSetNotificationPreference("daily_reminder", value);
      if (!r.ok) {
        logFailure(r);
        setDaily(prev);
        setError("Couldn't save — try again.");
      }
    });
  }
  function flipRegen(value: boolean) {
    const prev = regen;
    setRegen(value);
    setError(null);
    startTransition(async () => {
      const r = await clientSetNotificationPreference("regen_complete", value);
      if (!r.ok) {
        logFailure(r);
        setRegen(prev);
        setError("Couldn't save — try again.");
      }
    });
  }
  function flipWeekly(value: boolean) {
    const prev = weekly;
    setWeekly(value);
    setError(null);
    startTransition(async () => {
      const r = await clientSetNotificationPreference("weekly_summary", value);
      if (!r.ok) {
        logFailure(r);
        setWeekly(prev);
        setError("Couldn't save — try again.");
      }
    });
  }

  const unitValue = UNIT_LABELS[units];
  const themeValue = THEME_LABELS[themeId];

  return (
    <Group label="PREFERENCES">
      <SegmentedRow
        label="Units"
        options={UNIT_OPTIONS.map((u) => UNIT_LABELS[u])}
        value={unitValue}
        onChange={(label) => {
          const next = UNIT_OPTIONS.find((u) => UNIT_LABELS[u] === label);
          if (next) pickUnits(next);
        }}
        helper="All distances, elevation, and weight throughout the app."
      />
      <RowDivider />
      <SegmentedRow
        label="Theme"
        options={THEME_OPTIONS.map((t) => THEME_LABELS[t])}
        value={themeValue}
        onChange={(label) => {
          const next = THEME_OPTIONS.find((t) => THEME_LABELS[t] === label);
          if (next) pickTheme(next);
        }}
      />
      <RowDivider />
      <ToggleRow
        label="Daily workout reminder"
        sub="A morning nudge for today's plan"
        value={daily}
        onChange={flipDaily}
      />
      <RowDivider />
      <ToggleRow
        label="Regeneration complete"
        sub="Notify when your plan is updated"
        value={regen}
        onChange={flipRegen}
      />
      <RowDivider />
      <ToggleRow
        label="Weekly summary"
        sub="Sunday recap of the week's work"
        value={weekly}
        onChange={flipWeekly}
      />
      {error && (
        <div className="border-t border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
          <span
            className="font-mono text-[11.5px] text-red-600 dark:text-red-500"
            style={{ letterSpacing: "0.04em" }}
          >
            {error}
          </span>
        </div>
      )}
    </Group>
  );
}
