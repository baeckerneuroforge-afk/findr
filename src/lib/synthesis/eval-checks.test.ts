import { describe, expect, it } from "vitest";

import {
  judgeResultToFindings,
  methodCongruenceRule,
  numberFidelityScan,
  quoteCoverageScan,
  type SynthesisJudgeResult,
} from "@/lib/synthesis/eval-checks";
import type { StudySynthesisResult } from "@/lib/schemas/synthesis";

/**
 * Tier-2a deterministische Eval-Checks. Für JEDEN Check wird BEIDES bewiesen:
 * er FEUERT auf dem schlechten Input UND bleibt STILL auf dem sauberen — sonst
 * gilt der Check nicht als fertig (Spec §2 „keine verdeckte Lücke"). Kein LLM,
 * kein API-Key: die Judge-gespeisten Checks werden mit gestubbtem Judge-Output
 * gefahren (Verdrahtungstest, kein Live-Call).
 */

// Minimal-Result-Builder; Felder, die der jeweilige Test nicht braucht, sind leer.
function makeResult(over: Partial<StudySynthesisResult>): StudySynthesisResult {
  return {
    overview: "Eine neutrale Uebersicht ohne Zahlen.",
    emergent_themes: [],
    tensions: [],
    methodology: null,
    signal_observations: [],
    stimulus_sections: [],
    stimulus_comparison: null,
    ...over,
  };
}

function theme(
  over: Partial<StudySynthesisResult["emergent_themes"][number]>,
): StudySynthesisResult["emergent_themes"][number] {
  return {
    title: "Ein Theme",
    summary: "Neutrale Zusammenfassung.",
    frequency: 1,
    sourceInsightIds: ["a"],
    quotes: ["ein zitat"],
    ...over,
  };
}

function tensionSide(
  over: Partial<StudySynthesisResult["tensions"][number]["side_a"]>,
): StudySynthesisResult["tensions"][number]["side_a"] {
  return {
    label: "eine Position",
    sourceInsightIds: ["a"],
    quotes: ["ein zitat"],
    ...over,
  };
}

// ── A2 — numberFidelityScan ──────────────────────────────────────────────────

