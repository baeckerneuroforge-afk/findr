import { describe, expect, it } from "vitest";

import { buildAlternates, ogDefaultsFor, ogDefaults } from "./seo";

describe("ogDefaultsFor", () => {
  it("sets og:locale for the rendered locale and the other as alternate", () => {
    const de = ogDefaultsFor("de");
    expect(de.locale).toBe("de_DE");
    expect(de.alternateLocale).toEqual(["en_US"]);

    const en = ogDefaultsFor("en");
    expect(en.locale).toBe("en_US");
    expect(en.alternateLocale).toEqual(["de_DE"]);
  });

  it("leaves the legacy DE-only ogDefaults untouched (no alternateLocale)", () => {
    // Phase 1 must not change existing output: ogDefaults stays the bare DE
    // default that current pages spread.
    expect(ogDefaults.locale).toBe("de_DE");
    expect(ogDefaults.alternateLocale).toBeUndefined();
  });
});

describe("buildAlternates", () => {
  // Asymmetric scheme: German is unprefixed/canonical (unchanged since the
  // Lovable relaunch), only English sits under /en — NOT the symmetric
  // /de+/en scheme the dead (marketing)/[lang] tree used.
  it("self-references the canonical for the rendered locale (DE unprefixed, EN under /en)", () => {
    expect(buildAlternates("de", "/produkt").canonical).toBe("/produkt");
    expect(buildAlternates("en", "/produkt").canonical).toBe("/en/produkt");
  });

  it("emits the identical reciprocal hreflang map on both locale variants", () => {
    // x-default points at the German (default-locale) URL.
    const expected = {
      "de-DE": "/produkt",
      "en-US": "/en/produkt",
      "x-default": "/produkt",
    };
    expect(buildAlternates("de", "/produkt").languages).toEqual(expected);
    expect(buildAlternates("en", "/produkt").languages).toEqual(expected);
  });

  it("handles the homepage root path", () => {
    expect(buildAlternates("en", "/").languages).toEqual({
      "de-DE": "/",
      "en-US": "/en",
      "x-default": "/",
    });
  });
});
