import { describe, expect, it } from "vitest";

import de from "../../messages/de.json";
import en from "../../messages/en.json";

/**
 * Disclosure-Regression über die Konsoul-Twin-Texte (Art. 50(1) KI-VO + DSGVO).
 *
 * Wenn die Konsoul-Interviewer-Persona aktiv ist, sehen Teilnehmer die
 * `*Konsoul`-Varianten der Offenlegungs-/Consent-Texte. Diese müssen den
 * KI-Charakter weiterhin benennen — und dort, wo das Original die explizite
 * „kein Mensch"-Negation trägt (die zwei Vor-erster-Interaktion-Offenlegungen),
 * muss sie auch im Twin erhalten bleiben, NACHDEM „Konsoul" als Name ergänzt
 * wurde. messages-parity prüft nur die Key-STRUKTUR, nie die Werte — dieser Test
 * schließt die Inhalts-Lücke (sonst könnte ein Twin den „kein Mensch"-Teil
 * verlieren, ohne dass ein Test rot wird).
 */

function text(node: unknown, path: string): string {
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, node);
  if (typeof value !== "string") {
    throw new Error(`missing or non-string i18n key: ${path}`);
  }
  return value;
}

describe("Konsoul disclosure twins keep the AI + human-negation wording", () => {
  // The two genuine pre-interaction disclosures — name the AI AND negate a human.
  it("DE inviteConsent.introKonsoul: names Konsoul, the AI, and negates a human", () => {
    const t = text(de, "interview.inviteConsent.introKonsoul");
    expect(t).toContain("Konsoul");
    expect(t).toMatch(/künstlichen? Intelligenz/);
    expect(t).toContain("nicht mit einem Menschen");
  });

  it("EN inviteConsent.introKonsoul: names Konsoul, the AI, and negates a human", () => {
    const t = text(en, "interview.inviteConsent.introKonsoul").toLowerCase();
    expect(t).toContain("konsoul");
    expect(t).toContain("artificial intelligence");
    expect(t).toContain("not a human");
  });

  it("DE open.consent.introKonsoul: names Konsoul, the AI, and negates a human", () => {
    const t = text(de, "interview.open.consent.introKonsoul");
    expect(t).toContain("Konsoul");
    expect(t).toMatch(/künstlichen? Intelligenz/);
    expect(t).toContain("nicht mit einem Menschen");
  });

  it("EN open.consent.introKonsoul: names Konsoul, the AI, and negates a human", () => {
    const t = text(en, "interview.open.consent.introKonsoul").toLowerCase();
    expect(t).toContain("konsoul");
    expect(t).toContain("artificial intelligence");
    expect(t).toContain("not a human");
  });

  // The remaining participant-facing twins must still NAME the AI (KI/AI) and Konsoul.
  const NAMING_TWINS = [
    "interview.header.subtitleKonsoul",
    "interview.footer.brandlessKonsoul",
    "interview.footer.defaultKonsoul",
    "interview.voice.aiNoticeKonsoul",
    "interview.voiceLive.intro.bodyKonsoul",
  ];

  it("every Konsoul naming twin still names Konsoul AND the AI (KI/AI), both locales", () => {
    for (const path of NAMING_TWINS) {
      for (const [locale, node] of [
        ["de", de],
        ["en", en],
      ] as const) {
        const t = text(node, path);
        expect(t, `${locale}:${path} names Konsoul`).toContain("Konsoul");
        expect(t, `${locale}:${path} names the AI`).toMatch(/KI|AI/);
      }
    }
  });
});
