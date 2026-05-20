import Link from "next/link";
import { findEntry, type GlossaryEntry } from "@/lib/glossary";
import { MetricsRow } from "@/app/_components/workout/MetricsRow";

interface Props {
  entry: GlossaryEntry;
}

// Renders a single glossary entry. Pure presentational — caller provides
// the loaded entry and chrome (header + tab bar).
export function GlossaryEntryView({ entry }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 pt-5 pb-4 sm:px-5">
      <div>
        <div
          className="font-mono text-[11px] uppercase text-zinc-500"
          style={{ letterSpacing: "0.2em" }}
        >
          — GLOSSARY · {entry.eyebrow}
        </div>
        <h1
          className="m-0 mt-2 text-[32px] font-medium leading-[1.1] text-zinc-950 dark:text-zinc-50"
          style={{ letterSpacing: "-0.025em" }}
        >
          {entry.title}
        </h1>
        <p className="m-0 mt-1.5 text-[15.5px] leading-snug text-zinc-600 dark:text-zinc-400">
          {entry.tagline}
        </p>
      </div>

      <div className="-mx-4 sm:-mx-5">
        <MetricsRow items={entry.facts} />
      </div>

      <EntrySection label="WHAT IT IS">
        <BodyBlock paragraphs={entry.whatItIs} />
      </EntrySection>

      <EntrySection label="WHAT IT DOES">
        <BodyBlock paragraphs={entry.whatItDoes} />
      </EntrySection>

      <EntrySection label="HOW TO EXECUTE IT WELL">
        <BodyBlock paragraphs={entry.howToExecute} />
      </EntrySection>

      <CommonMistakes items={entry.commonMistakes} />

      {entry.seeAlso.length > 0 && <SeeAlso slugs={entry.seeAlso} />}
    </div>
  );
}

function EntrySection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <span
        className="font-mono text-[10.5px] font-semibold uppercase text-zinc-500"
        style={{ letterSpacing: "0.2em" }}
      >
        — {label}
      </span>
      {children}
    </section>
  );
}

function BodyBlock({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="flex flex-col gap-3.5">
      {paragraphs.map((p, i) => (
        <p
          key={i}
          className="m-0 text-[14.5px] font-normal leading-relaxed text-zinc-950 dark:text-zinc-50"
        >
          {p}
        </p>
      ))}
    </div>
  );
}

function CommonMistakes({ items }: { items: string[] }) {
  return (
    <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3.5 dark:border-amber-500/30 dark:bg-amber-500/[0.08]">
      <span
        className="font-mono text-[10.5px] font-semibold uppercase text-amber-700 dark:text-amber-400"
        style={{ letterSpacing: "0.2em" }}
      >
        — COMMON MISTAKES
      </span>
      <ul className="m-0 mt-2.5 flex list-none flex-col gap-2 p-0">
        {items.map((it, i) => (
          <li
            key={i}
            className="grid grid-cols-[12px_1fr] gap-2 text-[13.5px] leading-snug text-zinc-950 dark:text-zinc-50"
          >
            <span className="pt-0.5 font-mono text-amber-700 dark:text-amber-400">
              ›
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SeeAlso({ slugs }: { slugs: string[] }) {
  const items = slugs.map((s) => findEntry(s)).filter(Boolean) as GlossaryEntry[];
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <span
        className="font-mono text-[10.5px] uppercase text-zinc-500"
        style={{ letterSpacing: "0.2em" }}
      >
        — SEE ALSO
      </span>
      <div className="flex flex-wrap gap-2">
        {items.map((entry) => (
          <Link
            key={entry.slug}
            href={`/profile/glossary/${entry.slug}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-2 text-[13px] font-medium text-zinc-950 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-[#0f0f11] dark:text-zinc-50 dark:hover:border-zinc-700"
          >
            {entry.title}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path
                d="M8 16 L16 8 M10 8 H16 V14"
                stroke="#047857"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
