import { describe, expect, it } from "vitest";

import {
  AudiencePersonasResultSchema,
  normalizePersonas,
  normalizePersonasSummary,
} from "./synthesis";

// ── Fixtures ────────────────────────────────────────────────────────────────

function validPersona() {
  return {
    name: "Effizienz-getriebene Power-User",
    shareCount: 3,
    goals: ["Schneller zum Ergebnis kommen"],
    pains: ["Zu viele manuelle Schritte"],
    behavior: ["Nutzt Tastaturkürzel"],
    motivation: "Will Zeit sparen und Kontrolle behalten.",
    leadQuote: "Ich will nicht dreimal klicken müssen.",
    sourceInsightIds: ["call_a", "call_b"],
    evidence: [
      {
        field: "pain" as const,
        text: "Zu viele manuelle Schritte",
        sourceInsightIds: ["call_a"],
      },
    ],
  };
}

// ── AudiencePersonasResultSchema (Form-Validierung) ─────────────────────────

describe("AudiencePersonasResultSchema", () => {
  it("akzeptiert eine vollständige Persona", () => {
    const parsed = AudiencePersonasResultSchema.safeParse({
      personas: [validPersona()],
    });
    expect(parsed.success).toBe(true);
  });

  it("akzeptiert ein leeres personas-Array (zu dünne Daten ⇒ keine Persona)", () => {
    const parsed = AudiencePersonasResultSchema.safeParse({ personas: [] });
    expect(parsed.success).toBe(true);
  });

  it("defaultet ein fehlendes personas-Feld auf []", () => {
    const parsed = AudiencePersonasResultSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.personas).toEqual([]);
  });

  it("lehnt eine Persona mit nur 1 sourceInsightId ab (min 2 — keine Stimme allein)", () => {
    const p = { ...validPersona(), sourceInsightIds: ["call_a"] };
    expect(AudiencePersonasResultSchema.safeParse({ personas: [p] }).success).toBe(
      false,
    );
  });

  it("lehnt eine Persona ohne Evidence ab (min 1)", () => {
    const p = { ...validPersona(), evidence: [] };
    expect(AudiencePersonasResultSchema.safeParse({ personas: [p] }).success).toBe(
      false,
    );
  });

  it("lehnt mehr als 5 Personas ab", () => {
    const many = Array.from({ length: 6 }, () => validPersona());
    expect(
      AudiencePersonasResultSchema.safeParse({ personas: many }).success,
    ).toBe(false);
  });

  it("lehnt eine unbekannte Evidence-field-Kategorie ab", () => {
    const p = {
      ...validPersona(),
      evidence: [{ field: "price", text: "x", sourceInsightIds: ["call_a"] }],
    };
    expect(AudiencePersonasResultSchema.safeParse({ personas: [p] }).success).toBe(
      false,
    );
  });
});

// ── normalizePersonas (defensiver Read-Mapper) ──────────────────────────────

describe("normalizePersonas", () => {
  it("gibt [] für Nicht-Arrays / undefined zurück (legacy Zeile ohne Spalte)", () => {
    expect(normalizePersonas(undefined)).toEqual([]);
    expect(normalizePersonas(null)).toEqual([]);
    expect(normalizePersonas({})).toEqual([]);
  });

  it("füllt Teil-Objekte defensiv mit leeren Innenfeldern (wirft nie)", () => {
    const [p] = normalizePersonas([{ name: "Nur Name" }]);
    expect(p.name).toBe("Nur Name");
    expect(p.goals).toEqual([]);
    expect(p.pains).toEqual([]);
    expect(p.behavior).toEqual([]);
    expect(p.evidence).toEqual([]);
    expect(p.sourceInsightIds).toEqual([]);
    expect(p.shareCount).toBe(0);
    expect(p.sharePercent).toBe(0);
    expect(p.roleLabel).toBeNull();
    expect(p.segmentLabel).toBeNull();
    expect(p.sentimentDistribution).toEqual({
      positive: 0,
      neutral: 0,
      negative: 0,
      mixed: 0,
      unknown: 0,
    });
  });

  it("erhält eine vollständige angereicherte Persona und droppt kaputte Evidence", () => {
    const enriched = {
      ...validPersona(),
      shareCount: 3,
      sharePercent: 60,
      roleLabel: "PM",
      segmentLabel: "Enterprise",
      sentimentDistribution: {
        positive: 2,
        neutral: 1,
        negative: 0,
        mixed: 0,
        unknown: 0,
      },
      evidence: [
        { field: "goal", text: "ok", sourceInsightIds: ["call_a"] },
        { field: "nonsense", text: "drop me", sourceInsightIds: ["call_a"] },
        { field: "pain", text: "", sourceInsightIds: ["call_b"] },
      ],
    };
    const [p] = normalizePersonas([enriched]);
    expect(p.sharePercent).toBe(60);
    expect(p.roleLabel).toBe("PM");
    expect(p.sentimentDistribution.positive).toBe(2);
    // nur die gültige goal-Evidence überlebt; unbekanntes field + leeres text raus
    expect(p.evidence).toHaveLength(1);
    expect(p.evidence[0]).toMatchObject({ field: "goal", text: "ok" });
  });
});

// ── normalizePersonasSummary ────────────────────────────────────────────────

describe("normalizePersonasSummary", () => {
  it("gibt null für null / Arrays / Nicht-Objekte zurück", () => {
    expect(normalizePersonasSummary(null)).toBeNull();
    expect(normalizePersonasSummary([])).toBeNull();
    expect(normalizePersonasSummary("x")).toBeNull();
  });

  it("liest eine gültige Summary mit version 1", () => {
    const s = normalizePersonasSummary({
      totalInsights: 12,
      assigned: 11,
      unassigned: 1,
      qualityHint: true,
    });
    expect(s).toEqual({
      version: 1,
      totalInsights: 12,
      assigned: 11,
      unassigned: 1,
      qualityHint: true,
    });
  });
});
