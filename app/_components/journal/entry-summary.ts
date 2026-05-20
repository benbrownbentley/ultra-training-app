// Derives the user-facing title + structured detail rows from a
// JournalEntry. Pure formatting that the feed and the expanded card both
// consume so the visible copy stays identical across the two surfaces.

import { IMPACT_LABELS, type JournalEntry } from "@/lib/journal";

const TYPE_LABEL: Record<JournalEntry["type"], string> = {
  note: "NOTE",
  travel: "TRAVEL",
  injury: "INJURY",
  physio: "PHYSIO",
};

// Format an ISO date as the design's "17 MAY" eyebrow chunk.
export function formatEntryDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    })
    .toUpperCase();
}

// Longer "Fri 23 — Sun 25 May 2026" form used inside expanded details.
function formatRange(startIso: string, endIso: string): string {
  if (!startIso) return "—";
  const start = new Date(startIso + "T00:00:00Z");
  const end = endIso ? new Date(endIso + "T00:00:00Z") : start;
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  };
  if (startIso === endIso || !endIso) {
    return start.toLocaleDateString("en-US", opts);
  }
  const startStr = start.toLocaleDateString("en-US", {
    weekday: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
  const endStr = end.toLocaleDateString("en-US", opts);
  return `${startStr} — ${endStr}`;
}

export function typeLabel(entry: JournalEntry): string {
  return TYPE_LABEL[entry.type];
}

// Picks the best title for the card. Notes inherit their body's first
// sentence; structured entries derive from their fields.
export function entryTitle(entry: JournalEntry): string | null {
  if (entry.title) return entry.title;
  if (entry.type === "injury" && entry.details) {
    const sideLabel =
      entry.details.side === "na"
        ? ""
        : entry.details.side.charAt(0).toUpperCase() +
          entry.details.side.slice(1);
    return `${sideLabel ? `${sideLabel} ` : ""}${entry.details.body_part}`;
  }
  if (entry.type === "physio" && entry.details) {
    const who = entry.details.physio_name
      ? `${entry.details.physio_name} — `
      : "";
    return `${who}${entry.details.diagnosis}`;
  }
  if (entry.type === "travel" && entry.body) {
    return entry.body.split(/[.\n]/)[0].trim();
  }
  return null;
}

export interface DetailRow {
  label: string;
  value: string;
}

// Detail rows shown when the card is expanded. Mirrors the layout in the
// design's State D · Entry expanded mock.
export function entryDetailRows(entry: JournalEntry): DetailRow[] {
  if (entry.type === "travel" && entry.details) {
    const d = entry.details;
    const impactLabels = d.impact
      .map((i) => IMPACT_LABELS[i] ?? i)
      .join(" · ");
    const rows: DetailRow[] = [
      { label: "DATES", value: formatRange(d.start_date, d.end_date) },
    ];
    if (impactLabels) rows.push({ label: "IMPACT", value: impactLabels });
    if (entry.body) rows.push({ label: "NOTES", value: entry.body });
    return rows;
  }
  if (entry.type === "injury" && entry.details) {
    const d = entry.details;
    const rows: DetailRow[] = [
      {
        label: "BODY PART",
        value: `${d.body_part}${d.side !== "na" ? ` · ${d.side.charAt(0).toUpperCase() + d.side.slice(1)}` : ""}`,
      },
      { label: "SEVERITY", value: `${d.severity} / 10` },
    ];
    if (d.pain_quality.length > 0) {
      rows.push({ label: "PAIN QUALITY", value: d.pain_quality.join(" · ") });
    }
    if (d.started_date) {
      rows.push({ label: "STARTED", value: formatRange(d.started_date, "") });
    }
    if (d.restrictions.length > 0) {
      rows.push({ label: "RESTRICTIONS", value: d.restrictions.join(" · ") });
    }
    return rows;
  }
  if (entry.type === "physio" && entry.details) {
    const d = entry.details;
    const rows: DetailRow[] = [];
    if (d.physio_name) rows.push({ label: "PHYSIO", value: d.physio_name });
    if (d.visit_date) rows.push({ label: "VISIT", value: formatRange(d.visit_date, "") });
    rows.push({ label: "DIAGNOSIS", value: d.diagnosis });
    if (d.exercises.length > 0) {
      const ex = d.exercises
        .map(
          (e) =>
            `${e.name} (${e.sets_reps}${e.load ? ` @ ${e.load}` : ""}${
              e.frequency ? ` · ${e.frequency}` : ""
            })`,
        )
        .join("; ");
      rows.push({
        label: "PROGRAM",
        value: ex || "—",
      });
    }
    if (d.duration_value && d.duration_unit === "weeks") {
      rows.push({ label: "DURATION", value: `${d.duration_value} weeks` });
    } else if (d.duration_unit === "until_resolved") {
      rows.push({ label: "DURATION", value: "Until symptoms resolve" });
    }
    if (d.restrictions.length > 0) {
      rows.push({ label: "RESTRICTIONS", value: d.restrictions.join(" · ") });
    }
    return rows;
  }
  return [];
}
