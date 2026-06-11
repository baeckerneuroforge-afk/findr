import { describe, expect, it } from "vitest";

import {
  coerceTurnSignalsRecord,
  TURN_SIGNALS_VERSION,
} from "@/lib/schemas/turn-signals";

/**
 * E2 — Read-Normalizer der persistierten Turn-Signale. Die Forscher-UI hängt
 * an genau dieser Funktion: alles, was nicht exakt eine wohlgeformte v1 ist,
 * MUSS sich als "keine Signale" (null) lesen, damit Transkript-Seite und
 * Drawer für Bestands-/Müll-/Zukunfts-Zeilen byte-identisch bleiben.
 */

const validRecord = {
  version: TURN_SIGNALS_VERSION,
  analyzedAt: "2026-06-11T10:00:00.000Z",
  model: "claude-haiku-4-5-20251001",
  turns: [
    {
      index: 1,
      affect: "uncertainty",
      affectIntensity: "medium",
      affectEvidence: "hm, schwer zu sagen",
      directness: "partial",
      unansweredAspect: "konkreter Preisrahmen",
      confidence: 0.7,
    },
  ],
  session: {
    affectArc: "Begann offen, zögerte bei Preisfragen.",
    evasiveCount: 0,
    directCount: 0,
  },
};

describe("coerceTurnSignalsRecord", () => {
  it("passes a well-formed v1 record through", () => {
    const record = coerceTurnSignalsRecord(validRecord);
    expect(record).not.toBeNull();
    expect(record?.turns).toHaveLength(1);
    expect(record?.turns[0].affect).toBe("uncertainty");
    expect(record?.session.affectArc).toContain("Preisfragen");
  });

  it("reads null/undefined (never analyzed / pre-migration) as null", () => {
    expect(coerceTurnSignalsRecord(null)).toBeNull();
    expect(coerceTurnSignalsRecord(undefined)).toBeNull();
  });

  it("reads a FUTURE version as null instead of half-understanding it", () => {
    expect(
      coerceTurnSignalsRecord({ ...validRecord, version: 2 }),
    ).toBeNull();
  });

  it("reads malformed rows as null (garbage, missing session, bad enum)", () => {
    expect(coerceTurnSignalsRecord("not an object")).toBeNull();
    expect(coerceTurnSignalsRecord({})).toBeNull();
    const { session: _session, ...withoutSession } = validRecord;
    expect(coerceTurnSignalsRecord(withoutSession)).toBeNull();
    expect(
      coerceTurnSignalsRecord({
        ...validRecord,
        turns: [{ ...validRecord.turns[0], affect: "stressed" }],
      }),
    ).toBeNull();
  });
});
