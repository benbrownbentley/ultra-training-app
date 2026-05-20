import { getAthleteProfile } from "@/lib/supabase/server";
import { AthleteForm } from "@/app/_components/profile/AthleteForm";

export const dynamic = "force-dynamic";

export default async function AthletePage() {
  const profile = await getAthleteProfile();
  return <AthleteForm profile={profile} />;
}
