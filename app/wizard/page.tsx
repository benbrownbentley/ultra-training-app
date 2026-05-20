import { WizardClient } from "./_components/WizardClient";

export const dynamic = "force-dynamic";

// The wizard is intake-only — initialised from scratch every time. Edits to
// an already-configured profile live under /profile/athlete and /profile/race.
export default function WizardPage() {
  return <WizardClient />;
}
