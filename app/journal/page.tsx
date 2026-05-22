import { listJournalEntries } from "@/lib/supabase/server";
import { JournalPageClient } from "@/app/_components/journal/JournalPageClient";

export const dynamic = "force-dynamic";
// Add-entry sheets on this page can save-and-regen, which invokes
// previewPlan. Bump for Phase 2's heavier structured output.
export const maxDuration = 300;

export default async function JournalPage() {
  const entries = await listJournalEntries();
  return <JournalPageClient entries={entries} />;
}
