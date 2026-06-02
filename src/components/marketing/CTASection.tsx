import type { ReactNode } from "react";
import { Container, Section, Eyebrow, Accent, CornerBrackets } from "./primitives";
import { CtaLink } from "./CtaLink";

type Cta = { label: string; href: string };

/**
 * Reusable closing CTA block — rendered at the foot of every marketing page.
 * Defaults reproduce the source's final-CTA copy (landing.html:1561–1567);
 * pages override `title`/`lead`/CTAs as needed.
 */
export function CTASection({
  eyebrow = "Bereit?",
  title = (
    <>
      Ein Gehirn für <Accent>jedes</Accent> Kundengespräch.
    </>
  ),
  lead = "Sieh, was findr. in deinen eigenen Gesprächen findet — über alle vier Produkte hinweg.",
  primary = { label: "Demo buchen →", href: "/demo" },
  secondary = { label: "Preise ansehen", href: "/preise" },
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  primary?: Cta;
  secondary?: Cta | null;
}) {
  return (
    // Farbsystem: the closing CTA stays a calm, light block on the warm canvas
    // (was a violet wash). The white card + violet brackets define it; the
    // primary CtaLink keeps violet as the interaction accent. The dark anchor
    // is the footer right below.
    <Section tone="default">
      <Container>
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-5 rounded border border-neutral-200 bg-white px-6 py-16 text-center sm:px-12">
          <CornerBrackets className="border-primary-300" />
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="font-marketing text-[clamp(26px,3.5vw,42px)] font-semibold leading-[1.1] tracking-[-0.02em] text-neutral-900">
            {title}
          </h2>
          <p className="max-w-xl text-[17px] leading-relaxed text-neutral-500">
            {lead}
          </p>
          <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
            <CtaLink href={primary.href} variant="primary" size="lg">
              {primary.label}
            </CtaLink>
            {secondary ? (
              <CtaLink href={secondary.href} variant="secondary" size="lg">
                {secondary.label}
              </CtaLink>
            ) : null}
          </div>
        </div>
      </Container>
    </Section>
  );
}
