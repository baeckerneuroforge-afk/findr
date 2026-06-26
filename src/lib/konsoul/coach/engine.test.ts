import { describe, expect, it, vi } from "vitest";

import type { KonsoulSignal } from "@/lib/konsoul/signals";
import {
  applyCoachAnchorFilter,
  buildCoachItems,
  runKonsoulCoachWith,
  KonsoulCoachResultSchema,
  type CoachDelegate,
  type CoachItem,
  type NextStepLike,
} from "./engine";

/**
 * Konsoul COACH engine — unit tests for the PURE pieces (no DB, no LLM, no key):
 * the deterministic item builder and, above all, the HONESTY anchor filter that
 * makes Opus framing safe by construction. The LLM step is exercised via the DI
 * delegate seam (a scripted fake), so these run offline.
 */

// ── Fixtures ─────────────────────────────────────────────────────────────────

const nextStep = (key: string, planTitle: string): NextStepLike => ({
  key,
  planTitle,
});

function planSignal(
  kind: "persona_gate" | "persona_quality",
  planId: string,
  planTitle: string,
  count: number,
): KonsoulSignal {
  return {
    kind,
    key: `${kind}-${planId}`,
    count,
    evidence: { type: "plan", planId, planTitle },
    grounded: true,
    severity: kind === "persona_gate" ? 0 : 1,
  };
}

function themeSignal(theme: string, count: number): KonsoulSignal {
  return {
    kind: "recurring_theme",
    key: `recurring_theme-${theme}`,
    count,
    evidence: {
      type: "theme",
      theme,
      studyIds: ["a", "b"],
      studyTitles: ["A", "B"],
    },
    grounded: true,
    severity: 2,
  };
}

// ── buildCoachItems ──────────────────────────────────────────────────────────

describe("buildCoachItems", () => {
  it("maps next-step keys to kinds, entity = planTitle, requireEntity false", () => {
    const items = buildCoachItems(
      [
        nextStep("synthesis-p1", "Pricing"),
        nextStep("field-p2", "Onboarding"),
        nextStep("draft-p3", "Retention"),
      ],
      [],
    );
    expect(items).toEqual<CoachItem[]>([
      { key: "synthesis-p1", kind: "synthesis_gap", entity: "Pricing", requireEntity: false },
      { key: "field-p2", kind: "dead_field", entity: "Onboarding", requireEntity: false },
      { key: "draft-p3", kind: "old_draft", entity: "Retention", requireEntity: false },
    ]);
  });

  it("skips next-step keys with an unknown prefix (never guesses a kind)", () => {
    expect(buildCoachItems([nextStep("mystery-p9", "X")], [])).toEqual([]);
  });

  it("maps signals: kind preserved, requireEntity true, entity from evidence", () => {
    const items = buildCoachItems(
      [],
      [
        planSignal("persona_gate", "p1", "Pricing", 5),
        themeSignal("Preis-Sensibilität", 3),
      ],
    );
    expect(items).toEqual<CoachItem[]>([
      { key: "persona_gate-p1", kind: "persona_gate", entity: "Pricing", requireEntity: true },
      {
        key: "recurring_theme-Preis-Sensibilität",
        kind: "recurring_theme",
        entity: "Preis-Sensibilität",
        requireEntity: true,
      },
    ]);
  });

  it("orders next-steps before signals (matching card order)", () => {
    const items = buildCoachItems(
      [nextStep("synthesis-p1", "Pricing")],
      [planSignal("persona_gate", "p2", "Onboarding", 4)],
    );
    expect(items.map((i) => i.key)).toEqual([
      "synthesis-p1",
      "persona_gate-p2",
    ]);
  });
});

// ── applyCoachAnchorFilter (the honesty guarantee) ───────────────────────────

