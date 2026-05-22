import { PhysioForm } from "@/app/_components/journal/PhysioForm";

export const dynamic = "force-dynamic";
// Save-and-regen on the physio form invokes previewPlan. Bump for
// Phase 2's heavier structured output.
export const maxDuration = 300;

export default function JournalPhysioPage() {
  return <PhysioForm />;
}