describe("numberFidelityScan (A2) — Prosa-Zahlentreue", () => {
  const ctx = { inputHaystack: "kostet 20 euro im jahr 2026", basedOnCount: 8 };

  it("flags a fabricated count in the overview as WARN (calibrated down from FAIL)", () => {
    // 8 ist gedeckt (basedOnCount), 10 nicht (weder Server- noch Haystack-Zahl).
    // ANTI-AUFWEICHEN: die frei erfundene 10 MUSS weiter ein Befund sein — nur WARN.
    const result = makeResult({ overview: "8 von 10 Befragten waren begeistert." });
    const findings = numberFidelityScan(result, ctx);
    const f = findings.find((x) => x.field === "overview");
    expect(f).toBeDefined();
    expect(f!.severity).toBe("warn");
    expect(f!.message).toContain("10");
    expect(f!.message).not.toContain(" 8"); // 8 ist gedeckt, darf nicht gemeldet sein
  });

  it("flags a fabricated count in a tension.description as WARN (calibrated down from FAIL)", () => {
    const result = makeResult({
      tensions: [
        {
          description: "Hier widersprechen sich 7 Lager.",
          side_a: tensionSide({}),
          side_b: tensionSide({ sourceInsightIds: ["b"] }),
        },
      ],
    });
    const f = numberFidelityScan(result, ctx).find(
      (x) => x.field === "tension[0].description",
    );
    expect(f).toBeDefined();
    expect(f!.severity).toBe("warn");
    expect(f!.message).toContain("7");
  });

  it("WARNs (not fail) on a fabricated count in a theme.summary", () => {
    const result = makeResult({
      emergent_themes: [theme({ summary: "Etwa 99 Nutzer teilen das." })],
    });
    const f = numberFidelityScan(result, ctx).find(
      (x) => x.field === "theme[0].summary",
    );
    expect(f).toBeDefined();
    expect(f!.severity).toBe("warn");
    expect(f!.message).toContain("99");
  });

  it("does NOT flag a number that appears only in plan.title/objective ('Q3')", () => {
    const result = makeResult({
      overview: "Im Quartal Q3 zeigte sich ein klares Bild.",
    });
    // Mit planContext: die 3 aus „Q3" ist gedeckt → kein Befund.
    const withPlan = numberFidelityScan(result, {
      inputHaystack: "",
      basedOnCount: 4,
      planContext: "Onboarding-Studie Q3 — Reibung im Q3-Onboarding verstehen",
    });
    expect(withPlan).toEqual([]);
    // Gegenprobe: OHNE planContext wird die 3 als WARN gemeldet — beweist, dass
    // der Nicht-Flag wirklich an planContext liegt (Allowlist-Erweiterung greift).
    const withoutPlan = numberFidelityScan(result, {
      inputHaystack: "",
      basedOnCount: 4,
    });
    const f = withoutPlan.find((x) => x.field === "overview");
    expect(f).toBeDefined();
    expect(f!.severity).toBe("warn");
    expect(f!.message).toContain("3");
  });

  it("stays SILENT on server numbers and verbatim haystack numbers", () => {
    // frequency=3 (Server), 20 + 2026 aus dem Haystack, 8 = basedOnCount.
    const result = makeResult({
      overview: "Über 8 Interviews; ein Preis von 20 Euro im Jahr 2026 wurde genannt.",
      emergent_themes: [
        theme({ frequency: 3, sourceInsightIds: ["a", "b", "c"], summary: "3 Stimmen teilen das." }),
      ],
    });
    expect(numberFidelityScan(result, ctx)).toEqual([]);
  });

  it("documented limit: written-out numbers are NOT caught (judge handles them)", () => {
    const result = makeResult({ overview: "Acht von zehn waren begeistert." });
    expect(numberFidelityScan(result, ctx)).toEqual([]);
  });
});

// ── A4 — quoteCoverageScan ───────────────────────────────────────────────────

describe("quoteCoverageScan (A4) — Belegpflicht", () => {
  it("WARNs on a quote-less theme", () => {
    const result = makeResult({
      emergent_themes: [theme({ quotes: [] })],
    });
    const findings = quoteCoverageScan(result);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      check: "quote-coverage",
      severity: "warn",
      field: "theme[0]",
    });
  });

  it("WARNs on quote-less tension sides (both sides)", () => {
    const result = makeResult({
      tensions: [
        {
          description: "Ein Konflikt.",
          side_a: tensionSide({ quotes: [] }),
          side_b: tensionSide({ sourceInsightIds: ["b"], quotes: [] }),
        },
      ],
    });
    const fields = quoteCoverageScan(result).map((f) => f.field);
    expect(fields).toEqual(["tension[0].side_a", "tension[0].side_b"]);
  });

  it("stays SILENT when every theme and side carries a quote", () => {
    const result = makeResult({
      emergent_themes: [theme({ quotes: ["belegt"] })],
      tensions: [
        {
          description: "Ein Konflikt.",
          side_a: tensionSide({ quotes: ["a-zitat"] }),
          side_b: tensionSide({ sourceInsightIds: ["b"], quotes: ["b-zitat"] }),
        },
      ],
    });
    expect(quoteCoverageScan(result)).toEqual([]);
  });
});

// ── A1 — methodCongruenceRule ────────────────────────────────────────────────

