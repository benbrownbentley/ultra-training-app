"use client";

import { useMemo, useState } from "react";
import type { JournalEntry, JournalEntryType } from "@/lib/journal";
import { TabBar } from "@/app/_components/today/TabBar";
import { JournalHeader } from "./JournalHeader";
import { EntryCard } from "./EntryCard";
import { Chip } from "./atoms";
import { AddEntrySheets } from "./AddEntrySheets";
import { MotifTopo } from "@/app/_components/today/motifs";

type Filter = "all" | JournalEntryType;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "note", label: "Notes" },
  { id: "injury", label: "Injuries" },
  { id: "physio", label: "Physio" },
  { id: "travel", label: "Travel" },
];

interface Props {
  entries: JournalEntry[];
}

// Journal feed shell. Holds filter + add-sheet state; the actual entries
// list is filtered locally because we already paid the network cost to
// fetch the full list on the server.
export function JournalPageClient({ entries }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    if (filter === "all") return entries;
    return entries.filter((e) => e.type === filter);
  }, [entries, filter]);

  const isEmpty = entries.length === 0;

  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <JournalHeader />

      {isEmpty ? (
        <EmptyState onAdd={() => setAdding(true)} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[720px] flex-col">
            <div className="px-4 pt-5 pb-3 sm:px-5">
              <div
                className="mb-2.5 font-mono text-[11px] uppercase text-zinc-500"
                style={{ letterSpacing: "0.2em" }}
              >
                — JOURNAL
              </div>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {FILTERS.map((f) => (
                  <Chip
                    key={f.id}
                    active={f.id === filter}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="px-4 pb-3 sm:px-5">
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-zinc-200 px-4 text-sm font-medium text-zinc-950 transition hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-700"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Add to journal
              </button>
            </div>

            <div className="flex flex-col gap-2.5 px-4 pb-5 sm:px-5">
              {filtered.length === 0 ? (
                <div className="rounded-[12px] border border-dashed border-zinc-200 px-3.5 py-4 text-center text-[13px] text-zinc-500 dark:border-zinc-800">
                  No entries match this filter yet.
                </div>
              ) : (
                filtered.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <TabBar active="journal" />
      <AddEntrySheets open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="relative flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-55">
        <MotifTopo color="#10b981" opacity={0.1} />
      </div>
      <div className="relative mx-auto flex h-full w-full max-w-[720px] flex-col items-center justify-center px-6 py-12 text-center">
        <div
          className="font-mono text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
          style={{ letterSpacing: "0.2em" }}
        >
          — JOURNAL · EMPTY
        </div>
        <p className="m-0 mt-3.5 mb-6 max-w-[340px] text-[15.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          Capture anything that affects your training — recent feelings, travel
          plans, injury reports, or notes from your physio.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-11 w-[280px] items-center justify-center gap-2 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 5v14M5 12h14"
              stroke="#052e1f"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          Add your first entry
        </button>
      </div>
    </div>
  );
}
