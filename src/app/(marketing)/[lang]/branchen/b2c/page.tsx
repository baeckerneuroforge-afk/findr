import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import { localizedContent, resolveLocale } from "@/i18n/marketing-locale";
import {
  IndustryPage,
  type IndustryContent,
} from "@/components/marketing/industry-template";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/branchen/b2c";
const OG_TITLE = "Market Research für B2C & Konsumgüter — Klymeo";
const DESCRIPTION =
  "KI-Interviews mit echten Verbraucher:innen auf Deutsch — Produkt, Verpackung, Marke und Preisgefühl belegt prüfen, bevor Produktion und Mediabudget laufen. Mit Stimulus-Tests für Entwürfe, je Studie verankert, DSGVO-nativ.";

export const metadata: Metadata = {
  title: "Market Research für B2C & Konsumgüter",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Klymeo Market Research — B2C & Konsumgüter",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

const CONTENT: IndustryContent = {
  slug: "b2c",
  eyebrow: "Branche · B2C & Konsumgüter",
  heroTitle: <>Frag die Käufer, bevor das Regal antwortet.</>,
  heroSubhead:
    "Rezeptur, Verpackung, Preis, Markenversprechen — die teuren B2C-Entscheidungen fallen lange vor dem Abverkauf. Klymeo führt KI-Interviews mit echten Verbraucher:innen auf Deutsch, zeigt deine Entwürfe als Stimulus direkt im Gespräch und macht aus „den meisten gefällt’s“ eine belegte Zahl: je Studie verankert, deterministisch gezählt, nichts hochgerechnet.",
  audience:
    "Marken-, Insights- und E-Commerce-Teams im B2C — Lebensmittel, Getränke, Markenartikel, Handel und Consumer-Produkte.",
  pain: {
    eyebrow: "B2C · Der blinde Fleck",
    title: <>Abverkauf und Klickdaten zeigen, dass etwas liegen bleibt. Nicht, warum.</>,
    problem:
      "Panels sind langsam und teuer, Fokusgruppen verzerren durch die lauteste Stimme im Raum, und Abverkaufs- wie Shop-Daten melden erst, dass eine Variante liegen bleibt oder der Warenkorb abgebrochen wird, wenn die Entscheidung längst gefallen ist. Warum — zu süß, falsche Portionsgröße, eine Verpackung, die billiger wirkt als das Versprechen, ein Preis, der sich falsch anfühlt — steht in keinem Dashboard.",
    stakes: {
      strong: "Was offen bleibt, solange nur die Conversion spricht.",
      body: "Ob die Verpackung das Versprechen trägt, ob der Preis sitzt, ob die Marke noch meint, was sie meinen soll — das bleibt unbelegt, bis du die Käufer:innen selbst fragst. Eine Lücke, kein Drama: sie ist nur noch nicht gefüllt.",
    },
    blindCard: {
      badge: "Ohne O-Ton · nur Abverkauf",
      rows: [
        {
          label: "Was die Zahl zeigt",
          value: "Neue Variante: Wiederkaufrate liegt unter der gewohnten Rezeptur.",
        },
        {
          label: "Was die Zahl offenlässt",
          value:
            "Warum. Liegt es am Geschmack, am Preis, an der neuen Verpackung — oder daran, dass Stammkäufer:innen das gewohnte Produkt im Regal nicht mehr wiederfinden?",
        },
      ],
    },
  },
  howLead:
    "Vier verbundene Schritte — von der definierten Verbraucher-Studie bis zur Zahl, die jede Aussage je Studie mit einem Zitat belegt. Rekrutiert über Link oder Panel, ohne Moderator, ohne Wochen Vorlauf.",
  solution: {
    eyebrow: "B2C · Die belegte Antwort",
    title: <>Vom Bauchgefühl im Tasting-Raum zur belegten Verbraucherstimme.</>,
    body: "Setz für jede Frage eine eigene Studie auf — Rezeptur-Test, Packaging-Vergleich, Preiswahrnehmung, Markenbild. Screening-Gate und Quoten stellen sicher, dass nur Käufer:innen deiner Kategorie ins Interview kommen, nicht zufällige Klicks. Klymeo interviewt auf Deutsch — auf Wunsch hörbar per Voice-Agent — und trennt mit der Markt-Linse Preis-Signal, Kaufabsicht, Segment und Wettbewerb; über mehrere Studien hinweg wird deterministisch gezählt, je Studie mit Zitat belegt.",
    payoff: {
      strong: "Eine Zahl, die du im Innovationsboard verteidigst.",
      body: "Fragt jemand „wie viele sagen das wirklich?“, zeigst du die Zahl — und das Zitat aus der jeweiligen Studie daneben. Nichts hochgerechnet.",
    },
    answerCard: {
      badge: "Markt-Linse · je Studie belegt",
      rows: [
        {
          label: "Frage",
          value: "Was hält Stammkäufer:innen von der neuen Rezeptur ab?",
        },
        {
          label: "Antwort",
          value:
            "In 4 von 6 Verbraucher-Studien nannten Teilnehmer:innen die süßere Note als Grund zum Wechsel — jede mit Zitat aus der jeweiligen Studie belegt.",
        },
        {
          label: "Beleg aus einem Interview",
          quote: true,
          value:
            "„Das war früher mein Feierabend-Riegel — die neue Version ist mir ehrlich zu süß, ich greif jetzt zum No-Name daneben.“",
        },
      ],
    },
  },
  proactive: {
    eyebrow: "B2C · Vor dem Launch",
    title: <>Test das Konzept, bevor die erste Charge läuft.</>,
    body: "Dieselbe Studie funktioniert auch andersherum: nicht erst deuten, was der Abverkauf meldet, sondern vorher fragen, ob die Idee trägt. Lade Rezeptur-Konzept, Verpackungsmuster oder Kampagnen-Entwurf als Stimulus in die Studie — echte Käufer:innen deiner Kategorie sehen genau dieses Material im KI-Interview und nehmen direkt Bezug, bevor Produktion, Listung und Mediabudget gebunden sind.",
    payoff: {
      strong: "Eine belegte Grundlage fürs Go oder No-Go — vor dem Produktionslauf.",
      body: "Statt nach dem Launch aus Abverkaufszahlen zu lernen, gehst du mit einer Zahl ins Innovationsboard, die zeigt, wie viele die Idee wirklich kaufen würden — und woran die anderen zögern.",
    },
    card: {
      badge: "Stimulus-Test · vor der Produktion",
      rows: [
        {
          label: "Frage",
          value: "Trägt das neue Verpackungsdesign das Markenversprechen?",
        },
        {
          label: "Antwort",
          value:
            "In 3 von 4 Konzept-Studien wurde der Entwurf als hochwertiger gelesen — zwei Studien zeigten: der Preis wird auf der Front vermisst. Jede Zahl mit Zitat belegt.",
        },
        {
          label: "Beleg aus einem Interview",
          quote: true,
          value:
            "„Das Dunkelblau wirkt deutlich edler als vorher — aber ich finde nirgends, was es kostet, und das macht mich stutzig.“",
        },
      ],
    },
  },
  proofLead:
    "Jede Fähigkeit arbeitet an echten Interviews mit echten Verbraucher:innen — vom Voice-Interview bis zum PowerPoint-Export.",
  cta: {
    title: <>Frag die Käufer, bevor die Charge läuft.</>,
    lead: "Buch eine Demo und sieh, wie Klymeo eine Verbraucherfrage über mehrere Studien beantwortet — deterministisch gezählt, je Studie belegt.",
  },
};

const CONTENT_EN: IndustryContent = {
  slug: "b2c",
  eyebrow: "Industry · B2C & Consumer Goods",
  heroTitle: <>Ask the buyers before the shelf answers for them.</>,
  heroSubhead:
    "Recipe, packaging, price, brand promise — the expensive B2C decisions are made long before anything sells. Klymeo runs AI interviews with real consumers in German and English, shows your drafts as a Stimulus right inside the conversation, and turns “most people like it” into an evidenced number: anchored per study, deterministically counted, nothing extrapolated.",
  audience:
    "Brand, insights, and e-commerce teams in B2C — food, beverages, branded goods, retail, and consumer products.",
  pain: {
    eyebrow: "B2C · The blind spot",
    title: <>Sales and click data show that something is being left on the shelf. Not why.</>,
    problem:
      "Panels are slow and expensive, focus groups skew toward the loudest voice in the room, and sales and shop data only report that a variant isn’t moving or that the cart was abandoned once the decision has long been made. Why — too sweet, the wrong portion size, packaging that looks cheaper than the promise, a price that just feels wrong — shows up in no dashboard.",
    stakes: {
      strong: "What stays open as long as only conversion is talking.",
      body: "Whether the packaging carries the promise, whether the price lands, whether the brand still means what it’s supposed to mean — all of it stays unevidenced until you ask the buyers themselves. A gap, not a drama: it’s simply not filled yet.",
    },
    blindCard: {
      badge: "Without verbatim · sales only",
      rows: [
        {
          label: "What the number shows",
          value: "New variant: repeat-purchase rate is below the familiar recipe.",
        },
        {
          label: "What the number leaves open",
          value:
            "Why. Is it the taste, the price, the new packaging — or that loyal buyers can no longer find the familiar product on the shelf?",
        },
      ],
    },
  },
  howLead:
    "Four connected steps — from a defined consumer study to the number that backs every statement, per study, with a quote. Recruited by link or panel, with no moderator and no weeks of lead time.",
  solution: {
    eyebrow: "B2C · The evidenced answer",
    title: <>From a gut feeling in the tasting room to an evidenced consumer voice.</>,
    body: "Set up a separate study for every question — recipe test, packaging comparison, price perception, brand image. A screening gate and quotas make sure only buyers in your category reach the interview, not random clicks. Klymeo interviews in German and English — audibly via Voice Agent if you want — and uses the Market Lens to separate pricing signal, purchase intent, segment, and competition; across multiple studies it counts deterministically, backed by a quote per study.",
    payoff: {
      strong: "A number you can defend in the innovation board.",
      body: "When someone asks “how many actually say that?”, you show the number — and the quote from the relevant study right beside it. Nothing extrapolated.",
    },
    answerCard: {
      badge: "Market Lens · evidenced per study",
      rows: [
        {
          label: "Question",
          value: "What keeps loyal buyers from switching to the new recipe?",
        },
        {
          label: "Answer",
          value:
            "In 4 of 6 consumer studies, participants named the sweeter note as the reason to switch — each backed by a quote from the relevant study.",
        },
        {
          label: "Evidence from an interview",
          quote: true,
          value:
            "“This used to be my after-work treat — the new version is honestly too sweet for me, now I reach for the store brand next to it.”",
        },
      ],
    },
  },
  proactive: {
    eyebrow: "B2C · Before launch",
    title: <>Test the concept before the first batch runs.</>,
    body: "The same study works the other way around too: instead of interpreting what sales report, ask up front whether the idea holds. Load a recipe concept, packaging sample, or campaign draft into the study as a Stimulus — real buyers in your category see exactly that material in the AI interview and respond to it directly, before production, listing, and media budget are committed.",
    payoff: {
      strong: "An evidenced basis for go or no-go — before the production run.",
      body: "Instead of learning from sales figures after launch, you walk into the innovation board with a number showing how many would actually buy the idea — and what makes the others hesitate.",
    },
    card: {
      badge: "Stimulus test · before production",
      rows: [
        {
          label: "Question",
          value: "Does the new packaging design carry the brand promise?",
        },
        {
          label: "Answer",
          value:
            "In 3 of 4 concept studies the draft was read as more premium — two studies showed the price is missed on the front. Every number backed by a quote.",
        },
        {
          label: "Evidence from an interview",
          quote: true,
          value:
            "“The dark blue looks far more premium than before — but I can’t find what it costs anywhere, and that makes me wary.”",
        },
      ],
    },
  },
  proofLead:
    "Every capability works on real interviews with real consumers — from the voice interview to the PowerPoint export.",
  cta: {
    title: <>Ask the buyers before the batch runs.</>,
    lead: "Book a demo and see how Klymeo answers a consumer question across multiple studies — deterministically counted, evidenced per study.",
  },
};

export default async function B2cPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />
      <IndustryPage
        content={localizedContent(lang, { de: CONTENT, en: CONTENT_EN })}
        locale={resolveLocale(lang)}
      />
    </>
  );
}
