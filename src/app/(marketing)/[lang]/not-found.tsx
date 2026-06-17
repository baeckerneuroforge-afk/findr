import { CtaLink } from "@/components/marketing/CtaLink";
import { Container } from "@/components/marketing/primitives";

/**
 * Marketing-tree 404. Renders INSIDE the marketing root layout (header/footer
 * + .studio surface come from there — unlike the old shared-root version,
 * which had to bring its own chrome over the dark app body).
 */
export default function NotFound() {
  return (
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
  );
}
