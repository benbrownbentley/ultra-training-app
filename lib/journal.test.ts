import { describe, expect, it } from "vitest";
import type {
  InjuryEntry,
  JournalEntry,
  PhysioEntry,
  TravelEntry,
} from "@/lib/journal";
import { IMPACT_LABELS } from "@/lib/journal";

// Light type-narrowing test — the goal is to catch any future change
// that breaks the discriminated union, not to exercise behaviour.
function describeEntry(e: JournalEntry): string {
  switch (e.type) {
    case "note":
      // `details` is null on notes — TS knows this from the union.
      return `note(${e.body ?? ""})`;
    case "travel":
      return `travel(${e.details.start_date} → ${e.details.end_date})`;
    case "injury":
      return `injury(${e.details.body_part} ${e.details.severity}/10)`;
    case "physio":
      return `physio(${e.details.diagnosis})`;
  }
}

describe("JournalEntry discriminated union", () => {
  it("narrows by `type` so each branch sees the right `details` shape", () => {
    const travel: TravelEntry = {
      id: 1,
      type: "travel",
      entry_date: "2026-05-23",
      title: "Wedding",
      body: null,
      consumed: false,
      created_at: "2026-05-15T12:00:00Z",
      details: {
        start_date: "2026-05-23",
        end_date: "2026-05-25",
        impact: ["no_running", "light_only"],
      },
    };
    expect(describeEntry(travel)).toBe("travel(2026-05-23 → 2026-05-25)");

    const injury: InjuryEntry = {
      id: 2,
      type: "injury",
      entry_date: "2026-05-12",
      title: "Achilles",
      body: null,
      consumed: true,
      created_at: "2026-05-12T08:30:00Z",
      details: {
        body_part: "Achilles",
        side: "right",
        severity: 3,
        pain_quality: ["stiff", "ache"],
        started_date: "2026-05-10",
        restrictions: ["no downhill"],
        check_back_in_days: 7,
      },
    };
    expect(describeEntry(injury)).toBe("injury(Achilles 3/10)");

    const physio: PhysioEntry = {
      id: 3,
      type: "physio",
      entry_date: "2026-05-10",
      title: null,
      body: null,
      consumed: true,
      created_at: "2026-05-10T16:00:00Z",
      details: {
        physio_name: "Dr. Chen",
        visit_date: "2026-05-10",
        diagnosis: "Mild Achilles tendinopathy",
        restrictions: [],
        exercises: [],
        duration_value: 4,
        duration_unit: "weeks",
      },
    };
    expect(describeEntry(physio)).toBe(
      "physio(Mild Achilles tendinopathy)",
    );
  });
});

describe("IMPACT_LABELS", () => {
  it("maps every impact key to a user-facing string", () => {
    expect(IMPACT_LABELS.no_running).toBe("No running");
    expect(IMPACT_LABELS.no_gym).toBe("No gym");
    expect(IMPACT_LABELS.light_only).toBe("Light only");
    expect(IMPACT_LABELS.normal).toBe("Normal training");
    expect(IMPACT_LABELS.depends).toBe("Depends · see notes");
  });
});
