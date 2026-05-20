import { notFound } from "next/navigation";
import { getRaceById } from "@/lib/supabase/server";
import { RaceForm } from "@/app/_components/profile/RaceForm";

export const dynamic = "force-dynamic";

// /profile/race/new opens a blank form. /profile/race/{numeric} loads an
// existing race row. Anything else 404s.
export default async function RaceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (id === "new") {
    return <RaceForm race={null} />;
  }
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();
  const race = await getRaceById(numericId);
  if (!race) notFound();
  return <RaceForm race={race} />;
}
