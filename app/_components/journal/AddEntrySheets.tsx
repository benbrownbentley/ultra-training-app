"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { createJournalEntry } from "@/app/actions";
import { ArrowRight } from "@/app/_components/today/icons";
import {
  IMPACT_LABELS,
  type ImpactChoice,
  type TravelDetails,
} from "@/lib/journal";
import { Chip, FormSectionLabel } from "./atoms";

type Step = "picker" | "note" | "travel";

const IMPACT_ORDER: ImpactChoice[] = [
  "no_running",
  "no_gym",
  "light_only",
  "normal",
  "depends",
];

interface Props {
  open: boolean;
  onClose: () => void;
}

// Stays-false during SSR/hydration so the portal never targets a missing
// document. Avoids the setState-in-effect lint warning.
const noopSubscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

// Orchestrates the "Add to journal" interaction. First mounts the type
// picker; choosing note/travel swaps the inner step in place. Choosing
// injury/physio navigates to the dedicated route (closed via onClose
// after the navigation kicks off).
export function AddEntrySheets({ open, onClose }: Props) {
  const isClient = useIsClient();
  if (!open || !isClient) return null;
  return createPortal(<SheetShell onClose={onClose} />, document.body);
}

function SheetShell({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("picker");
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();

  // Lock body scroll while the sheet is open + close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
    };
  }, [onClose]);

  function pick(type: "note" | "travel" | "injury" | "physio") {
    if (type === "injury" || type === "physio") {
      setIsNavigating(true);
      router.push(`/journal/${type}`);
      return;
    }
    setStep(type);
  }

  const titleId = "add-entry-title";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 font-sans"
    >
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-zinc-50 dark:bg-zinc-950" />
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute inset-0 bg-zinc-950/35 backdrop-blur-sm dark:bg-black/55"
        />
      </div>
      <div
        className={[
          "absolute left-0 right-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[20px] bg-zinc-50 text-zinc-950 shadow-[0_-16px_48px_rgba(0,0,0,0.35)] dark:bg-zinc-950 dark:text-zinc-50",
          "sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-1/2 sm:max-h-[88dvh] sm:w-[520px] sm:max-w-[92%] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-zinc-200 sm:shadow-[0_24px_64px_rgba(0,0,0,0.45)] sm:dark:border-zinc-800",
        ].join(" ")}
      >
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {step === "picker" && (
          <PickerStep
            titleId={titleId}
            onPick={pick}
            onClose={onClose}
            disabled={isNavigating}
          />
        )}
        {step === "note" && (
          <NoteStep
            titleId={titleId}
            onClose={onClose}
            onBack={() => setStep("picker")}
          />
        )}
        {step === "travel" && (
          <TravelStep
            titleId={titleId}
            onClose={onClose}
            onBack={() => setStep("picker")}
          />
        )}
      </div>
    </div>
  );
}

