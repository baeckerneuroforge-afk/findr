import { describe, expect, it } from "vitest";

import {
  deCanonicalPath,
  localeOfPath,
  localizePath,
  MARKETING_DEFAULT_LOCALE,
  MARKETING_LOCALES,
} from "./marketing-locale";

describe("marketing-locale", () => {
  it("keeps German at the bare path and prefixes English with /en", () => {
    expect(localizePath("de", "/produkt")).toBe("/produkt");
    expect(localizePath("en", "/produkt")).toBe("/en/produkt");
  });

  it("localizes the root without a trailing slash", () => {
    expect(localizePath("de", "/")).toBe("/");
    expect(localizePath("en", "/")).toBe("/en");
  });

  it("preserves anchors when prefixing", () => {
    expect(localizePath("en", "/produkt#voice")).toBe("/en/produkt#voice");
  });

  it("recovers the canonical German path from a prefixed one", () => {
    expect(deCanonicalPath("/en")).toBe("/");
    expect(deCanonicalPath("/en/produkt")).toBe("/produkt");
    expect(deCanonicalPath("/produkt")).toBe("/produkt");
  });

  it("does not strip /en from unrelated paths", () => {
    // "/ensemble" starts with "/en" but is not the en-locale prefix.
    expect(deCanonicalPath("/ensemble")).toBe("/ensemble");
    expect(localeOfPath("/ensemble")).toBe("de");
  });

  it("derives the locale from the pathname", () => {
    expect(localeOfPath("/")).toBe("de");
    expect(localeOfPath("/produkt")).toBe("de");
    expect(localeOfPath("/en")).toBe("en");
    expect(localeOfPath("/en/produkt")).toBe("en");
  });

  it("round-trips localize(localeOf, deCanonical) back to the original path", () => {
    for (const path of ["/", "/produkt", "/en", "/en/preise", "/branchen/b2c"]) {
      expect(localizePath(localeOfPath(path), deCanonicalPath(path))).toBe(path);
    }
  });

  it("declares German as the unprefixed default", () => {
    expect(MARKETING_DEFAULT_LOCALE).toBe("de");
    expect([...MARKETING_LOCALES]).toEqual(["de", "en"]);
  });
});
