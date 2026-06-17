import Link from "next/link";
import { Container } from "./primitives";
import { CtaLink } from "./CtaLink";
import { Wordmark } from "./Wordmark";
import { MegaMenu } from "./MegaMenu";
import { MobileNav } from "./MobileNav";
import { MarketingLanguageSwitcher } from "./MarketingLanguageSwitcher";
import { StudioHeaderBar } from "./studio/StudioHeaderBar";
import { PRIMARY_NAV, localizeNav } from "./nav-data";
import {
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
  // Localize the nav hrefs server-side ONCE; the client islands (MegaMenu /
  // MobileNav) stay locale-agnostic and just render what they receive.
  const nav = localizeNav(PRIMARY_NAV, lang);
  return (
    <StudioHeaderBar>
      <Container className="flex h-16 items-center justify-between gap-4">
        <Wordmark href={localizePath(lang, "/")} />

        <MegaMenu nav={nav} />

        <div className="hidden items-center gap-3 md:flex">
          <MarketingLanguageSwitcher />
          <span aria-hidden className="h-4 w-px bg-neutral-200" />
          <Link
            href="/sign-in"
            className="rounded px-2 font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-500 transition-colors hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
          >
            Log in
          </Link>
          <CtaLink href={DEMO_BOOKING_URL} variant="primary">
            Demo buchen
          </CtaLink>
        </div>

        <MobileNav nav={nav} />
      </Container>
    </StudioHeaderBar>
  );
}
