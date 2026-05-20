import { notFound } from "next/navigation";
import { StateGenerating } from "@/app/_components/regen/StateGenerating";
import { StateResult } from "@/app/_components/regen/StateResult";
import { StateMinor } from "@/app/_components/regen/StateMinor";
import { StateAccepted } from "@/app/_components/regen/StateAccepted";
import { StateError } from "@/app/_components/regen/StateError";

export const dynamic = "force-dynamic";

type RegenState = "generating" | "result" | "minor" | "accepted" | "error";

const VALID_STATES: ReadonlySet<RegenState> = new Set([
  "generating",
  "result",
  "minor",
  "accepted",
  "error",
]);

// Visual-only route for now. `?state=` toggles between the 5 designs while
// we figure out how the real regen flow (currently single-shot) splits
// into preview + commit. Defaults to the main Result view.
export default async function RegenPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const resolved: RegenState =
    state && VALID_STATES.has(state as RegenState)
      ? (state as RegenState)
      : "result";

  switch (resolved) {
    case "generating":
      return <StateGenerating />;
    case "result":
      return <StateResult />;
    case "minor":
      return <StateMinor />;
    case "accepted":
      return <StateAccepted />;
    case "error":
      return <StateError />;
    default:
      notFound();
  }
}