describe("applyCoachAnchorFilter", () => {
  const items = buildCoachItems(
    [nextStep("synthesis-p1", "Pricing")],
    [
      planSignal("persona_gate", "p2", "Onboarding", 5),
      themeSignal("Preis-Sensibilität", 3),
    ],
  );

  it("keeps a number-free next-step headline", () => {
    const out = applyCoachAnchorFilter(items, [
      { key: "synthesis-p1", headline: "Verdichte jetzt die ersten Stimmen" },
    ]);
    expect(out.get("synthesis-p1")).toBe("Verdichte jetzt die ersten Stimmen");
  });

  it("REJECTS a headline that invents a number", () => {
    const out = applyCoachAnchorFilter(items, [
      { key: "synthesis-p1", headline: "Verdichte deine 7 Gespräche" },
    ]);
    expect(out.has("synthesis-p1")).toBe(false);
  });

  it("keeps a signal headline only if it names the entity verbatim", () => {
    const ok = applyCoachAnchorFilter(items, [
      { key: "persona_gate-p2", headline: "Hol mehr Stimmen für Onboarding ein" },
    ]);
    expect(ok.get("persona_gate-p2")).toContain("Onboarding");

    const missing = applyCoachAnchorFilter(items, [
      { key: "persona_gate-p2", headline: "Hol mehr Stimmen ein" },
    ]);
    expect(missing.has("persona_gate-p2")).toBe(false);
  });

  it("matches the entity through fold() (case/umlaut/spacing insensitive)", () => {
    const out = applyCoachAnchorFilter(items, [
      {
        key: "recurring_theme-Preis-Sensibilität",
        headline: "Geh dem Muster PREIS-SENSIBILITAET mit einer eigenen Studie nach",
      },
    ]);
    expect(out.has("recurring_theme-Preis-Sensibilität")).toBe(true);
  });

  it("allows a digit that is part of the study title itself", () => {
    const titled = buildCoachItems(
      [],
      [planSignal("persona_gate", "p9", "Pricing 2.0", 6)],
    );
    const out = applyCoachAnchorFilter(titled, [
      { key: "persona_gate-p9", headline: "Bring Pricing 2.0 über die Schwelle" },
    ]);
    expect(out.get("persona_gate-p9")).toContain("Pricing 2.0");
  });

  it("drops a frame with an unknown key", () => {
    const out = applyCoachAnchorFilter(items, [
      { key: "ghost-x", headline: "Tu irgendetwas" },
    ]);
    expect(out.size).toBe(0);
  });

  it("keeps only the first valid frame for a duplicate key", () => {
    const out = applyCoachAnchorFilter(items, [
      { key: "synthesis-p1", headline: "Erste Schlagzeile" },
      { key: "synthesis-p1", headline: "Zweite Schlagzeile" },
    ]);
    expect(out.get("synthesis-p1")).toBe("Erste Schlagzeile");
  });

  it("rejects an over-long headline", () => {
    const out = applyCoachAnchorFilter(items, [
      { key: "synthesis-p1", headline: "x".repeat(161) },
    ]);
    expect(out.has("synthesis-p1")).toBe(false);
  });

  it("rejects an empty/whitespace headline", () => {
    const out = applyCoachAnchorFilter(items, [
      { key: "synthesis-p1", headline: "   " },
    ]);
    expect(out.has("synthesis-p1")).toBe(false);
  });
});

// ── applyCoachAnchorFilter — adversarial honesty (review regressions) ────────

describe("applyCoachAnchorFilter — fabricated-number defences", () => {
  it("REJECTS a spelled-out count not present in the title", () => {
    const items = buildCoachItems([nextStep("synthesis-p1", "Pricing")], []);
    const out = applyCoachAnchorFilter(items, [
      { key: "synthesis-p1", headline: "Verdichte deine sieben Gespräche jetzt" },
    ]);
    expect(out.has("synthesis-p1")).toBe(false);
  });

  it("ALLOWS a number-word that is genuinely a token of the title", () => {
    const items = buildCoachItems([], [themeSignal("Drei Säulen", 2)]);
    const out = applyCoachAnchorFilter(items, [
      {
        key: "recurring_theme-Drei Säulen",
        headline: "Stärke Drei Säulen mit mehr Stimmen",
      },
    ]);
    expect(out.get("recurring_theme-Drei Säulen")).toContain("Drei Säulen");
  });

  it("REJECTS a stray digit that merely coincides with a digit in the title", () => {
    const items = buildCoachItems([], [planSignal("persona_gate", "p8", "Sprint 3", 6)]);
    const out = applyCoachAnchorFilter(items, [
      { key: "persona_gate-p8", headline: "Hol 3 Stimmen für Sprint 3 ein" },
    ]);
    expect(out.has("persona_gate-p8")).toBe(false);
  });

  it("REJECTS a multi-digit number even when the title contains those digits", () => {
    const items = buildCoachItems([], [planSignal("persona_gate", "p9", "Pricing 2.0", 6)]);
    const out = applyCoachAnchorFilter(items, [
      { key: "persona_gate-p9", headline: "Bring Pricing 2.0 auf 200 Stimmen" },
    ]);
    expect(out.has("persona_gate-p9")).toBe(false);
  });

  it("REJECTS a German closed compound numeral (einundzwanzig)", () => {
    const items = buildCoachItems([nextStep("synthesis-p1", "Pricing")], []);
    const out = applyCoachAnchorFilter(items, [
      { key: "synthesis-p1", headline: "Du hast einundzwanzig Stimmen gesammelt" },
    ]);
    expect(out.has("synthesis-p1")).toBe(false);
  });

  it("REJECTS a hundert/tausend-morpheme count (zweihundert)", () => {
    const items = buildCoachItems([nextStep("field-p2", "Onboarding")], []);
    const out = applyCoachAnchorFilter(items, [
      { key: "field-p2", headline: "Hol zweihundert Stimmen ins Feld" },
    ]);
    expect(out.has("field-p2")).toBe(false);
  });

  it("REJECTS a Unicode Roman numeral that NFKC-folds to letters (Ⅷ)", () => {
    const items = buildCoachItems([nextStep("synthesis-p1", "Pricing")], []);
    const out = applyCoachAnchorFilter(items, [
      { key: "synthesis-p1", headline: "Erreiche Phase Ⅷ deiner Studie" },
    ]);
    expect(out.has("synthesis-p1")).toBe(false);
  });

  it("REJECTS a Unicode fraction / non-Latin digit", () => {
    const items = buildCoachItems([nextStep("synthesis-p1", "Pricing")], []);
    expect(
      applyCoachAnchorFilter(items, [
        { key: "synthesis-p1", headline: "Schon ½ geschafft, weiter so" },
      ]).has("synthesis-p1"),
    ).toBe(false);
    expect(
      applyCoachAnchorFilter(items, [
        { key: "synthesis-p1", headline: "Hol ٧ weitere Stimmen" },
      ]).has("synthesis-p1"),
    ).toBe(false);
  });

  it("REJECTS a stray fabricated digit even when the title is itself a bare number", () => {
    const items = buildCoachItems([], [planSignal("persona_gate", "p7", "7", 8)]);
    const out = applyCoachAnchorFilter(items, [
      { key: "persona_gate-p7", headline: "Sammle 7 weitere Stimmen für 7" },
    ]);
    expect(out.has("persona_gate-p7")).toBe(false);
  });
});

