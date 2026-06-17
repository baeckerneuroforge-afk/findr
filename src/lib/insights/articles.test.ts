import { describe, expect, it } from "vitest";

import {
  formatDate,
  getInsight,
  getInsightSlugs,
  insightsByDate,
} from "./articles";

/**
 * Locks the per-locale insights contract (Paket 6): insights are authored
 * editorial — NOT machine-translated — so German has articles and English is
 * deliberately empty until EN articles are written. If someone adds an EN
 * article (or breaks the locale filter), these change on purpose.
 */
describe("insights locale model", () => {
  it("serves the German articles for de and nothing for en yet", () => {
    const de = getInsightSlugs("de");
    expect(de).toHaveLength(3);
    expect(de).toContain("umfrage-sagt-nicht-warum");
    // EN is authored separately → empty today (drives the /en empty state +
    // the /en/insights/[slug] 404 via dynamicParams=false).
    expect(getInsightSlugs("en")).toEqual([]);
  });

  it("looks an article up only within its own locale", () => {
    expect(getInsight("umfrage-sagt-nicht-warum", "de")?.slug).toBe(
      "umfrage-sagt-nicht-warum",
    );
    // Same slug is NOT served under en (no EN article exists).
    expect(getInsight("umfrage-sagt-nicht-warum", "en")).toBeUndefined();
    expect(getInsight("does-not-exist", "de")).toBeUndefined();
  });

  it("orders a locale's articles newest-first; en is empty", () => {
    expect(insightsByDate("de").map((a) => a.slug)).toEqual([
      "voice-interviews-mehr-tiefe", // 2026-06-03
      "umfrage-sagt-nicht-warum", // 2026-05-20
      "dsgvo-native-ki-interviews", // 2026-05-06
    ]);
    expect(insightsByDate("en")).toEqual([]);
  });

  it("formats dates per locale", () => {
    expect(formatDate("2026-05-20", "de")).toBe("20. Mai 2026");
    expect(formatDate("2026-05-20", "en")).toBe("May 20, 2026");
  });
});
