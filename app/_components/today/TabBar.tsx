import Link from "next/link";
import { TabJournal, TabPlan, TabProfile, TabToday } from "./icons";

type TabId = "today" | "plan" | "journal" | "profile";

interface TabSpec {
  id: TabId;
  label: string;
  href: string;
  Icon: (p: { color?: string; size?: number }) => React.ReactElement;
}

const TABS: TabSpec[] = [
  { id: "today", label: "TODAY", href: "/", Icon: TabToday },
  { id: "plan", label: "PLAN", href: "/plan", Icon: TabPlan },
  { id: "journal", label: "JOURNAL", href: "/journal", Icon: TabJournal },
  { id: "profile", label: "PROFILE", href: "/profile", Icon: TabProfile },
];

// Persistent bottom navigation. Inactive tabs link to routes that don't
// exist yet — they'll 404 today and stop 404'ing as those routes ship.
export function TabBar({ active = "today" }: { active?: TabId }) {
  return (
    <div className="grid grid-cols-4 border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      {TABS.map((tab) => {
        const isOn = tab.id === active;
        const color = isOn ? "#10b981" : "rgb(113 113 122)";
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className="flex flex-col items-center gap-1 pt-2.5 pb-3.5"
            aria-current={isOn ? "page" : undefined}
          >
            <tab.Icon color={color} />
            <span
              className={`font-mono text-[9.5px] uppercase ${
                isOn
                  ? "font-semibold text-emerald-500"
                  : "font-medium text-zinc-500"
              }`}
              style={{ letterSpacing: "0.12em" }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
