import { describe, expect, it } from "vitest";
import {
  buildManualCallInsert,
  buildManualDealInsert,
  ManualCallSchema,
  ManualDealSchema,
} from "./service";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const DEAL_ID = "00000000-0000-4000-8000-000000000002";
const NOW = "2026-05-21T10:00:00.000Z";

describe("ManualDealSchema", () => {
  it("requires a deal name", () => {
    const result = ManualDealSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("applies sensible defaults for manual deals", () => {
    const result = ManualDealSchema.parse({ name: "Nordbank Expansion" });
    expect(result.stage).toBe("qualified");
    expect(result.currency).toBe("EUR");
    expect(result.amount).toBe(0);
  });

  it("rejects unknown stages", () => {
    const result = ManualDealSchema.safeParse({
      name: "Nordbank",
      stage: "contracting",
    });
    expect(result.success).toBe(false);
  });
});

describe("buildManualDealInsert", () => {
  it("marks manual deals as source=manual and data_source=manual", () => {
    const insert = buildManualDealInsert(
      ORG_ID,
      ManualDealSchema.parse({
        name: "Nordbank Enterprise",
        companyName: "Nordbank AG",
        amount: 85000,
        currency: "EUR",
        stage: "negotiation",
        ownerName: "Sarah Müller",
        championName: "Thomas Becker",
        closeDate: "2026-06-30",
      }),
      { externalId: "manual_test", now: NOW },
    );

    expect(insert).toMatchObject({
      org_id: ORG_ID,
      external_id: "manual_test",
      source: "manual",
      data_source: "manual",
      name: "Nordbank Enterprise",
      company_name: "Nordbank AG",
      amount: 85000,
      currency: "EUR",
      stage: "negotiation",
      owner_name: "Sarah Müller",
      owner_email: null,
      last_activity_at: NOW,
      updated_at: NOW,
    });
    expect(insert.raw_data).toMatchObject({
      manualImport: true,
      companyName: "Nordbank AG",
      championName: "Thomas Becker",
      closeDate: "2026-06-30",
      callsCompleted: 0,
      stakeholdersCount: 1,
    });
  });

  it("stores email-like owner input in owner_email", () => {
    const insert = buildManualDealInsert(
      ORG_ID,
      ManualDealSchema.parse({
        name: "Deal",
        ownerName: "sarah.mueller@example.com",
      }),
      { externalId: "manual_email", now: NOW },
    );

    expect(insert.owner_email).toBe("sarah.mueller@example.com");
    expect(insert.owner_name).toBe("sarah mueller");
  });
});

describe("ManualCallSchema", () => {
  it("requires a UUID dealId and transcript text", () => {
    expect(
      ManualCallSchema.safeParse({ dealId: "not-a-uuid", transcript: "Hi" })
        .success,
    ).toBe(false);
    expect(ManualCallSchema.safeParse({ dealId: DEAL_ID, transcript: "" }).success)
      .toBe(false);
  });
});

describe("buildManualCallInsert", () => {
  it("attaches a raw transcript to a manual call", () => {
    const insert = buildManualCallInsert(
      ORG_ID,
      ManualCallSchema.parse({
        dealId: DEAL_ID,
        transcript: "Sarah: Können wir das nächste Woche entscheiden?",
        callType: "Discovery",
        recordedAt: "2026-05-20",
        durationSeconds: 1800,
      }),
      { now: NOW },
    );

    expect(insert).toMatchObject({
      org_id: ORG_ID,
      deal_id: DEAL_ID,
      source: "manual",
      call_type: "Discovery",
      transcript: "Sarah: Können wir das nächste Woche entscheiden?",
      duration_seconds: 1800,
      recorded_at: "2026-05-20T00:00:00.000Z",
    });
    expect(insert.participants).toMatchObject({ source: "manual" });
  });
});
