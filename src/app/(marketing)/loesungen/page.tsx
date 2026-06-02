import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Container,
  Section,
  Eyebrow,
} from "@/components/marketing/primitives";
import { Reveal } from "@/components/marketing/Reveal";
import { Hero } from "@/components/marketing/Hero";
import {
  ExampleCard,
  type ExampleRow,
} from "@/components/marketing/module-template";
import { FAQ, type FaqItem } from "@/components/marketing/FAQ";
import { CTASection } from "@/components/marketing/CTASection";
import { ogDefaults } from "@/lib/marketing/seo";

const PATH = "/loesungen";
const OG_TITLE = "Lösungen — findr.";
const DESCRIPTION =
  "Was du mit findr. konkret machst — nach Rolle: Sales-Leader, Customer Success und Product/Research. Problem, Lösung, Modul und Beleg. Evidence-anchored, DSGVO-nativ.";

export const metadata: Metadata = {
  title: "Lösungen",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

/*
 * Copy status: NEUER ENTWURF (Etappe C) — abgeleitet aus den echten
 * Modul-Proof-Points (Etappe B), nicht neu erfunden. Jede Rolle verlinkt auf das
 * Modul, das das Problem heute löst; die Mini-Belege sind dieselben echten Zitate
 * wie auf den Modul-Seiten. André schärft die Copy nach.
 */

type ModuleRef = { slug: string; name: string };

function ModulePill({ slug, name }: ModuleRef) {
  return (
    <Link
      href={`/produkt/${slug}`}
      className="group inline-flex items-center gap-1.5 rounded border border-primary-200 bg-primary-50/60 px-3 py-1.5 text-[13px] font-medium text-primary-700 transition-colors hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
    >
      {name}
      <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}

function UseCase({
  eyebrow,
  title,
  problem,
  solution,
  modules,
  exampleBadge,
  exampleRows,
  tone = "default",
}: {
  eyebrow: string;
  title: ReactNode;
  problem: ReactNode;
  solution: ReactNode;
  modules: ModuleRef[];
  exampleBadge: string;
  exampleRows: ExampleRow[];
  tone?: "default" | "muted";
}) {
  return (
    <Section tone={tone}>
      <Container>
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="flex flex-col gap-5">
              <Eyebrow>{eyebrow}</Eyebrow>
              <h2 className="font-marketing text-[clamp(26px,3.5vw,40px)] font-semibold leading-[1.1] tracking-[-0.02em] text-neutral-900">
                {title}
              </h2>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                  Das Problem
                </div>
                <p className="mt-1.5 text-[16px] leading-relaxed text-neutral-500">
                  {problem}
                </p>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary-600">
                  Wie findr. es löst
                </div>
                <p className="mt-1.5 text-[16px] leading-relaxed text-neutral-700">
                  {solution}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[13px] text-neutral-400">Modul:</span>
                {modules.map((m) => (
                  <ModulePill key={m.slug} {...m} />
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <ExampleCard tone="neutral" badge={exampleBadge} rows={exampleRows} />
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Wie kommt findr. an meine Gespräche?",
    a: "Über deine bestehenden Konnektoren — Gong, Slack, Kalender. Kein Upload, kein manuelles Tagging. findr. liest die Calls mit, die du ohnehin führst.",
  },
  {
    q: "Spricht findr. Deutsch?",
    a: "Ja. KI-geführte Interviews und die Synthese laufen auf Deutsch — dort, wo rein englischsprachige Tools an ihre Grenzen kommen.",
  },
  {
    q: "Was heißt „belegt, nicht geraten“?",
    a: "Jedes Signal, jede Aussage und jede Empfehlung zitiert die exakte Stelle im Transkript. Was nicht belegt ist, sagt findr. nicht.",
  },
  {
    q: "Ist das DSGVO-konform?",
    a: "findr. ist in Deutschland gebaut, in Frankfurt gehostet und DSGVO-nativ — inklusive sauberer, anonymer Studien-Teilnahme.",
  },
  {
    q: "Womit fange ich an?",
    a: "Mit dem Modul, das heute am meisten weh tut. Die Plattform ist ein KI-Gehirn — weitere Module schalten sich später auf denselben Daten dazu, ohne neues Setup.",
  },
];

export default function LoesungenPage() {
  return (
    <>
      <Hero
        eyebrow="Lösungen"
        title={
          <>
            Was du mit findr. konkret machst.
          </>
        }
        subhead="findr. ist eine Plattform — aber du löst damit konkrete Probleme. Hier nach Rolle sortiert: was heute weh tut, wie findr. es löst und woran du es belegst."
        primary={{ label: "Demo buchen →", href: "/demo" }}
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />

      <UseCase
        tone="muted"
        eyebrow="Für Sales-Leader · VP Sales & RevOps"
        title={
          <>
            Wenn der Forecast erst beim verlorenen Deal{" "}
            ehrlich wird.
          </>
        }
        problem="Dein Forecast stützt sich auf CRM-Felder, die Reps optimistisch pflegen. Warum ein Deal wirklich kippt, erfährst du oft erst, wenn er schon weg ist."
        solution="findr. gibt jedem Deal einen 0–100-Risiko-Score nach jedem Call, belegt mit acht Signalen aus dem Transkript, erkennt den echten Verlustgrund und schiebt eine risiko-adjustierte Pipeline (Best / wahrscheinlich / Worst) direkt nach HubSpot."
        modules={[{ slug: "sales-intelligence", name: "Sales Intelligence" }]}
        exampleBadge="Champion-Verlust · Hohes Risiko"
        exampleRows={[
          {
            label: "Signal",
            value:
              "Der wirtschaftliche Champion ist intern abgesprungen — die Stage steht aber noch auf „Verhandlung“.",
          },
          {
            label: "Beleg aus dem Call",
            quote: true,
            value:
              "„Sarah war eigentlich die treibende Kraft auf unserer Seite — seit sie letzte Woche gegangen ist, liegt das Thema etwas auf Eis.“",
          },
        ]}
      />

      <UseCase
        eyebrow="Für CS-Leads · Customer Success"
        title={
          <>
            Wenn Renewals dich überraschen.
          </>
        }
        problem="Der Health-Score ist eine Bauchgefühl-Ampel in einer Tabelle, gepflegt nach der letzten Eskalation. Gefährdete Accounts fallen erst auf, wenn die Kündigung schon im Raum steht."
        solution="findr. berechnet den Health-Score pro Account aus echten Kunden-Calls, belegt jedes Risiko-Signal am Transkript, schlägt konkrete Save-Plays vor und rechnet einen deterministischen Renewal-Forecast — keine KI-Schätzung."
        modules={[
          { slug: "customer-health", name: "Customer Success Health" },
        ]}
        exampleBadge="Renewal-Risiko · Hoch"
        exampleRows={[
          {
            label: "Save-Play",
            value:
              "Neuen wirtschaftlichen Sponsor identifizieren und einen Quartals-Business-Review ansetzen, der den bisherigen ROI sichtbar macht — bevor die Renewal-Frage auf den Tisch kommt.",
          },
          {
            label: "Beleg aus dem Call",
            quote: true,
            value:
              "„Ehrlich, seit Marco weg ist, schaut bei uns keiner mehr richtig rein — wir nutzen gerade nur noch das Reporting.“",
          },
        ]}
      />

      <UseCase
        tone="muted"
        eyebrow="Für Product- & Research-Leads"
        title={
          <>
            Wenn die lauteste Stimme die Roadmap bestimmt.
          </>
        }
        problem="Entscheidungen fallen nach der lautesten Meinung im Raum. Interview-Insights verstauben in Notizen, die niemand mehr nachprüft — und „die meisten Kunden wollen X“ kann keiner belegen."
        solution="findr. zieht Voice of Customer aus deinen bestehenden Calls (Product Discovery) und fährt dedizierte KI-Interview-Studien mit echten Endnutzer:innen (Market Research). Jede Aussage ist am Transkript verankert; Cross-Study wird deterministisch gezählt — „in 3 von 7 Studien“, je belegt."
        modules={[
          { slug: "product-discovery", name: "Product Discovery" },
          { slug: "market-research", name: "Market Research" },
        ]}
        exampleBadge="Cross-Study · exakt gezählt"
        exampleRows={[
          {
            label: "Frage",
            value: "In wie vielen Studien kam Self-Service auf?",
          },
          {
            label: "Antwort",
            value:
              "In 3 von 7 Studien — jede mit einem Zitat aus der jeweiligen Studie belegt. Nichts hochgerechnet.",
          },
          {
            label: "Beleg aus einer Studie",
            quote: true,
            value:
              "„Ich will mich nicht durch ein Sales-Gespräch quälen — lass mich es einfach selbst ausprobieren.“",
          },
        ]}
      />

      <FAQ
        eyebrow="Häufige Fragen"
        title={
          <>
            Was Teams uns zuerst fragen.
          </>
        }
        items={FAQ_ITEMS}
      />

      <CTASection
        title={
          <>
            Such dir das Problem — findr. belegt die Lösung.
          </>
        }
        lead="Buch eine Demo und sieh am echten Gespräch, was findr. für deine Rolle heute schon findet."
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />
    </>
  );
}
