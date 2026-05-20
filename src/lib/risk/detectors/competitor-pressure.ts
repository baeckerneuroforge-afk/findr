import { BaseDetector } from "./base";
import type { DetectorInput, DetectorResult } from "../types";

const COMPETITOR_NAMES = [
  "clari",
  "gong",
  "aviso",
  "salesforce",
  "hubspot",
  "hubspot crm",
  "microsoft dynamics",
  "dynamics",
  "pipedrive",
  "zoho",
  "chorus",
  "sap",
];

export class CompetitorPressureDetector extends BaseDetector {
  readonly type = "competitor_pressure" as const;

  async detect(input: DetectorInput): Promise<DetectorResult> {
    const patterns = [
      /wir\s+(schauen|evaluieren|vergleichen)\s+.*(auch|parallel)/i,
      /we\s+are\s+(also\s+)?evaluating/i,
      /competitive\s+(bid|process|evaluation)/i,
      /finalen?\s+vergleich/i,
      /preislich\s+(einfacher|guenstiger|günstiger|aggressiver)/i,
      /bestehende[nr]?\s+anbieter/i,
    ];

    const evidence = this.buyerSideSegments(input.calls)
      .filter(({ segment }) => {
        const lower = segment.text.toLowerCase();
        return (
          COMPETITOR_NAMES.some((name) => lower.includes(name)) ||
          patterns.some((pattern) => pattern.test(segment.text))
        );
      })
      .map(({ call, segment }) =>
        this.evidence(
          call,
          segment,
          "Buyer references an active competitor, competitive benchmark, or vendor comparison.",
        ),
      );

    if (evidence.length === 0) return this.createEmptyResult();

    return this.createResult([
      this.createSignal({
        confidence: evidence.length >= 2 ? 0.82 : 0.7,
        severity: evidence.length >= 2 ? "high" : "medium",
        evidence,
      }),
    ]);
  }
}
