"use client";

import { useState, useTransition } from "react";
import { useTheme } from "next-themes";
import type { UnitSystem } from "@/lib/plan";
import {
  setNotificationPreference,
  setTheme as persistTheme,
  setUnitSystem,
} from "@/app/actions";
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

// useState rather than useOptimistic — the previous implementation snapped
// back to the server value on re-renders before the transition flushed, which
// made every toggle visually bounce. We seed local state from props once,
// drive the UI from local state, and fire the action in a transition; the
// page revalidates after the action so the server is the source of truth on
// the next mount.
export function PreferencesGroups({
  unitSystem,
  theme,
  dailyReminder,
  regenCompleteNotify,
  weeklySummary,
}: Props) {
  const { setTheme: setNextTheme } = useTheme();
  const [isPending, startTransition] = useTransition();

  const [units, setUnits] = useState<UnitSystem>(unitSystem);
  const [themeId, setThemeId] = useState<ThemeId>(theme);
  const [daily, setDaily] = useState(dailyReminder);
  const [regen, setRegen] = useState(regenCompleteNotify);
  const [weekly, setWeekly] = useState(weeklySummary);

  function pickUnits(next: UnitSystem) {
    setUnits(next);
    startTransition(() => {
      void setUnitSystem(next);
    });
  }

  function pickTheme(next: ThemeId) {
    setThemeId(next);
    setNextTheme(next);
    startTransition(() => {
      void persistTheme(next);
    });
  }

  function flipDaily(value: boolean) {
    setDaily(value);
    startTransition(() => {
      void setNotificationPreference("daily_reminder", value);
    });
  }
  function flipRegen(value: boolean) {
    setRegen(value);
    startTransition(() => {
      void setNotificationPreference("regen_complete", value);
    });
  }
  function flipWeekly(value: boolean) {
    setWeekly(value);
    startTransition(() => {
      void setNotificationPreference("weekly_summary", value);
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
        disabled={isPending}
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
        disabled={isPending}
      />
      <RowDivider />
      <ToggleRow
        label="Daily workout reminder"
        sub="A morning nudge for today's plan"
        value={daily}
        onChange={flipDaily}
        disabled={isPending}
      />
      <RowDivider />
      <ToggleRow
        label="Regeneration complete"
        sub="Notify when your plan is updated"
        value={regen}
        onChange={flipRegen}
        disabled={isPending}
      />
      <RowDivider />
      <ToggleRow
        label="Weekly summary"
        sub="Sunday recap of the week's work"
        value={weekly}
        onChange={flipWeekly}
        disabled={isPending}
      />
    </Group>
  );
}
