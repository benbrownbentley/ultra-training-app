"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { createJournalEntry } from "@/app/actions";
import {
  BODY_PARTS,
  INJURY_RESTRICTIONS,
  PAIN_QUALITIES,
  type InjuryDetails,
  type InjurySide,
} from "@/lib/journal";
import { Chip, FormSectionLabel } from "./atoms";
import { SeveritySlider } from "./SeveritySlider";
import { TabBar } from "@/app/_components/today/TabBar";
import { JournalDetailHeader } from "./DetailHeader";
import { ArrowRight } from "@/app/_components/today/icons";

const SIDE_OPTIONS: Array<{ id: InjurySide; label: string }> = [
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "both", label: "Both" },
  { id: "na", label: "N/A" },
];

export function InjuryForm() {
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [side, setSide] = useState<InjurySide>("na");
  const [severity, setSeverity] = useState(3);
  const [painQuality, setPainQuality] = useState<string[]>([]);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [startedDate, setStartedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [checkBackIn, setCheckBackIn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleArr(value: string, list: string[], setter: (n: string[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  const submit = useCallback(
    (regenAfter: boolean) => {
      if (!bodyPart) {
        setError("Pick a body part so Claude knows where to back off.");
        return;
      }
      setError(null);
      const details: InjuryDetails = {
        body_part: bodyPart,
        side,
        severity,
        pain_quality: painQuality,
        started_date: startedDate || null,
        restrictions,
        check_back_in_days: checkBackIn ? Number(checkBackIn) : null,
      };
      startTransition(async () => {
        try {
          await createJournalEntry({
            type: "injury",
            entryDate: startedDate || undefined,
            body: notes,
            details,
            regenAfter,
          });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to save");
        }
      });
    },
    [bodyPart, side, severity, painQuality, restrictions, startedDate, notes, checkBackIn],
  );

  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <JournalDetailHeader />
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 pt-5 sm:px-5">
          <div>
            <div
              className="font-mono text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-400"
              style={{ letterSpacing: "0.2em" }}
            >
              — REPORT AN INJURY
            </div>
            <h1
              className="mt-1.5 text-[26px] font-medium leading-tight text-zinc-950 dark:text-zinc-50"
              style={{ letterSpacing: "-0.02em" }}
            >
              What&apos;s bothering you?
            </h1>
          </div>

          <FieldBlock label="BODY PART" required>
            <div className="flex flex-wrap gap-1.5">
              {BODY_PARTS.map((b) => (
                <Chip
                  key={b}
                  active={bodyPart === b}
                  onClick={() => setBodyPart(b)}
                  disabled={isPending}
                >
                  {b}
                </Chip>
              ))}
            </div>
          </FieldBlock>

          <FieldBlock label="SIDE">
            <div className="flex flex-wrap gap-1.5">
              {SIDE_OPTIONS.map((opt) => (
                <Chip
                  key={opt.id}
                  active={side === opt.id}
                  onClick={() => setSide(opt.id)}
                  disabled={isPending}
                >
                  {opt.label}
                </Chip>
              ))}
            </div>
          </FieldBlock>

          <SeveritySlider value={severity} onChange={setSeverity} disabled={isPending} />

          <FieldBlock label="PAIN QUALITY · multi-select">
            <div className="flex flex-wrap gap-1.5">
              {PAIN_QUALITIES.map((p) => (
                <Chip
                  key={p}
                  multi
                  active={painQuality.includes(p)}
                  onClick={() => toggleArr(p, painQuality, setPainQuality)}
                  disabled={isPending}
                >
                  {p}
                </Chip>
              ))}
            </div>
          </FieldBlock>

          <FieldBlock label="WHEN DID IT START?">
            <input
              type="date"
              value={startedDate}
              onChange={(e) => setStartedDate(e.target.value)}
              disabled={isPending}
              className="rounded-[10px] border border-zinc-200 bg-white px-3 py-3 text-[14px] text-zinc-950 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
            />
          </FieldBlock>

          <FieldBlock label="RESTRICTIONS · multi-select">
            <div className="flex flex-wrap gap-1.5">
              {INJURY_RESTRICTIONS.map((r) => (
                <Chip
                  key={r}
                  multi
                  active={restrictions.includes(r)}
                  onClick={() => toggleArr(r, restrictions, setRestrictions)}
                  disabled={isPending}
                >
                  {r}
                </Chip>
              ))}
            </div>
          </FieldBlock>

          <FieldBlock label="NOTES">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
              placeholder="What does it feel like? When is it worst?"
              rows={4}
              className="rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
            />
          </FieldBlock>

          <FieldBlock label="CHECK BACK IN">
            <div className="flex items-baseline gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={checkBackIn}
                onChange={(e) => setCheckBackIn(e.target.value)}
                disabled={isPending}
                placeholder="—"
                className="w-24 rounded-[10px] border border-zinc-200 bg-white px-3 py-3 text-[14px] text-zinc-950 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:focus:ring-emerald-500/10"
              />
              <span className="font-mono text-[11px] uppercase text-zinc-400 dark:text-zinc-600">
                days
              </span>
            </div>
          </FieldBlock>

          {error && (
            <div className="rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2 text-[12.5px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>

      <FormFooter
        disabled={isPending}
        onSave={() => submit(false)}
        onSaveAndRegen={() => submit(true)}
        saving={isPending}
      />
      <TabBar active="journal" />
    </div>
  );
}

function FieldBlock({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <FormSectionLabel required={required}>{label}</FormSectionLabel>
      {children}
    </div>
  );
}

function FormFooter({
  disabled,
  onSave,
  onSaveAndRegen,
  saving,
}: {
  disabled: boolean;
  onSave: () => void;
  onSaveAndRegen: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-zinc-200 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),18px)] sm:px-5 sm:pb-5 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={onSaveAndRegen}
          disabled={disabled}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-emerald-600 bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_22px_rgba(16,185,129,0.28)] transition active:scale-[0.97] hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save & regenerate plan"}
          {!saving && <ArrowRight color="#052e1f" size={16} />}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={disabled}
          className="inline-flex h-11 items-center justify-center rounded-[10px] border border-zinc-200 px-4 text-sm font-medium text-zinc-950 transition active:scale-[0.97] disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-50"
        >
          Save only
        </button>
      </div>
      <div className="flex justify-end">
        <Link
          href="/journal"
          className="text-[13px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
