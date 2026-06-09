import Link from "next/link";
import { Container } from "./primitives";
import { CtaLink } from "./CtaLink";
import { Wordmark } from "./Wordmark";
import { MegaMenu } from "./MegaMenu";
import { MobileNav } from "./MobileNav";
import { StudioHeaderBar } from "./studio/StudioHeaderBar";
import { PRIMARY_NAV } from "./nav-data";

/**
 * Studio-Header: sticky, oben transparent über dem Hero, ab dem ersten Scroll
 * Papier-Blur + Hairline (StudioHeaderBar, Client-Insel nur für den Zustand).
 * Inhalt bleibt server-gerendert; die interaktiven Teile sind wie zuvor die
 * zwei "use client"-Inseln MegaMenu (Desktop) und MobileNav (Burger). Beide
 * lesen dieselbe serialisierbare Nav-Registry (PRIMARY_NAV aus nav-data), die
 * auch Footer + Sitemap speist.
 */
export function MarketingHeader() {
  return (
    <StudioHeaderBar>
      <Container className="flex h-16 items-center justify-between gap-4">
        <Wordmark />

        <MegaMenu nav={PRIMARY_NAV} />

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/sign-in"
            className="rounded px-2 font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-500 transition-colors hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
          >
            Log in
          </Link>
          <CtaLink href="/demo" variant="primary">
            Demo buchen
          </CtaLink>
        </div>

        <MobileNav nav={PRIMARY_NAV} />
      </Container>
    </StudioHeaderBar>
  );
}