const TYPE_ROWS: Array<{
  id: "note" | "injury" | "physio" | "travel";
  label: string;
  sub: string;
  Icon: () => React.ReactElement;
}> = [
  {
    id: "note",
    label: "Note",
    sub: "A thought or observation about training",
    Icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 7h16M4 12h10M4 17h7"
          stroke="#10b981"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "injury",
    label: "Injury",
    sub: "Report something hurting",
    Icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M19 5L5 19M5 5l14 14"
          stroke="#10b981"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="3" stroke="#10b981" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    id: "physio",
    label: "Physio",
    sub: "Notes from your physio",
    Icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 12h6m4 0h4M9 4h6M9 20h6M11 4v4m2-4v4m-2 8v4m2-4v4"
          stroke="#10b981"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="13" cy="12" r="2.5" stroke="#10b981" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    id: "travel",
    label: "Travel",
    sub: "Trips or events that affect training",
    Icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M16 10h4a2 2 0 010 4h-4l-4 7h-3l2-7H7l-2 2H3l2-4-2-4h2l2 2h4l-2-7h3z"
          stroke="#10b981"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function PickerStep({
  titleId,
  onPick,
  onClose,
  disabled,
}: {
  titleId: string;
  onPick: (id: "note" | "injury" | "physio" | "travel") => void;
  onClose: () => void;
  disabled: boolean;
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 pt-3.5 pb-3 sm:px-6 sm:pt-6">
        <div
          id={titleId}
          className="font-mono text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
          style={{ letterSpacing: "0.2em" }}
        >
          — ADD TO JOURNAL
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {TYPE_ROWS.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onPick(row.id)}
              disabled={disabled}
              className="flex w-full items-center gap-3.5 rounded-[12px] border border-zinc-200 bg-white px-4 py-3.5 text-left disabled:opacity-50 dark:border-zinc-800 dark:bg-[#0f0f11]"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/[0.08]">
                <row.Icon />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-medium text-zinc-950 dark:text-zinc-50">
                  {row.label}
                </span>
                <span className="text-[12.5px] leading-snug text-zinc-600 dark:text-zinc-400">
                  {row.sub}
                </span>
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-zinc-400 dark:text-zinc-600"
                />
              </svg>
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center border-t border-zinc-200 px-5 pt-2.5 pb-[max(env(safe-area-inset-bottom),18px)] sm:px-6 sm:pb-5 dark:border-zinc-800">
        <button
          type="button"
          onClick={onClose}
          className="bg-transparent text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          Cancel
        </button>
      </div>
    </>
  );
}

function NoteStep({
  titleId,
  onClose,
  onBack,
}: {
  titleId: string;
  onClose: () => void;
  onBack: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => window.clearTimeout(handle);
  }, []);

  const submit = useCallback(
    (regenAfter: boolean) => {
      if (!body.trim()) {
        setError("Note can't be empty.");
        return;
      }
      setError(null);
      startTransition(async () => {
        try {
          await createJournalEntry({
            type: "note",
            body,
            regenAfter,
          });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to save");
        }
      });
    },
    [body],
  );

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 pt-3.5 pb-3 sm:px-6 sm:pt-6">
        <div className="mb-3 flex items-center gap-2">
          <BackChip onClick={onBack} />
          <div
            id={titleId}
            className="font-mono text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
            style={{ letterSpacing: "0.2em" }}
          >
            — NEW NOTE
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isPending}
          placeholder={`What should we know? e.g., "Feeling strong this week. Achilles slightly better. Push the volume?"`}
          rows={6}
          className="block w-full rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14.5px] leading-snug text-zinc-950 placeholder:italic placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:placeholder:text-zinc-600 dark:focus:ring-emerald-500/10"
          style={{ minHeight: 124 }}
        />
        {error && (
          <div className="mt-3 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2 text-[12.5px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
      <SheetFooter
        onClose={onClose}
        disabled={isPending}
        primary={
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        }
        secondary={
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-[10px] border border-zinc-200 px-4 text-sm font-medium text-zinc-950 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-50"
          >
            Save & regen
          </button>
        }
      />
    </>
  );
}

function TravelStep({
  titleId,
  onClose,
  onBack,
}: {
  titleId: string;
  onClose: () => void;
  onBack: () => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState<ImpactChoice[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const startId = useId();
  const endId = useId();
  const descId = useId();

  function toggleImpact(choice: ImpactChoice) {
    setImpact((prev) =>
      prev.includes(choice)
        ? prev.filter((p) => p !== choice)
        : [...prev, choice],
    );
  }

  const submit = useCallback(() => {
    if (!startDate) {
      setError("Start date is required.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    setError(null);
    const details: TravelDetails = {
      start_date: startDate,
      end_date: endDate || startDate,
      impact,
    };
    startTransition(async () => {
      try {
        await createJournalEntry({
          type: "travel",
          entryDate: startDate,
          body:
            notes.trim().length > 0
              ? `${description.trim()}\n${notes.trim()}`
              : description.trim(),
          details,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }, [startDate, endDate, description, impact, notes]);

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 pt-3.5 pb-3 sm:px-6 sm:pt-6">
        <div className="mb-3 flex items-center gap-2">
          <BackChip onClick={onBack} />
          <div
            id={titleId}
            className="font-mono text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
            style={{ letterSpacing: "0.2em" }}
          >
            — ADD TRAVEL OR EVENT
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <DateField
            id={startId}
            label="START"
            value={startDate}
            onChange={setStartDate}
            disabled={isPending}
          />
          <DateField
            id={endId}
            label="END"
            value={endDate}
            onChange={setEndDate}
            placeholder="Defaults to start"
            disabled={isPending}
          />
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <FormSectionLabel>DESCRIPTION</FormSectionLabel>
          <input
            id={descId}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending}
            placeholder="e.g. Vancouver to SF for a wedding"
            className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
          />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <FormSectionLabel>TRAINING IMPACT</FormSectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {IMPACT_ORDER.map((choice) => (
              <Chip
                key={choice}
                active={impact.includes(choice)}
                multi
                onClick={() => toggleImpact(choice)}
                disabled={isPending}
              >
                {IMPACT_LABELS[choice]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <FormSectionLabel>NOTES</FormSectionLabel>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isPending}
            placeholder="Anything else worth noting?"
            rows={3}
            className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
          />
        </div>
        {error && (
          <div className="mt-3 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2 text-[12.5px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
      <SheetFooter
        onClose={onClose}
        disabled={isPending}
        primary={
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save"}
            {!isPending && <ArrowRight color="#052e1f" size={16} />}
          </button>
        }
      />
    </>
  );
}

function BackChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-transparent px-2 py-[3px] font-mono text-[10px] font-medium uppercase text-zinc-500 hover:text-zinc-900 dark:border-zinc-800 dark:hover:text-zinc-50"
      style={{ letterSpacing: "0.14em" }}
      aria-label="Back to type picker"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <path
          d="M14 6l-6 6 6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      BACK
    </button>
  );
}

function SheetFooter({
  onClose,
  primary,
  secondary,
  disabled,
}: {
  onClose: () => void;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-5 pt-2.5 pb-[max(env(safe-area-inset-bottom),18px)] sm:px-6 sm:pb-5 dark:border-zinc-800">
      <button
        type="button"
        onClick={onClose}
        disabled={disabled}
        className="bg-transparent text-sm font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-50"
      >
        Cancel
      </button>
      <div className="flex items-center gap-2">
        {secondary}
        {primary}
      </div>
    </div>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id}>
        <FormSectionLabel>{label}</FormSectionLabel>
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="rounded-[10px] border border-zinc-200 bg-white px-3 py-3 text-[14px] text-zinc-950 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
      />
    </div>
  );
}