describe("applyCoachAnchorFilter — entity anchoring edge cases", () => {
  it("does NOT match a short theme inside an unrelated word (token boundary)", () => {
    const items = buildCoachItems([], [themeSignal("KI", 2)]);
    const out = applyCoachAnchorFilter(items, [
      {
        key: "recurring_theme-KI",
        headline: "Verfolge das Muster mit klarer Markierung weiter",
      },
    ]);
    expect(out.has("recurring_theme-KI")).toBe(false);
  });

  it("DOES match a short theme as a real token", () => {
    const items = buildCoachItems([], [themeSignal("KI", 2)]);
    const out = applyCoachAnchorFilter(items, [
      { key: "recurring_theme-KI", headline: "Geh dem KI-Thema mit einer Studie nach" },
    ]);
    expect(out.get("recurring_theme-KI")).toContain("KI");
  });

  it("REJECTS a signal frame whose required entity is empty (no vacuous match)", () => {
    const emptyEntity: CoachItem = {
      key: "persona_gate-pX",
      kind: "persona_gate",
      entity: "",
      requireEntity: true,
    };
    const out = applyCoachAnchorFilter(
      [emptyEntity],
      [{ key: "persona_gate-pX", headline: "Stärke deine Studie weiter" }],
    );
    expect(out.size).toBe(0);
  });
});

describe("KonsoulCoachResultSchema", () => {
  it("accepts up to 12 frames but rejects an over-cap batch", () => {
    const frame = (i: number) => ({ key: `k${i}`, headline: "Tu etwas" });
    expect(
      KonsoulCoachResultSchema.safeParse({
        frames: Array.from({ length: 12 }, (_, i) => frame(i)),
      }).success,
    ).toBe(true);
    expect(
      KonsoulCoachResultSchema.safeParse({
        frames: Array.from({ length: 13 }, (_, i) => frame(i)),
      }).success,
    ).toBe(false);
  });
});

// ── runKonsoulCoachWith (DI seam, fail-open) ─────────────────────────────────

describe("runKonsoulCoachWith", () => {
  const items = buildCoachItems([nextStep("synthesis-p1", "Pricing")], []);

  it("frames + anchor-filters the delegate output", async () => {
    const delegate: CoachDelegate = async () => ({
      frames: [{ key: "synthesis-p1", headline: "Verdichte die ersten Stimmen" }],
    });
    const out = await runKonsoulCoachWith(items, "de", delegate);
    expect(out.get("synthesis-p1")).toBe("Verdichte die ersten Stimmen");
  });

  it("returns an empty Map (fail-open) when the delegate throws", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const delegate: CoachDelegate = async () => {
      throw new Error("boom");
    };
    const out = await runKonsoulCoachWith(items, "de", delegate);
    expect(out.size).toBe(0);
    errSpy.mockRestore();
  });

  it("does NOT call the delegate when there are no items", async () => {
    const delegate = vi.fn();
    const out = await runKonsoulCoachWith([], "de", delegate as unknown as CoachDelegate);
    expect(out.size).toBe(0);
    expect(delegate).not.toHaveBeenCalled();
  });

  it("drops an invented-number frame but keeps the valid ones in the same batch", async () => {
    const twoItems = buildCoachItems(
      [nextStep("synthesis-p1", "Pricing"), nextStep("field-p2", "Onboarding")],
      [],
    );
    const delegate: CoachDelegate = async () => ({
      frames: [
        { key: "synthesis-p1", headline: "Verdichte deine 9 Gespräche" }, // invented number → drop
        { key: "field-p2", headline: "Eröffne jetzt das Feld" }, // clean → keep
      ],
    });
    const out = await runKonsoulCoachWith(twoItems, "de", delegate);
    expect(out.has("synthesis-p1")).toBe(false);
    expect(out.get("field-p2")).toBe("Eröffne jetzt das Feld");
  });
});
