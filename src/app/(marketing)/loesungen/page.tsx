import type { Metadata } from "next";
import { Hero } from "@/components/marketing/Hero";
import { RoleCards, ROLES } from "@/components/marketing/role-template";
import { FAQ, type FaqItem } from "@/components/marketing/FAQ";
import { CTASection } from "@/components/marketing/CTASection";
import { JsonLd } from "@/components/marketing/JsonLd";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/loesungen";
const OG_TITLE = "Lösungen — findr.";
const DESCRIPTION =
  "Wähl deine Rolle: Sales-Leader, Customer Success oder Product & Research. Was heute weh tut, wie findr. es löst und woran du es belegst — eine Plattform, ein Beleg-Standard. DSGVO-nativ.";

export const metadata: Metadata = {
  title: "Lösungen",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

/*
 * /loesungen is the B2B ROLE HUB. It introduces the three roles and links to
 * their dedicated pages (/loesungen/<slug>) — the B2B counterpart of the B2C
 * industry hub feel under /branchen. The detailed Problem→Lösung→Modul→Beleg
 * story that used to live in three UseCase sections here now lives on each role
 * page; the hub keeps the overview cards + the platform-level FAQ + the CTA.
 * Copy status: NEUER ENTWURF — André schärft nach. No prices.
 */

// CollectionPage listing the three role pages — lightweight, valid hub schema.
const COLLECTION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "findr. Lösungen nach Rolle",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
  mainEntity: {
    "@type": "ItemList",
    itemListElement: ROLES.map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: r.name,
      url: `${SITE_URL}/loesungen/${r.slug}`,
    })),
  },
};

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
    a: "Mit der Rolle, deren Problem heute am meisten weh tut. Die Plattform ist ein KI-Gehirn — weitere Module schalten sich später auf denselben Daten dazu, ohne neues Setup.",
  },
];

export default function LoesungenPage() {
  return (
    <>
      <JsonLd data={COLLECTION_JSONLD} />

      <Hero
        eyebrow="Lösungen"
        title={<>Wähl deine Rolle — findr. liefert den Beleg.</>}
        subhead="findr. ist eine Plattform: vier Produkte auf einem KI-Gehirn. Aber du löst damit ein konkretes Problem. Hier nach Rolle sortiert — was heute weh tut, wie findr. es löst und woran du es belegst."
        primary={{ label: "Demo buchen →", href: "/demo" }}
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />

      <RoleCards />

      <FAQ
        eyebrow="Häufige Fragen"
        title={<>Was Teams uns zuerst fragen.</>}
        items={FAQ_ITEMS}
        tone="muted"
      />

      <CTASection
        title={<>Such dir die Rolle — findr. belegt die Lösung.</>}
        lead="Buch eine Demo und sieh am echten Gespräch, was findr. für deine Rolle heute schon findet."
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />
    </>
  );
}
