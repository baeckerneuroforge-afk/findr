import { describe, expect, it } from "vitest";
import { buildLossReportData, type LossReportRow } from "./reports";

const start = new Date("2026-01-01T00:00:00.000Z");
const end = new Date("2026-03-31T00:00:00.000Z");

describe("buildLossReportData", () => {
  it("returns an empty report for no losses", () => {
    const report = buildLossReportData([], start, end);

    expect(report.total_lost_deals).toBe(0);
    expect(report.breakdown).toEqual([]);
    expect(report.period_start).toBe("2026-01-01");
  });

  it("aggregates count, value, and percentages by reason", () => {
    const losses: LossReportRow[] = [
      {
        primary_reason: "competitor",
        evidence_quotes: [{ quote: "Wir gehen mit Salesforce.", call_id: "c1", speaker: "A", pattern_matched: "salesforce" }],
        deals: { name: "Nordbank", amount: 100000, company_name: "Nordbank" },
      },
      {
        primary_reason: "competitor",
        evidence_quotes: [{ quote: "Gong hat gewonnen.", call_id: "c2", speaker: "B", pattern_matched: "gong" }],
        deals: { name: "SaaSCo", amount: 50000, company_name: "SaaSCo" },
      },
      {
        primary_reason: "budget",
        evidence_quotes: [{ quote: "Kein Budget.", call_id: "c3", speaker: "C", pattern_matched: "budget" }],
        deals: { name: "Mittelstand AG", amount: 25000, company_name: "Mittelstand AG" },
      },
    ];

    const report = buildLossReportData(losses, start, end);

    expect(report.total_lost_deals).toBe(3);
    expect(report.total_lost_value).toBe(175000);
    expect(report.breakdown[0]).toMatchObject({
      reason: "competitor",
      count: 2,
      value: 150000,
    });
    expect(report.breakdown[0]?.percentage).toBeCloseTo(66.66, 1);
  });

  it("limits top lost companies to five", () => {
    const losses: LossReportRow[] = Array.from({ length: 6 }, (_, index) => ({
      primary_reason: "pricing",
      evidence_quotes: [],
      deals: {
        name: `Deal ${index}`,
        company_name: `Company ${index}`,
        amount: 1000 + index,
      },
    }));

    const report = buildLossReportData(losses, start, end);

    expect(report.top_lost_companies).toHaveLength(5);
    expect(report.top_lost_companies[0]?.value).toBe(1005);
  });

  it("collects sample quotes per reason", () => {
    const report = buildLossReportData(
      [
        {
          primary_reason: "compliance",
          evidence_quotes: [
            {
              call_id: "c1",
              speaker: "Legal",
              quote: "DSGVO ist nicht geklaert.",
              pattern_matched: "dsgvo",
            },
          ],
          deals: { name: "Bank", amount: 10000, company_name: "Bank" },
        },
      ],
      start,
      end,
    );

    expect(report.breakdown[0]?.sample_quotes).toEqual([
      "DSGVO ist nicht geklaert.",
    ]);
  });
});
