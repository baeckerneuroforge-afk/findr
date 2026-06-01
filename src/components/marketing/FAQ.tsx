import type { ReactNode } from "react";
import { Container, Section, SectionHeading } from "./primitives";
import { Reveal } from "./Reveal";

export type FaqItem = { q: string; a: ReactNode };

/**
 * Accordion FAQ (§2.2). Built on native <details>/<summary> — fully static,
 * keyboard-accessible and no client JS, so the page stays a Server Component.
 * Used on /preise and /loesungen. Default open marker hidden; a "+" rotates to
 * "×" on open via the group-open variant.
 */
export function FAQ({
  eyebrow = "FAQ",
  title,
  lead,
  items,
  tone = "default",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  items: FaqItem[];
  tone?: "default" | "wash" | "muted";
}) {
  return (
    <Section tone={tone}>
      <Container>
        <Reveal>
          <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />
        </Reveal>
        <div className="mx-auto mt-12 max-w-3xl border-y border-neutral-200">
          {items.map((it) => (
            <details
              key={it.q}
              className="group border-b border-neutral-200 last:border-b-0"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded py-5 text-left text-[16px] font-medium text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                {it.q}
                <span
                  aria-hidden
                  className="shrink-0 text-xl leading-none text-primary-600 transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="pb-5 pr-8 text-[15px] leading-relaxed text-neutral-500">
                {it.a}
              </div>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
