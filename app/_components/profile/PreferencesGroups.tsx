"use client";

import { useOptimistic, useTransition } from "react";
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

// Owns the Profile-landing PREFERENCES block. Each row uses useOptimistic
// so the toggle/segmented control snaps to the new value immediately,
// and the action runs in a transition that swallows the latency.
export function PreferencesGroups({
  unitSystem,
  theme,
  dailyReminder,
  regenCompleteNotify,
  weeklySummary,
}: Props) {
  const { setTheme: setNextTheme } = useTheme();
  const [isPending, startTransition] = useTransition();

  const [optimisticUnits, setOptimisticUnits] = useOptimistic(unitSystem);
  const [optimisticTheme, setOptimisticTheme] = useOptimistic(theme);
  const [optimisticDaily, setOptimisticDaily] = useOptimistic(dailyReminder);
  const [optimisticRegen, setOptimisticRegen] = useOptimistic(
    regenCompleteNotify,
  );
  const [optimisticWeekly, setOptimisticWeekly] = useOptimistic(weeklySummary);

  function pickUnits(next: UnitSystem) {
    startTransition(() => {
      setOptimisticUnits(next);
      void setUnitSystem(next);
    });
  }

  function pickTheme(next: ThemeId) {
    // Apply the theme to the document immediately via next-themes so the
    // user sees the colour swap without waiting on the server roundtrip.
    setNextTheme(next);
    startTransition(() => {
      setOptimisticTheme(next);
      void persistTheme(next);
    });
  }

  function flipDaily(value: boolean) {
    startTransition(() => {
      setOptimisticDaily(value);
      void setNotificationPreference("daily_reminder", value);
    });
  }
  function flipRegen(value: boolean) {
    startTransition(() => {
      setOptimisticRegen(value);
      void setNotificationPreference("regen_complete", value);
    });
  }
  function flipWeekly(value: boolean) {
    startTransition(() => {
      setOptimisticWeekly(value);
      void setNotificationPreference("weekly_summary", value);
    });
  }

  // Map the lowercase IDs to the labels the user sees in the segmented
  // controls; pickUnits/pickTheme translate back on click.
  const unitValue = UNIT_LABELS[optimisticUnits];
  const themeValue = THEME_LABELS[optimisticTheme];

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
        value={optimisticDaily}
        onChange={flipDaily}
        disabled={isPending}
      />
      <RowDivider />
      <ToggleRow
        label="Regeneration complete"
        sub="Notify when your plan is updated"
        value={optimisticRegen}
        onChange={flipRegen}
        disabled={isPending}
      />
      <RowDivider />
      <ToggleRow
        label="Weekly summary"
        sub="Sunday recap of the week's work"
        value={optimisticWeekly}
        onChange={flipWeekly}
        disabled={isPending}
      />
    </Group>
  );
}
