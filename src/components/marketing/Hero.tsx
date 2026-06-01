import type { ReactNode } from "react";
import { Container, Section, Eyebrow } from "./primitives";
import { CtaLink } from "./CtaLink";
import { Reveal } from "./Reveal";

type Cta = { label: string; href: string };

/**
 * Reusable hero: eyebrow + H1 + subhead + up to two CTAs + optional trust
 * chips, with an optional side visual. Used on `/`, `/produkt` and (via
 * ModuleHero's shared shape) the module pages.
 */
export function Hero({
  eyebrow,
  title,
  subhead,
  primary,
  secondary,
  trust,
  visual,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subhead: ReactNode;
  primary: Cta;
  secondary?: Cta;
  trust?: string[];
  visual?: ReactNode;
}) {
  return (
    <Section className="pt-14 sm:pt-20">
      <Container>
        <div
          className={
            visual
              ? "grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]"
              : "max-w-3xl"
          }
        >
          <Reveal>
            <div className="flex flex-col items-start gap-6">
              {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
              <h1 className="font-marketing text-[clamp(36px,6vw,64px)] font-semibold leading-[1.04] tracking-[-0.03em] text-neutral-900">
                {title}
              </h1>
              <p className="max-w-xl text-[18px] leading-relaxed text-neutral-500">
                {subhead}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <CtaLink href={primary.href} variant="primary" size="lg">
                  {primary.label}
                </CtaLink>
                {secondary ? (
                  <CtaLink href={secondary.href} variant="secondary" size="lg">
                    {secondary.label}
                  </CtaLink>
                ) : null}
              </div>
              {trust?.length ? (
                <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-[12px] font-medium uppercase tracking-[0.04em] text-neutral-500">
                  {trust.map((t) => (
                    <li key={t} className="inline-flex items-center gap-2">
                      <span aria-hidden className="h-1 w-1 rounded-full bg-primary-400" />
                      {t}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Reveal>

          {visual ? (
            <Reveal delay={0.1} className="w-full">
              {visual}
            </Reveal>
          ) : null}
        </div>
      </Container>
    </Section>
  );
}