describe("methodCongruenceRule (A1) — Deny-Listen je Methode", () => {
  it("brand_research forbids price / purchase_intent / pain", () => {
    const ctx = { studyType: "market_research" as const, useCase: "brand_research" as const };
    expect(methodCongruenceRule("price", ctx)).toBe(false);
    expect(methodCongruenceRule("purchase_intent", ctx)).toBe(false);
    expect(methodCongruenceRule("pain", ctx)).toBe(false);
    expect(methodCongruenceRule("brand_perception", ctx)).toBe(true);
  });

  it("creative_test forbids pain (and price/intent)", () => {
    const ctx = { studyType: "market_research" as const, useCase: "creative_test" as const };
    expect(methodCongruenceRule("pain", ctx)).toBe(false);
    expect(methodCongruenceRule("message_effect", ctx)).toBe(true);
  });

  it("concept_test forbids pain but allows understanding/intent", () => {
    const ctx = { studyType: "market_research" as const, useCase: "concept_test" as const };
    expect(methodCongruenceRule("pain", ctx)).toBe(false);
    expect(methodCongruenceRule("concept_understanding", ctx)).toBe(true);
    expect(methodCongruenceRule("purchase_intent", ctx)).toBe(true);
  });

  it("product_discovery forbids a market price lager but allows feature/pain", () => {
    const ctx = { studyType: "product_discovery" as const };
    expect(methodCongruenceRule("price", ctx)).toBe(false);
    expect(methodCongruenceRule("feature", ctx)).toBe(true);
    expect(methodCongruenceRule("pain", ctx)).toBe(true);
  });

  it("undefined study type defaults to product_discovery deny-list", () => {
    expect(methodCongruenceRule("price", {})).toBe(false);
    expect(methodCongruenceRule("feature", {})).toBe(true);
  });

  it("general_survey has NO deny-list (every category congruent)", () => {
    const ctx = { studyType: "market_research" as const, useCase: "general_survey" as const };
    expect(methodCongruenceRule("price", ctx)).toBe(true);
    expect(methodCongruenceRule("purchase_intent", ctx)).toBe(true);
    expect(methodCongruenceRule("pain", ctx)).toBe(true);
    expect(methodCongruenceRule("segment_need", ctx)).toBe(true);
  });
});

// ── A1 + A3 — judgeResultToFindings (Verdrahtung, gestubbter Judge-Output) ────

describe("judgeResultToFindings (A1+A3) — Mapping eines gestubbten Judge-Outputs", () => {
  const brandCtx = { studyType: "market_research" as const, useCase: "brand_research" as const };

  it("maps an unsupported_claim verdict to a grounding WARN (never fail)", () => {
    const jr: SynthesisJudgeResult = {
      overview: { verdict: "unsupported_claim" },
      themes: [],
      tensions: [],
    };
    const findings = judgeResultToFindings(jr, brandCtx);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      check: "grounding",
      severity: "warn",
      field: "overview",
    });
  });

  it("maps an incongruent category to a method-congruence WARN", () => {
    const jr: SynthesisJudgeResult = {
      overview: { verdict: "grounded" },
      themes: [{ index: 0, summaryVerdict: "grounded", category: "price" }],
      tensions: [],
    };
    const findings = judgeResultToFindings(jr, brandCtx);
    // 'price' unter brand_research → genau ein Kongruenz-WARN, kein Grounding-WARN.
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      check: "method-congruence",
      severity: "warn",
      field: "theme[0]",
    });
  });

  it("stays SILENT on a fully grounded, method-congruent judge result", () => {
    const jr: SynthesisJudgeResult = {
      overview: { verdict: "grounded" },
      themes: [{ index: 0, summaryVerdict: "grounded", category: "brand_perception" }],
      tensions: [
        { index: 0, descriptionVerdict: "grounded", category: "competitive" },
      ],
    };
    expect(judgeResultToFindings(jr, brandCtx)).toEqual([]);
  });

  it("never emits a 'fail' severity, even for the overview", () => {
    const jr: SynthesisJudgeResult = {
      overview: { verdict: "unsupported_claim" },
      themes: [{ index: 0, summaryVerdict: "unsupported_claim", category: "pain" }],
      tensions: [
        { index: 0, descriptionVerdict: "unsupported_claim", category: "price" },
      ],
    };
    const findings = judgeResultToFindings(jr, brandCtx);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.severity === "warn")).toBe(true);
  });
});
