import { InjuryForm } from "@/app/_components/journal/InjuryForm";

export const dynamic = "force-dynamic";
// Save-and-regen on the injury form invokes previewPlan. Bump for
// Phase 2's heavier structured output.
export const maxDuration = 300;

export default function JournalInjuryPage() {
  return <InjuryForm />;
}
