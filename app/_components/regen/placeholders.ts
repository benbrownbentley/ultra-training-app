// Placeholder content for the regen result screens. Real diff computation
// will replace these once the regen flow is split into preview + commit
// phases (today's flow commits in one shot). The content mirrors what the
// design canvas ships so the visual review matches.

import type { DayDiff } from "./atoms";

export interface WeekDiff {
  label: string;
  sub?: string;
  days: DayDiff[];
}

export const SUMMARY_RESULT =
  "I shifted your Saturday long run to Thursday to make room for your Friday flight, and reduced this week's total volume by 8% to give your right Achilles a lighter load while you ramp up calf strength work.";

export const SUMMARY_MINOR =
  "Your plan is holding up well. I made a few small adjustments based on your last 14 days — shifting two strength sessions to better recovery timing. No major changes needed.";

export const WEEK_6: WeekDiff = {
  label: "WEEK 6 OF 18",
  sub: "MON 16 — SUN 22 MAY",
  days: [
    { day: "Mon", kind: "unchanged", title: "Easy", primary: "8 km · Z1–Z2" },
    { day: "Tue", kind: "unchanged", title: "Tempo + Str A", primary: "12 km · 60 min · today" },
    { day: "Wed", kind: "added", title: "Calf Strength", primary: "15 min · Achilles" },
    { day: "Thu", kind: "changed", title: "Long Run", primary: "32 km · +1 420 m", was: "Easy 10 km" },
    { day: "Fri", kind: "unchanged", title: "Rest", primary: "travel · Vancouver → SF" },
    { day: "Sat", kind: "changed", title: "Calf Strength", primary: "15 min", was: "Long Run 32 km" },
    { day: "Sun", kind: "changed", title: "Rest", primary: "travel · SF", was: "Easy 12 km" },
  ],
};

export const WEEK_7: WeekDiff = {
  label: "WEEK 7 OF 18",
  sub: "MON 23 — SUN 29 MAY",
  days: [
    { day: "Mon", kind: "changed", title: "Easy", primary: "7 km", was: "8 km" },
    { day: "Tue", kind: "changed", title: "Tempo Run", primary: "11 km", was: "12 km" },
    { day: "Wed", kind: "changed", title: "Easy", primary: "9 km", was: "10 km" },
    { day: "Thu", kind: "changed", title: "Hills", primary: "13 km", was: "14 km" },
    { day: "Fri", kind: "unchanged", title: "Rest" },
    { day: "Sat", kind: "changed", title: "Long Run", primary: "30 km", was: "32 km" },
    { day: "Sun", kind: "changed", title: "Easy", primary: "11 km", was: "12 km" },
  ],
};

export const BASED_ON_ROWS = [
  {
    label: "LAST 14 DAYS",
    value: "11 workouts done · 2 skipped · avg pace within target",
  },
  {
    label: "JOURNAL NOTE",
    value: "Travel Fri 23 → Sun 25 May (Vancouver → SF) · added 15 May",
  },
  {
    label: "INJURY REPORT",
    value: "Right Achilles tightness · mild (3/10) · reported 12 May",
  },
  {
    label: "RACE TARGET",
    value: "UTMB 2026 · 18 weeks out · BUILD phase",
  },
];
