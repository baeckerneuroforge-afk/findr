import type { ReactNode } from "react";
import { Container } from "./primitives";
import { CtaLink } from "./CtaLink";
import { Reveal } from "./Reveal";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";

type Cta = { label: string; href: string };

/**
 * Reusable closing CTA block — rendered at the foot of every marketing page.
 * Studio-Fassung: der dunkle Anker (Studio-Dunkel, st-on-dark), der direkt in
 * den dunklen Footer fließt — große Bricolage-Headline, REC-roter Pill-CTA,
 * Mono-Notiz. Pages override `title`/`lead`/CTAs as needed (gleiche API).
 */
export function CTASection({
  eyebrow = "Bereit?",
  title = <>Frag die echten Stimmen an deinem Markt.</>,
  lead = "Sieh, was Klymeo in echten Tiefeninterviews mit deiner Zielgruppe findet — KI-geführt, auf Deutsch und DSGVO-nativ.",
  primary = { label: "Demo buchen →", href: DEMO_BOOKING_URL },
  secondary = { label: "Preise ansehen", href: "/preise" },
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  primary?: Cta;
  secondary?: Cta | null;
}) {
  return (
    <section className="st-on-dark relative overflow-hidden bg-anchor py-[clamp(90px,13vh,160px)]">
      <Container>
        <Reveal>
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center gap-3 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-[#ff8a75]">
              {eyebrow}
              <span aria-hidden className="h-px w-10 bg-white/15" />
            </span>
            <h2 className="font-marketing max-w-[18ch] text-[clamp(32px,5.5vw,76px)] font-bold leading-[1.02] tracking-[-0.025em] text-anchor-foreground">
              {title}
            </h2>
            <p className="max-w-xl text-[17px] leading-relaxed text-anchor-foreground/65">
              {lead}
            </p>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center">
              <CtaLink href={primary.href} variant="primary" size="lg" className="magnetic">
                <span className="st-dot" aria-hidden />
                {primary.label.replace(/\s*→\s*$/, "")}
              </CtaLink>
              {secondary ? (
                <CtaLink href={secondary.href} variant="secondary" size="lg" className="magnetic">
                  {secondary.label}
                </CtaLink>
              ) : null}
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
