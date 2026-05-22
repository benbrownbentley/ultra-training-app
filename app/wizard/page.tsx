import { WizardClient } from "./_components/WizardClient";

export const dynamic = "force-dynamic";
// submitWizard runs Claude to generate the initial plan. Phase 2's
// structured output makes generation token-heavy; 300s gives Claude
// room to finish on long ultra plans.
export const maxDuration = 300;

// The wizard is intake-only — initialised from scratch every time. Edits to
// an already-configured profile live under /profile/athlete and /profile/race.
export default function WizardPage() {
  return <WizardClient />;
}
