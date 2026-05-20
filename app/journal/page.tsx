import { listJournalEntries } from "@/lib/supabase/server";
import { JournalPageClient } from "@/app/_components/journal/JournalPageClient";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const entries = await listJournalEntries();
  return <JournalPageClient entries={entries} />;
}
