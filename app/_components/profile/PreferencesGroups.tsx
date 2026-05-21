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
  // Toggles fire optimistically — no isPending gate. If the action
  // fails, the catch path rolls back state and shows the inline error.
  const [, startTransition] = useTransition();

  const [units, setUnits] = useState<UnitSystem>(unitSystem);
  const [themeId, setThemeId] = useState<ThemeId>(theme);
  const [daily, setDaily] = useState(dailyReminder);
  const [regen, setRegen] = useState(regenCompleteNotify);
  const [weekly, setWeekly] = useState(weeklySummary);
  // Surfaces any persist failure inline so the toggle doesn't silently
  // diverge from server state. Cleared the next time the user pokes a row.
  const [error, setError] = useState<string | null>(null);

  // Preferences actions return a result object instead of throwing, so
  // production builds don't swallow the real error message. Failure
  // rolls local state back AND surfaces the friendly inline message.
  // The full server error (incl. code + hint) is logged to the console
  // so future schema mismatches are easy to triage from devtools.
  function describe(
    r: { ok: false; error: string; code?: string; hint?: string },
  ): string {
    console.error("[Preferences] save failed", r);
    return "Couldn't save — try again.";
  }

  function pickUnits(next: UnitSystem) {
    const prev = units;
    setUnits(next);
    setError(null);
    startTransition(async () => {
      try {
        const r = await setUnitSystem(next);
        if (!r.ok) {
          setUnits(prev);
          setError(describe(r));
        }
      } catch (e) {
        console.error("Failed to save units", e);
        setUnits(prev);
        setError("Couldn't save — try again.");
      }
    });
  }

  function pickTheme(next: ThemeId) {
    const prev = themeId;
    setThemeId(next);
    setNextTheme(next);
    setError(null);
    startTransition(async () => {
      try {
        const r = await persistTheme(next);
        if (!r.ok) {
          setThemeId(prev);
          setNextTheme(prev);
          setError(describe(r));
        }
      } catch (e) {
        console.error("Failed to save theme", e);
        setThemeId(prev);
        setNextTheme(prev);
        setError("Couldn't save — try again.");
      }
    });
  }

  function flipDaily(value: boolean) {
    const prev = daily;
    setDaily(value);
    setError(null);
    startTransition(async () => {
      try {
        const r = await setNotificationPreference("daily_reminder", value);
        if (!r.ok) {
          setDaily(prev);
          setError(describe(r));
        }
      } catch (e) {
        console.error("Failed to save daily reminder", e);
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
      try {
        const r = await setNotificationPreference("regen_complete", value);
        if (!r.ok) {
          setRegen(prev);
          setError(describe(r));
        }
      } catch (e) {
        console.error("Failed to save regen notify", e);
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
      try {
        const r = await setNotificationPreference("weekly_summary", value);
        if (!r.ok) {
          setWeekly(prev);
          setError(describe(r));
        }
      } catch (e) {
        console.error("Failed to save weekly summary", e);
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
