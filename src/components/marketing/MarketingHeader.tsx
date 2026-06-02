import Link from "next/link";
import { Container } from "./primitives";
import { CtaLink } from "./CtaLink";
import { Wordmark } from "./Wordmark";
import { MegaMenu } from "./MegaMenu";
import { MobileNav } from "./MobileNav";
import { PRIMARY_NAV } from "./nav-data";

/**
 * Sticky, hairline-bottomed header. Server component; the interactive parts (the
 * desktop <MegaMenu> dropdowns and the mobile <MobileNav> accordion) are the two
 * "use client" islands — the header itself stays a Server Component so page
 * metadata still works. Both islands read the SAME serializable nav registry
 * (PRIMARY_NAV from nav-data), which also feeds the footer and the sitemap.
 */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Wordmark />

        <MegaMenu nav={PRIMARY_NAV} />

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/sign-in"
            className="rounded px-2 text-sm text-neutral-700 transition-colors hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
          >
            Log in
          </Link>
          <CtaLink href="/sign-up" variant="secondary">
            Kostenlos testen
          </CtaLink>
          <CtaLink href="/demo" variant="primary">
            Demo buchen
          </CtaLink>
        </div>

        <MobileNav nav={PRIMARY_NAV} />
      </Container>
    </header>
  );
}
