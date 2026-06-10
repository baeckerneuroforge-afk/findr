import { describe, expect, it } from "vitest";

import { ResearchAgentResponseSchema } from "./research-agent";

/**
 * Self-Healing-Tests für die items-als-String-Macke (GATE-RED-Befund,
 * docs/findr-research-agent-gate-befund.md): das Modell emittiert unter
 * Präzisionsdruck `items` als JSON-encodierten String. Das preprocess darf
 * GENAU diesen Fall heilen — und sonst nichts lockern.
 */

const VALID_ITEM = {
  heading: "Onboarding",
  text: "5 von 8 Befragten nannten die Onboarding-Friction.",
  themeRefs: ["Onboarding-Friction für neue Admin-User"],
  quotes: [],
};

describe("ResearchAgentResponseSchema — items self-healing", () => {
  it("heals a JSON-encoded array string into the parsed array", () => {
    const result = ResearchAgentResponseSchema.safeParse({
      fulfilled: true,
      items: JSON.stringify([VALID_ITEM]),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].heading).toBe("Onboarding");
    }
  });

  it("still validates each healed element (invalid item inside string fails)", () => {
    const result = ResearchAgentResponseSchema.safeParse({
      fulfilled: true,
      // text fehlt → DeliverableItemSchema muss den geheilten Eintrag ablehnen
      items: JSON.stringify([{ heading: "ohne text" }]),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a prose string exactly like before (no silent acceptance)", () => {
    const result = ResearchAgentResponseSchema.safeParse({
      fulfilled: true,
      items: "5 von 8 Befragten nannten die Onboarding-Friction.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a JSON string that parses to a non-array", () => {
    const result = ResearchAgentResponseSchema.safeParse({
      fulfilled: true,
      items: JSON.stringify({ heading: "objekt statt array" }),
    });
    expect(result.success).toBe(false);
  });

  it("keeps native arrays byte-identical in behavior", () => {
    const result = ResearchAgentResponseSchema.safeParse({
      fulfilled: true,
      items: [VALID_ITEM],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0]).toMatchObject(VALID_ITEM);
    }
  });

  it("keeps the max(20) cap after healing", () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => ({
      ...VALID_ITEM,
      heading: `Item ${i}`,
    }));
    const result = ResearchAgentResponseSchema.safeParse({
      fulfilled: true,
      items: JSON.stringify(tooMany),
    });
    expect(result.success).toBe(false);
  });

  it("keeps the default [] when items is omitted (refusal contract)", () => {
    const result = ResearchAgentResponseSchema.safeParse({
      fulfilled: false,
      note: "Steht nicht in den Daten.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toEqual([]);
    }
  });
});
