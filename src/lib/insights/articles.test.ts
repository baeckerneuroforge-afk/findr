import { describe, expect, it } from "vitest";

import {
  formatDate,
  getInsight,
  getInsightSlugs,
  insightsByDate,
} from "./articles";

/**
 * Locks the per-locale insights contract. Insights are authored editorial — NOT
 * machine-translated — and now exist in BOTH locales: each German article has a
 * hand-written English counterpart under the SAME slug (so /de/insights/<slug>
 * ⇄ /en/insights/<slug> get trivial reciprocal hreflang). getInsightSlugs /
 * getInsight / insightsByDate all filter strictly by the article's own locale.
 */
describe("insights locale model", () => {
  it("serves each locale's own three articles", () => {
    const de = getInsightSlugs("de");
    expect(de).toHaveLength(3);
    expect(de).toContain("umfrage-sagt-nicht-warum");
    // EN now has its own authored articles (same slugs as DE).
    const en = getInsightSlugs("en");
    expect(en).toHaveLength(3);
    expect(en).toContain("umfrage-sagt-nicht-warum");
  });

  it("looks an article up within its own locale and returns that locale's copy", () => {
    const de = getInsight("umfrage-sagt-nicht-warum", "de");
    expect(de?.slug).toBe("umfrage-sagt-nicht-warum");
    expect(de?.locale ?? "de").toBe("de");
    expect(de?.title).toBe("Die Umfrage sagt 7 von 10. Sie sagt nicht, warum.");

    // The same slug under en resolves to the ENGLISH article, not the German one.
    const en = getInsight("umfrage-sagt-nicht-warum", "en");
    expect(en?.slug).toBe("umfrage-sagt-nicht-warum");
    expect(en?.locale).toBe("en");
    expect(en?.title).toBe("The survey says 7 out of 10. It doesn't say why.");

    expect(getInsight("does-not-exist", "de")).toBeUndefined();
  });

  it("orders each locale's articles newest-first", () => {
    const expectedOrder = [
      "voice-interviews-mehr-tiefe", // 2026-06-03
      "umfrage-sagt-nicht-warum", // 2026-05-20
      "dsgvo-native-ki-interviews", // 2026-05-06
    ];
    expect(insightsByDate("de").map((a) => a.slug)).toEqual(expectedOrder);
    // EN shares the same slugs + dates → same newest-first order.
    const en = insightsByDate("en");
    expect(en.map((a) => a.slug)).toEqual(expectedOrder);
    expect(en.every((a) => a.locale === "en")).toBe(true);
  });

  it("formats dates per locale", () => {
    expect(formatDate("2026-05-20", "de")).toBe("20. Mai 2026");
    expect(formatDate("2026-05-20", "en")).toBe("May 20, 2026");
  });
});
