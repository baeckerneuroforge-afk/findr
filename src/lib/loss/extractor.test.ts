import { describe, expect, it } from "vitest";
import {
  extractLossReason,
  type LossReasonType,
} from "./extractor";
import type { DetectorInput } from "@/lib/risk/types";

function input(lines: string[]): DetectorInput {
  return {
    org_id: "org_1",
    deal_id: "deal_1",
    deal_stage: "closed_lost",
    calls: [
      {
        id: "call_1",
        recorded_at: "2026-05-01T10:00:00.000Z",
        duration_seconds: 1800,
        segments: lines.map((text, index) => ({
          id: `segment_${index}`,
          speaker_id: "buyer_1",
          speaker_name: "Anna Buyer",
          speaker_role: "buyer",
          text,
          start_seconds: index * 30,
          end_seconds: index * 30 + 20,
        })),
      },
    ],
  };
}

const CASES: Array<{ reason: LossReasonType; text: string }> = [
  { reason: "pricing", text: "Das ist fuer uns leider zu teuer." },
  { reason: "compliance", text: "Der Betriebsrat und DSGVO sind noch offen." },
  { reason: "competitor", text: "Wir haben uns fuer Salesforce entschieden." },
  { reason: "timing", text: "Das ist momentan nicht der richtige Zeitpunkt." },
  { reason: "budget", text: "Der CFO sagt nein, es gibt kein Budget." },
  { reason: "champion_lost", text: "Ich verlasse die Firma Ende des Monats." },
  { reason: "feature_gap", text: "We are missing integration with SAP." },
  { reason: "no_decision", text: "Es gibt noch keine Entscheidung." },
  {
    reason: "internal_priority",
    text: "Andere Projekte sind gerade wichtiger.",
  },
];

describe("extractLossReason", () => {
  it.each(CASES)("detects $reason", async ({ reason, text }) => {
    const result = await extractLossReason(input([text]));

    expect(result.primary_reason).toBe(reason);
    expect(result.evidence_quotes[0]?.quote).toBe(text);
    expect(result.extraction_method).toBe("heuristic");
  });

  it("falls back to other when no pattern matches", async () => {
    const result = await extractLossReason(
      input(["Danke fuer die gute Zusammenarbeit, wir melden uns."]),
    );

    expect(result.primary_reason).toBe("other");
    expect(result.confidence).toBe(0.3);
    expect(result.evidence_quotes).toEqual([]);
  });

  it("ranks primary and secondary reasons by evidence count", async () => {
    const result = await extractLossReason(
      input([
        "Wir haben uns fuer Salesforce entschieden.",
        "Der Wettbewerber ist intern schon gesetzt.",
        "Der CFO sagt nein beim Budget.",
      ]),
    );

    expect(result.primary_reason).toBe("competitor");
    expect(result.secondary_reasons).toContain("budget");
    expect(result.evidence_quotes).toHaveLength(2);
  });

  it("caps confidence at 0.95", async () => {
    const result = await extractLossReason(
      input(Array(10).fill("Wir haben uns fuer Salesforce entschieden.")),
    );

    expect(result.confidence).toBe(0.95);
  });
});
