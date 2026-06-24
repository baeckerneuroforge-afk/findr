import Link from "next/link";
import { Container } from "./primitives";
import { CtaLink } from "./CtaLink";
import { Wordmark } from "./Wordmark";
import { MegaMenu } from "./MegaMenu";
import { MobileNav } from "./MobileNav";
import { MarketingLanguageSwitcher } from "./MarketingLanguageSwitcher";
import { StudioHeaderBar } from "./studio/StudioHeaderBar";
import { getPrimaryNav } from "./nav-data";
import {
  localizedContent,
  localizePath,
  MARKETING_DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/marketing-locale";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";

/**
 * Studio-Header: sticky, oben transparent über dem Hero, ab dem ersten Scroll
 * Papier-Blur + Hairline (StudioHeaderBar, Client-Insel nur für den Zustand).
 * Inhalt bleibt server-gerendert; die interaktiven Teile sind wie zuvor die
 * zwei "use client"-Inseln MegaMenu (Desktop) und MobileNav (Burger). Beide
 * lesen dieselbe serialisierbare Nav-Registry (PRIMARY_NAV aus nav-data), die
 * auch Footer + Sitemap speist.
 */
export function MarketingHeader({
  lang = MARKETING_DEFAULT_LOCALE,
}: {
  // Optional: the [lang] layout always passes it; the global 404 pages
  // (outside the [lang] tree) reuse this chrome and fall back to German.
  lang?: Locale;
}) {
  // Localize nav (labels + hrefs) server-side ONCE; the client islands (MegaMenu
  // / MobileNav) stay locale-agnostic and just render what they receive. Chrome
  // labels (aria-labels + the demo CTA) are resolved here and passed down as
  // props so the islands never need the locale themselves.
  const nav = getPrimaryNav(lang);
  const demoLabel = localizedContent(lang, { de: "Demo buchen", en: "Book a demo" });
  const mainNavLabel = localizedContent(lang, {
    de: "Hauptnavigation",
    en: "Main navigation",
  });
  const mobileNavLabel = localizedContent(lang, {
    de: "Mobile-Navigation",
    en: "Mobile navigation",
  });
  const openMenuLabel = localizedContent(lang, { de: "Menü öffnen", en: "Open menu" });
  const closeMenuLabel = localizedContent(lang, {
    de: "Menü schließen",
    en: "Close menu",
  });
  return (
    <StudioHeaderBar>
      <Container className="st-bar flex h-16 items-center justify-between gap-3">
        <div className="st-seg st-seg--brand flex items-center">
          <Wordmark href={localizePath(lang, "/")} />
        </div>

        <div className="st-seg st-seg--main hidden flex-1 items-center justify-end gap-8 md:flex">
          <MegaMenu nav={nav} mainNav={mainNavLabel} />

          <div className="flex items-center gap-3">
            <MarketingLanguageSwitcher />
            <span aria-hidden className="h-4 w-px bg-neutral-200" />
            <Link
              href="/sign-in"
              className="st-navitem font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-500 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
            >
              Log in
            </Link>
            <CtaLink href={DEMO_BOOKING_URL} variant="primary">
              {demoLabel}
            </CtaLink>
          </div>
        </div>

        <MobileNav
          nav={nav}
          mobileNav={mobileNavLabel}
          openMenu={openMenuLabel}
          closeMenu={closeMenuLabel}
          demo={demoLabel}
        />
      </Container>
    </StudioHeaderBar>
  );
}
