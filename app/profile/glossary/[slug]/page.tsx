import { notFound } from "next/navigation";
import { ENTRIES, findEntry } from "@/lib/glossary";
import { TabBar } from "@/app/_components/today/TabBar";
import { ProfileDetailHeader } from "@/app/_components/profile/DetailHeader";
import { GlossaryEntryView } from "@/app/_components/profile/GlossaryEntry";

export const dynamic = "force-static";

// Static for every known slug. Anything else 404s.
export function generateStaticParams() {
  return ENTRIES.map((e) => ({ slug: e.slug }));
}

export default async function GlossaryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = findEntry(slug);
  if (!entry) notFound();

  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <ProfileDetailHeader
        backHref="/profile/glossary"
        backLabel="GLOSSARY"
      />
      <div className="flex-1 overflow-y-auto">
        <GlossaryEntryView entry={entry} />
      </div>
      <TabBar active="profile" />
    </div>
  );
}
