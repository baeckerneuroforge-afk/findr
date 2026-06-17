import { describe, expect, it } from "vitest";

import {
  localeOfPath,
  localizeHref,
  localizePath,
  MARKETING_DEFAULT_LOCALE,
  MARKETING_LOCALES,
  stripLocalePrefix,
} from "./marketing-locale";

describe("marketing-locale", () => {
  it("prefixes BOTH locales under their /[lang] segment", () => {
    expect(localizePath("de", "/produkt")).toBe("/de/produkt");
    expect(localizePath("en", "/produkt")).toBe("/en/produkt");
  });

  it("localizes the homepage root without a trailing slash", () => {
    expect(localizePath("de", "/")).toBe("/de");
    expect(localizePath("en", "/")).toBe("/en");
  });

  it("preserves anchors when prefixing", () => {
    expect(localizePath("en", "/produkt#voice")).toBe("/en/produkt#voice");
  });

  it("strips the locale prefix back to the canonical path", () => {
    expect(stripLocalePrefix("/de")).toBe("/");
    expect(stripLocalePrefix("/en")).toBe("/");
    expect(stripLocalePrefix("/de/produkt")).toBe("/produkt");
    expect(stripLocalePrefix("/en/branchen/b2c")).toBe("/branchen/b2c");
  });

  it("leaves an already-unprefixed path untouched (defensive)", () => {
    // "/ensemble" starts with "/en" but is not the en-locale prefix.
    expect(stripLocalePrefix("/ensemble")).toBe("/ensemble");
    expect(localeOfPath("/ensemble")).toBe("de");
  });

  it("derives the locale from the [lang] prefix", () => {
    expect(localeOfPath("/de")).toBe("de");
    expect(localeOfPath("/de/produkt")).toBe("de");
    expect(localeOfPath("/en")).toBe("en");
    expect(localeOfPath("/en/produkt")).toBe("en");
    // Unprefixed → default locale (these get 301'd to /de in next.config).
    expect(localeOfPath("/produkt")).toBe("de");
  });

  it("round-trips localize(localeOf, strip) back to a prefixed path", () => {
    for (const path of ["/de", "/de/produkt", "/en", "/en/preise"]) {
      expect(localizePath(localeOfPath(path), stripLocalePrefix(path))).toBe(
        path,
      );
    }
  });

  it("declares German as the default/x-default locale", () => {
    expect(MARKETING_DEFAULT_LOCALE).toBe("de");
    expect([...MARKETING_LOCALES]).toEqual(["de", "en"]);
  });
});

describe("localizeHref", () => {
  it("prefixes internal marketing links (incl. anchors)", () => {
    expect(localizeHref("de", "/produkt")).toBe("/de/produkt");
    expect(localizeHref("en", "/produkt#voice")).toBe("/en/produkt#voice");
    expect(localizeHref("en", "/")).toBe("/en");
    expect(localizeHref("en", "/branchen/b2c")).toBe("/en/branchen/b2c");
  });

  it("leaves external / protocol / anchor hrefs untouched", () => {
    expect(localizeHref("en", "https://cal.com/klymeo/demo")).toBe(
      "https://cal.com/klymeo/demo",
    );
    expect(localizeHref("en", "mailto:hi@klymeo.com")).toBe(
      "mailto:hi@klymeo.com",
    );
    expect(localizeHref("en", "#section")).toBe("#section");
  });

  it("leaves cross-root app/Clerk routes untouched", () => {
    expect(localizeHref("en", "/sign-in")).toBe("/sign-in");
    expect(localizeHref("en", "/sign-up")).toBe("/sign-up");
    expect(localizeHref("en", "/dashboard")).toBe("/dashboard");
    expect(localizeHref("en", "/interview/abc")).toBe("/interview/abc");
  });
});
