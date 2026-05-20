// Inline SVG icons used across the Today screen. All icons inherit a single
// `color` prop so they pick up the surrounding theme token at the call site.

import type { WorkoutKind } from "@/lib/plan";

type IconProps = { color?: string; size?: number };

export function VertLogo({
  size = "md",
  textColor = "currentColor",
  accent = "#10b981",
}: {
  size?: "md" | "lg";
  textColor?: string;
  accent?: string;
}) {
  const big = size === "lg";
  return (
    <div className="flex items-center" style={{ gap: big ? 10 : 8 }}>
      <svg width={big ? 22 : 18} height={big ? 22 : 18} viewBox="0 0 24 24" fill="none">
        <path
          d="M2 18 L7 10 L11 14 L15 6 L19 12 L22 8"
          stroke={accent}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="15" cy="6" r="1.8" fill={accent} />
      </svg>
      <span
        className="font-mono font-semibold uppercase"
        style={{
          fontSize: big ? 14 : 12,
          letterSpacing: "0.14em",
          color: textColor,
        }}
      >
        VERT
      </span>
    </div>
  );
}

export function ChevronUpRight({ color = "currentColor", size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M8 16 L16 8 M10 8 H16 V14"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowRight({ color = "currentColor", size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckCircle({ color = "#10b981", size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" />
      <path
        d="M8 12.5l2.5 2.5L16 9"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckMini({ color = "#10b981", size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.6" />
      <path
        d="M8 12.5l2.5 2.5L16 9"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRun({ color = "currentColor" }: IconProps) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24">
      <path
        d="M3 17 L8 9 L11 13 L16 5 L21 11"
        stroke={color}
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconStrength({ color = "currentColor" }: IconProps) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24">
      <path
        d="M5 12h14M3 9v6M7 7v10M17 7v10M21 9v6"
        stroke={color}
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMobility({ color = "currentColor" }: IconProps) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24">
      <path
        d="M4 18 C 8 12, 14 12, 20 6"
        stroke={color}
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconRest({ color = "currentColor" }: IconProps) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24">
      <path
        d="M20 14a8 8 0 11-9.5-9.5A6.5 6.5 0 0020 14z"
        stroke={color}
        strokeWidth="1.6"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WorkoutKindIcon({
  kind,
  color,
}: {
  kind: WorkoutKind | null;
  color?: string;
}) {
  if (!kind) return <IconRest color={color} />;
  if (kind === "run") return <IconRun color={color} />;
  if (kind === "gym") return <IconStrength color={color} />;
  return <IconMobility color={color} />;
}

export function TabToday({ color = "currentColor", size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth="1.6" />
      <path d="M3 9h18M8 3v4M16 3v4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="14" r="2" fill={color} />
    </svg>
  );
}

export function TabPlan({ color = "currentColor", size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 18 L7 10 L11 14 L15 6 L19 12 L21 9"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TabJournal({ color = "currentColor", size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 9h7M8 13h5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function TabProfile({ color = "currentColor", size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth="1.6" />
      <path
        d="M5 20c1.2-3.4 4-5 7-5s5.8 1.6 7 5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RegenIcon({ color = "currentColor", size = 11 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 12a9 9 0 1015.46-6.36L21 8M21 3v5h-5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
