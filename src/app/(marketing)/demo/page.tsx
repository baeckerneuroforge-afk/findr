import type { Metadata } from "next";
import {
  Container,
  Section,
  Eyebrow,
  CornerBrackets,
} from "@/components/marketing/primitives";
import { Hero } from "@/components/marketing/Hero";
import { CtaLink } from "@/components/marketing/CtaLink";
import { Reveal } from "@/components/marketing/Reveal";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";
import { ogDefaults } from "@/lib/marketing/seo";

const PATH = "/demo";
const OG_TITLE = "Demo buchen — Klymeo";
const DESCRIPTION =
  "Sieh in einer kurzen, persönlichen Demo, was Klymeo in echten Tiefeninterviews findet — vom Voice-Agent über Stimulus bis zum PowerPoint-Export. DSGVO-nativ, in der EU gehostet.";

export const metadata: Metadata = {
  title: "Demo buchen",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

export default function DemoPage() {
  return (
    <>
      <Hero
        eyebrow="Demo"
        title={
          <>
            Sieh, was Klymeo in deinen{" "}
            Gesprächen findet.
          </>
        }
        subhead="In einer kurzen, persönlichen Demo zeigen wir dir Klymeo an einem echten Studien-Beispiel — keine Folien, sondern deine Forschungsfrage: vom Voice-Interview über den Stimulus-Test bis zur exportierten Synthese."
        primary={{ label: "Termin buchen →", href: DEMO_BOOKING_URL }}
        secondary={{ label: "Lieber direkt testen", href: "/sign-up" }}
        // TODO D3: UWG-Claim — "DSGVO-nativ" ist eine werbliche Aussage, die vor
        // Live entweder belegt oder entschärft werden muss (Entscheidung André).
        trust={["DSGVO-nativ", "EU-gehostet · Frankfurt", "Keine Kreditkarte nötig"]}
      />

      {/* Buchungs-Bereich — handoff to the external Cal.com scheduler. We link
          out rather than iframe-embed the booking page; swap to a Cal embed
          here if an inline calendar is ever wanted. */}
      <Section tone="muted" className="pt-0 sm:pt-0">
        <Container>
          <Reveal>
            <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 rounded border border-neutral-200 bg-neutral-0 px-6 py-14 text-center sm:px-12">
              <CornerBrackets className="border-primary-300" />
              <Eyebrow>Termin wählen</Eyebrow>
              <h2 className="font-marketing text-[clamp(24px,3vw,34px)] font-semibold leading-[1.12] tracking-[-0.02em] text-neutral-900">
                15 Minuten, ein echtes Gespräch, deine Fragen.
              </h2>
              <p className="max-w-lg text-[16px] leading-relaxed text-neutral-500">
                Such dir einen Termin aus, der dir passt. Wir bringen eine
                anonymisierte Beispiel-Studie mit oder setzen direkt eine
                Studie zu deiner eigenen Forschungsfrage auf — du entscheidest,
                was wir uns ansehen.
              </p>
              <CtaLink href={DEMO_BOOKING_URL} variant="primary" size="lg">
                Termin bei Klymeo buchen →
              </CtaLink>
              <p className="text-sm text-neutral-500">
                Lieber sofort loslegen?{" "}
                <CtaLink href="/sign-up" variant="ghost" size="md" className="!h-auto !px-0 underline underline-offset-4">
                  14 Tage kostenlos testen
                </CtaLink>
              </p>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* Trust-Zeile (DSGVO/EU). */}
      <Section className="pt-0 sm:pt-0">
        <Container>
          <Reveal>
            {/* TODO D3: UWG-Claims ("DSGVO-nativ", "EU-AI-Act-konform") vor Live
                belegen oder entschärfen (Entscheidung André). */}
            <ul className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-neutral-200 pt-8 text-[13px] font-medium uppercase tracking-[0.04em] text-neutral-500">
              {[
                "DSGVO-nativ",
                "In der EU gehostet · Frankfurt",
                "EU-AI-Act-konform",
                "Keine Kreditkarte nötig",
              ].map((t) => (
                <li key={t} className="inline-flex items-center gap-2">
                  <span aria-hidden className="h-1 w-1 rounded-full bg-primary-400" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </Container>
      </Section>
    </>
  );
}
