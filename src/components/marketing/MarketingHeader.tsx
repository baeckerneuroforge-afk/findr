import Link from "next/link";
import { Container } from "./primitives";
import { CtaLink } from "./CtaLink";
import { Wordmark } from "./Wordmark";
import { MobileNav } from "./MobileNav";

/** Single source for the primary nav (desktop + mobile + footer reference). */
export const NAV_LINKS = [
  { label: "Plattform", href: "/produkt" },
  { label: "Lösungen", href: "/loesungen" },
  { label: "Preise", href: "/preise" },
  { label: "Insights", href: "/insights" },
];

/**
 * Sticky, hairline-bottomed header. Server component; the only interactive part
 * (mobile burger) is the <MobileNav> client child — the page stays a Server
 * Component so metadata works. (Befund 2.)
 */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Wordmark />

        <nav className="hidden items-center gap-8 md:flex" aria-label="Hauptnavigation">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded text-sm text-neutral-700 transition-colors hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
            >
              {l.label}
            </Link>
          ))}
        </nav>

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

        <MobileNav navLinks={NAV_LINKS} />
      </Container>
    </header>
  );
}
