import { getAthleteProfile, getRace } from "@/lib/supabase";
import { WizardClient } from "./_components/WizardClient";

export const dynamic = "force-dynamic";

export default async function WizardPage() {
  const [race, profile] = await Promise.all([getRace(), getAthleteProfile()]);
  return <WizardClient race={race} profile={profile} />;
}
