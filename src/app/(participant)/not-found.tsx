import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CtaLink } from "@/components/marketing/CtaLink";
import { Container } from "@/components/marketing/primitives";

/**
 * 404 für die Teilnehmer-Gruppe (participant) — z. B. ein ungültiger/abgelaufener
 * Interview-Token (page ruft notFound()). Eigenes not-found pro Root-Gruppe ist
 * das etablierte Muster (Twins in (app)/(marketing)); ohne dieses File fiele der
 * Teilnehmer auf das karge global-not-found statt auf diese Variante. Inhaltlich
 * identisch zum (app)-Twin: rendert seine eigene helle Fläche + Header/Footer
 * über dem dunklen Root-Body. (Header/Footer sind übersetzungs-/Clerk-frei.)
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-white font-body text-neutral-900 antialiased">
      <MarketingHeader />
      <main className="flex flex-1 items-center">
        <Container className="py-24">
          <div className="mx-auto flex max-w-lg flex-col items-center gap-5 text-center">
            <span className="font-marketing text-6xl font-semibold text-primary-600">
              404
            </span>
            <h1 className="font-marketing text-3xl font-semibold tracking-[-0.02em] text-neutral-900">
              Seite nicht gefunden.
            </h1>
            <p className="text-neutral-500">
              Diese Seite gibt es nicht (mehr). Vielleicht findest du über die
              Plattform, was du suchst.
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <CtaLink href="/" variant="primary">
                Zur Startseite
              </CtaLink>
              <CtaLink href="/produkt" variant="secondary">
                Plattform ansehen
              </CtaLink>
            </div>
          </div>
        </Container>
      </main>
      <MarketingFooter />
    </div>
  );
}
