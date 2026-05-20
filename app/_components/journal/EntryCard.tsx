"use client";

import { useState, useTransition } from "react";
import { deleteJournalEntry } from "@/app/actions";
import { createPortal } from "react-dom";
import type { JournalEntry } from "@/lib/journal";
import { ConsumedBadge } from "./atoms";
import {
  entryDetailRows,
  entryTitle,
  formatEntryDate,
  typeLabel,
} from "./entry-summary";

interface Props {
  entry: JournalEntry;
}

// Single entry in the feed. Tap to expand → reveals structured detail
// rows + Edit/Delete affordances. Delete fires a confirmation sheet
// before the destructive write.
export function EntryCard({ entry }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const title = entryTitle(entry);
  const rows = entryDetailRows(entry);

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`block w-full rounded-[14px] border bg-white px-4 py-3.5 text-left transition dark:bg-[#0f0f11] ${
          expanded
            ? "border-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.10)]"
            : "border-zinc-200 dark:border-zinc-800"
        }`}
      >
        <div className="mb-1.5 flex items-start justify-between gap-2.5">
          <span
            className="whitespace-nowrap font-mono text-[10px] uppercase text-zinc-500"
            style={{ letterSpacing: "0.2em" }}
          >
            — {typeLabel(entry)} · {formatEntryDate(entry.entry_date)}
          </span>
          <ConsumedBadge consumed={entry.consumed} />
        </div>
        {title && (
          <h3
            className="m-0 mb-1 text-[15.5px] font-medium leading-snug text-zinc-950 dark:text-zinc-50"
            style={{ letterSpacing: "-0.005em" }}
          >
            {title}
          </h3>
        )}
        {entry.body && (
          <p
            className={`m-0 text-[13.5px] leading-snug text-zinc-600 dark:text-zinc-400 ${
              expanded ? "" : "line-clamp-2"
            }`}
          >
            {entry.body}
          </p>
        )}

        {!expanded && (
          <div className="mt-2 flex items-center justify-end">
            <span
              className="inline-flex items-center gap-1 font-mono text-[9.5px] font-semibold uppercase text-zinc-400 dark:text-zinc-600"
              style={{ letterSpacing: "0.18em" }}
            >
              TAP TO EXPAND
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        )}

        {expanded && rows.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {rows.map((r, i) => (
              <div
                key={r.label}
                className={`grid grid-cols-[auto_1fr] gap-2.5 py-1.5 ${
                  i === 0 ? "border-t border-zinc-200 dark:border-zinc-800" : ""
                }`}
              >
                <span
                  className="whitespace-nowrap pt-[2px] font-mono text-[10px] font-semibold uppercase text-zinc-500"
                  style={{ letterSpacing: "0.18em" }}
                >
                  {r.label}
                </span>
                <span className="font-mono text-[12.5px] leading-snug text-zinc-950 dark:text-zinc-50">
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {expanded && (
          <div
            className="mt-3.5 flex items-center justify-between gap-2.5 border-t border-zinc-200 pt-3 dark:border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="inline-flex h-9 cursor-default items-center justify-center rounded-md border border-dashed border-zinc-200 px-3 text-[13px] font-medium text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
              Edit (coming soon)
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(true);
              }}
              className="bg-transparent text-[13px] font-medium text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-500"
            >
              Delete
            </button>
          </div>
        )}
      </button>
      {confirmDelete && (
        <DeleteConfirm
          id={entry.id}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

// Bottom-sheet confirmation for the destructive delete. Portaled so it
// covers the whole viewport rather than only the feed scroller.
function DeleteConfirm({ id, onClose }: { id: number; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function fire() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteJournalEntry(id);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete entry");
      }
    });
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 font-sans">
      <button
        type="button"
        aria-label="Close"
        onClick={isPending ? undefined : onClose}
        className="absolute inset-0 bg-zinc-950/45 dark:bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute right-0 bottom-0 left-0 rounded-t-[20px] bg-zinc-50 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),22px)] shadow-[0_-16px_48px_rgba(0,0,0,0.35)] sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2 sm:w-[440px] sm:max-w-[92%] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-zinc-200 sm:p-6 dark:bg-zinc-950 dark:sm:border-zinc-800"
      >
        <div className="flex justify-center pb-3.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <h2
          className="m-0 mb-1.5 text-[20px] font-medium text-zinc-950 dark:text-zinc-50"
          style={{ letterSpacing: "-0.015em" }}
        >
          Delete this entry?
        </h2>
        <p className="m-0 mb-5 text-sm leading-snug text-zinc-600 dark:text-zinc-400">
          It won&apos;t be considered in future plan updates.
        </p>
        {error && (
          <div className="mb-3 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2 text-[12.5px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-[10px] border border-zinc-200 px-4 text-sm font-medium text-zinc-950 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={fire}
            disabled={isPending}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-[10px] border border-red-700 bg-red-600 px-4 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(220,38,38,0.28)] transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
