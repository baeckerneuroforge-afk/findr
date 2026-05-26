/**
 * Product Discovery Eval Dataset
 * ------------------------------
 * 8 hand-crafted cases for measuring the QUALITY of analyzeProductDiscovery().
 * Like the Solution eval and unlike the Risk/Health evals there is no
 * right/wrong label — items are judged on properties (anchored verbatim?
 * customer-spoken? dedup-clean? empty-when-it-should-be?) plus a human read.
 *
 * Coverage shape:
 *   pd_01 — pre-sale rich  (multiple feature requests, few pain points; pre-sale
 *                           has no installed product to fault yet)
 *   pd_02 — post-sale rich (multiple pain points; smaller wish list)
 *   pd_03 — MISSING_FEATURE ↔ NEW_CAPABILITY edge case (same content, both
 *                           framings explicit in the transcript)
 *   pd_04 — vendor hypotheticals (AE proposes features; customer's "vielleicht"
 *                           must NOT become a finding — only customer-initiated
 *                           wishes count)
 *   pd_05 — DO-NOT-DETECT traps (praise, pricing, sales-process complaint,
 *                           competitor wish without re-anchor → must yield empty)
 *   pd_06 — off-topic / no product talk → must yield FULLY EMPTY
 *   pd_07 — INTEGRATION (wish) vs INTEGRATION_GAP (pain) framing
 *   pd_08 — multi-theme clustering (3 items that should cluster into one theme)
 *
 * Language: DE ×6, EN ×2. Mix of speaker-prefixed line formats.
 *
 * Each case carries a `rationale` for the human reader (what this stresses)
 * and an `expected` digest of which categories *should* surface — used by the
 * runner only as a printed reference, NOT as a pass/fail gate (cf. Solution).
 */

import type {
  FeatureRequestCategory,
  PainPointCategory,
} from "@/lib/schemas/product-discovery";
import type { ProductDiscoveryInput } from "@/lib/product-discovery/prompts";

export interface ProductDiscoveryEvalCase {
  id: string;
  description: string;
  /** Pre-sale (deal context) or post-sale (account context). The classifier is
   *  etappe-agnostic; this tag is only for the human reader of the report. */
  etappe: "pre-sale" | "post-sale";
  input: ProductDiscoveryInput;
  /** Why this case exists / what it stresses. Read by humans, not the runner. */
  rationale: string;
  /** Categories we expect to surface. Printed by the runner as reference but
   *  never used as a hard pass/fail gate — manual read is the real judgement. */
  expected?: {
    featureRequests?: FeatureRequestCategory[];
    painPoints?: PainPointCategory[];
  };
  /** True if the case should yield COMPLETELY EMPTY featureRequests and
   *  painPoints. The runner has a dedicated check for this. */
  expectsEmpty?: boolean;
}

export const PRODUCT_DISCOVERY_EVAL_CASES: ProductDiscoveryEvalCase[] = [
  // ─── pd_01 ────────────────────────────────────────────────────────────────
  {
    id: "pd_01",
    description:
      "Pre-sale rich — HubSpot integration, CFO reporting, weekly manual export, API question",
    etappe: "pre-sale",
    input: {
      transcript: [
        "AE: Schön, dass wir heute sprechen. Erzählen Sie mal, wie Sie aktuell mit Vertriebsanalyse umgehen.",
        "Champion: Wir nutzen HubSpot als CRM, und ehrlich gesagt fehlt uns da die Verzahnung zu so einem Tool wie eurem. Wenn ihr da reinsyncen könntet, das wäre für uns ein riesiger Hebel.",
        "AE: Verstanden. Wie sieht denn euer Reporting heute aus?",
        "Champion: Das ist der größte Schmerz. Jeden Montagmorgen exportiere ich Zahlen aus drei Tools nach Excel und bastle daraus den Report für unseren CFO. Das kostet mich vier Stunden pro Woche. Wenn ihr ein Dashboard hättet, das ich direkt an den CFO durchstellen kann, würde mir das wirklich helfen.",
        "AE: Wie ist die technische Bereitschaft auf eurer Seite?",
        "Champion: Habt ihr eine API? Wir haben ein internes Data-Warehouse, da würden wir die Zahlen gern selbst weiterverarbeiten.",
        "AE: Ja, REST plus Webhooks. Lassen Sie uns das in der Demo nächste Woche zeigen.",
        "Champion: Perfekt.",
      ].join("\n"),
      account: {
        companyName: "Müller Logistik GmbH",
        sponsorName: "Frau Schneider (VP Sales)",
        productName: "Findr",
        orgName: "Findr GmbH",
      },
      recordedAt: "2026-05-15T10:00:00Z",
    },
    rationale:
      "Reichhaltige pre-sale Discovery. Erwartet: INTEGRATION (HubSpot — Tool ist explizit benannt), REPORTING (CFO-Dashboard), AUTOMATION (4h/Woche manueller Export, klar als manueller Schritt geframt), API. Pain Points sind eher leer: kein installiertes Produkt zu kritisieren — die heutige Mühe wird in die Wishes übersetzt. Stress-Test: bleibt die KI bei den 4 klaren FRs, oder erfindet sie Pains am Status-quo-Workflow?",
    expected: {
      featureRequests: ["INTEGRATION", "REPORTING", "AUTOMATION", "API"],
      painPoints: [],
    },
  },

  // ─── pd_02 ────────────────────────────────────────────────────────────────
  {
    id: "pd_02",
    description:
      "Post-sale rich — bug, sync performance, onboarding friction, hidden filter, audit-log wish",
    etappe: "post-sale",
    input: {
      transcript: [
        "CSM: Wir machen heute den Quartals-Check. Wie läuft es bei euch?",
        "Sponsor: Generell okay, aber ein paar Sachen nerven uns wirklich. Der CSV-Export hat seit zwei Wochen einen Bug — wir bekommen eine leere Datei, das hatten wir vorher nie.",
        "CSM: Das schreibe ich auf, da hängen wir uns dran.",
        "Sponsor: Dann der Sync zum CRM. Der dauert mittlerweile fast eine Stunde, das ist für unsere Vormittagsroutine zu lang.",
        "CSM: Und im Team?",
        "Sponsor: Mein neuer Kollege hat drei Wochen gebraucht, bis er sich zurechtgefunden hat. Die Anleitung war an mehreren Stellen veraltet, und das Filter-Menü findet wirklich niemand auf Anhieb — wir mussten ihm das einzeln zeigen.",
        "CSM: Verstanden. Gibt es darüber hinaus Dinge, die ihr euch zusätzlich wünscht?",
        "Sponsor: Ein Audit-Log wäre wirklich Gold wert. Wer hat wann was geändert — das brauchen wir jetzt zunehmend für unsere Compliance.",
      ].join("\n"),
      account: {
        companyName: "Bauer & Söhne AG",
        sponsorName: "Herr Lehmann (Head of Ops)",
        productName: "Findr",
        orgName: "Findr GmbH",
      },
      recordedAt: "2026-05-20T14:00:00Z",
    },
    rationale:
      "Reichhaltiger post-sale QBR. Erwartet: BUG (leerer CSV-Export), PERFORMANCE_ISSUE (Sync ~1h), ONBOARDING (3 Wochen + veraltete Anleitung), UX_FRICTION (Filter-Menü nicht auffindbar), plus eine NEW_CAPABILITY FR (Audit-Log für Compliance). Stress-Test: Stay-on-product (CSM-Antworten sind kurze Bestätigungen, sollten NIE Evidence sein) und keine Doppelzählung des Onboarding-Themas als zwei separate UX_FRICTION-Items.",
    expected: {
      featureRequests: ["NEW_CAPABILITY"],
      painPoints: [
        "BUG",
        "PERFORMANCE_ISSUE",
        "ONBOARDING",
        "UX_FRICTION",
      ],
    },
  },

  // ─── pd_03 ────────────────────────────────────────────────────────────────
  {
    id: "pd_03",
    description:
      "MISSING_FEATURE ↔ NEW_CAPABILITY edge — same item, both framings explicit",
    etappe: "post-sale",
    input: {
      transcript: [
        "CSM: Wo drückt der Schuh aktuell am meisten?",
        "Sponsor: Uns fehlt eine Rollen- und Rechteverwaltung. Komplett. Aktuell sehen alle alles, und das ist für unsere Mandanten-Struktur ein echtes Problem — wir können das so unseren Endkunden gar nicht ausrollen.",
        "CSM: Wie behelft ihr euch heute?",
        "Sponsor: Wir pflegen das in einer separaten Excel und prüfen vor jedem Export von Hand, wer was sehen darf. Das ist fehleranfällig und nicht skalierbar. Letzten Monat ist uns einmal etwas durchgerutscht.",
        "CSM: Verstanden — kommt auf die Roadmap-Diskussion.",
      ].join("\n"),
      account: {
        companyName: "Schmidt Consulting GmbH",
        sponsorName: "Frau Becker (CTO)",
        productName: "Findr",
        orgName: "Findr GmbH",
      },
      recordedAt: "2026-05-22T09:00:00Z",
    },
    rationale:
      "Der Kunde framet DASSELBE Thema zweimal: als Wunsch (\"uns fehlt eine Rollen- und Rechteverwaltung\") UND als heutigen Schmerz (\"wir pflegen das in Excel, fehleranfällig, einmal durchgerutscht\"). Erwartet laut DEDUP-Regel: 1× NEW_CAPABILITY FR + 1× MISSING_FEATURE PP, verbunden via Theme. Stress-Test der DEDUP-Heuristik: NICHT zwei separate FRs oder zwei separate PPs erzeugen, sondern genau eines pro Layer.",
    expected: {
      featureRequests: ["NEW_CAPABILITY"],
      painPoints: ["MISSING_FEATURE"],
    },
  },

  // ─── pd_04 ────────────────────────────────────────────────────────────────
  {
    id: "pd_04",
    description:
      "Vendor hypotheticals — AE pitches features, customer says \"vielleicht\"; only customer-initiated wish should count",
    etappe: "pre-sale",
    input: {
      transcript: [
        "AE: Wir bauen gerade ein Reporting-Dashboard speziell für Finance-Use-Cases. Könnte das für euren CFO interessant sein?",
        "Champion: Ja, vielleicht. Müsste man mal sehen.",
        "AE: Und wir könnten auch eine Slack-Integration für Echtzeit-Alerts mitbringen, die ist bei uns auf der Roadmap.",
        "Champion: Klingt interessant.",
        "AE: Wo seht ihr aktuell den größten Hebel auf eurer Seite?",
        "Champion: Was wir wirklich, wirklich brauchen, ist eine Möglichkeit das im Außendienst auf dem Handy zu bedienen. Meine sieben Vertriebsleute sind den ganzen Tag beim Kunden, und wenn die nicht direkt vor Ort eintragen können, kommt nichts Verwertbares zurück.",
      ].join("\n"),
      account: {
        companyName: "Hoffmann Maschinenbau GmbH",
        sponsorName: "Herr Krause (Sales Director)",
        productName: "Findr",
        orgName: "Findr GmbH",
      },
      recordedAt: "2026-05-23T11:00:00Z",
    },
    rationale:
      "Die ersten beiden Wishes (Finance-Dashboard, Slack-Integration) sind AE-Hypothesen. Der Kunde antwortet mit \"vielleicht\" / \"klingt interessant\" — KEINE klare Übernahme, und der Vorschlag stammt VOM VENDOR. Das DO-NOT-DETECT \"only what the CUSTOMER says counts\" muss greifen. Erwartet: GENAU EINE FR (MOBILE, \"Außendienst\"), beide Vendor-Pitches NICHT als FR. Stress-Test: no-vendor-Check (Evidence darf NICHT auf einer AE-Zeile liegen).",
    expected: {
      featureRequests: ["MOBILE"],
      painPoints: [],
    },
  },

  // ─── pd_05 ────────────────────────────────────────────────────────────────
  {
    id: "pd_05",
    description:
      "DO-NOT-DETECT traps — praise + pricing + sales-process complaint, no product wish",
    etappe: "post-sale",
    input: {
      transcript: [
        "CSM: Wie zufrieden seid ihr insgesamt mit dem Tool?",
        "Sponsor: Ehrlich gesagt sehr zufrieden. Das Tool läuft sauber, macht was es soll, und das Team ist eingespielt.",
        "CSM: Schön zu hören. Gibt es Themen, die wir besprechen sollten?",
        "Sponsor: Ein Thema ist der Preis. Bei der letzten Verlängerung ist die Lizenz um 22 % gestiegen, das fanden wir intern schwer zu rechtfertigen. Da müssen wir bei der nächsten Runde reden.",
        "CSM: Das nehme ich mit. Sonst noch was?",
        "Sponsor: Auf unsere Angebotsanfrage für die Erweiterung im März haben wir drei Wochen warten müssen. Das war nicht schön — euer Vertrieb war zu langsam. Aber das hat ja nichts mit dem Produkt zu tun.",
        "CSM: Verstanden, das gebe ich an den Account-Lead weiter.",
      ].join("\n"),
      account: {
        companyName: "Weber Industries GmbH",
        sponsorName: "Frau Hartmann (COO)",
        productName: "Findr",
        orgName: "Findr GmbH",
      },
      recordedAt: "2026-05-24T15:00:00Z",
    },
    rationale:
      "Drei DO-NOT-DETECT-Fallen: (1) Produktlob \"läuft sauber, macht was es soll\" → Health-Signal, kein Produkt-Feedback. (2) Preis-Beschwerde → kommerziell, kein Produkt. (3) Sales-Prozess-Beschwerde (\"euer Vertrieb war zu langsam\") → Sales-Motion, ausdrücklich vom Kunden als nicht-produktbezogen markiert. Erwartet: featureRequests = [], painPoints = []. Summary darf zusammenfassen, dass nichts Produkt-Spezifisches kam.",
    expectsEmpty: true,
  },

  // ─── pd_06 ────────────────────────────────────────────────────────────────
  {
    id: "pd_06",
    description:
      "Off-topic — scheduling and personal small-talk, zero product content",
    etappe: "pre-sale",
    input: {
      transcript: [
        "AE: Hi, ich hatte versucht Sie gestern zu erreichen — passt heute fünf Minuten für Terminierung?",
        "Champion: Ja, kurz. Ich bin nächste Woche im Urlaub, danach hätte ich Donnerstag oder Freitag 14 Uhr.",
        "AE: Donnerstag passt mir besser. Soll ich Frau Klein und Herrn Wagner direkt dazu einladen?",
        "Champion: Ja gern, beide. Schicken Sie die Einladung an meine Sekretärin in cc.",
        "AE: Mach ich. Schönen Urlaub schon mal.",
        "Champion: Danke, ebenfalls schönen Tag.",
      ].join("\n"),
      account: {
        companyName: "Becker GmbH",
        sponsorName: "Herr Vogel (Geschäftsführer)",
        productName: "Findr",
        orgName: "Findr GmbH",
      },
      recordedAt: "2026-05-25T08:30:00Z",
    },
    rationale:
      "Kein einziges Wort zum Produkt — Terminabsprache + Smalltalk. Erwartet: featureRequests = [], painPoints = [], themes = [], summary = ein-Satz-Hinweis, dass das Gespräch keinen Produktinhalt enthielt. Härtester Empty-Test: wenn die KI hier irgendwas extrahiert, halluziniert sie.",
    expectsEmpty: true,
  },

  // ─── pd_07 ────────────────────────────────────────────────────────────────
  {
    id: "pd_07",
    description:
      "INTEGRATION wish vs INTEGRATION_GAP pain — same call, two different tools, two framings",
    etappe: "post-sale",
    input: {
      transcript: [
        "CSM: Was würde euer Setup als Nächstes nach vorne bringen?",
        "Sponsor: Wir nutzen Salesforce. Wenn ihr da eine native Anbindung hättet, das wäre wirklich nice — aktuell behelfen wir uns mit einem Zapier-Workaround, der läuft aber halbwegs.",
        "CSM: Notiert. Sonst etwas?",
        "Sponsor: Was uns wirklich blockt: wir kriegen die Zahlen nicht in unseren BI-Stack rein. Wir nutzen Looker, und weil es da keine Anbindung gibt, müssen wir jede Woche manuell CSVs ziehen und uploaden. Das frisst uns einen halben Tag und ist obendrein fehleranfällig.",
        "CSM: Verstehe — wie hoch ist die Priorität?",
        "Sponsor: Hoch. Wenn das in den nächsten zwei Quartalen nichts wird, müssen wir intern nochmal über die Architektur diskutieren.",
      ].join("\n"),
      account: {
        companyName: "Frey Analytics GmbH",
        sponsorName: "Frau Sommer (Head of Data)",
        productName: "Findr",
        orgName: "Findr GmbH",
      },
      recordedAt: "2026-05-26T10:30:00Z",
    },
    rationale:
      "Zwei Integrationen, bewusst unterschiedlich geframet: (a) Salesforce — \"wäre nice\", existierender Workaround → INTEGRATION FR. (b) Looker BI — \"blockt uns\", halber Tag manueller Aufwand pro Woche, droht Architektur-Diskussion → INTEGRATION_GAP PP. Stress-Test der Framing-Distinktion: Wenn das Modell beides als INTEGRATION FR ODER beides als INTEGRATION_GAP PP zusammenfasst, ist die Trennung im Prompt nicht stark genug.",
    expected: {
      featureRequests: ["INTEGRATION"],
      painPoints: ["INTEGRATION_GAP"],
    },
  },

  // ─── pd_08 ────────────────────────────────────────────────────────────────
  {
    id: "pd_08",
    description:
      "Multi-theme clustering — mobile field workflow surfaced via 3 related items",
    etappe: "post-sale",
    input: {
      transcript: [
        "CSM: Wie habt ihr das Rollout im Außendienst gelöst?",
        "Sponsor: Halbwegs. Wir bräuchten dringend eine echte Mobile App — der Browser-View auf dem Handy ist eine Katastrophe, die Schriften sind winzig, und meine Außendienstler tippen lieber gar nichts mehr ein als sich da durchzuhangeln.",
        "CSM: Verstanden. Sind die Außendienstler immer online?",
        "Sponsor: Nein — und genau das ist auch ein Problem. Wir bräuchten einen Offline-Modus, der lokal speichert und beim nächsten WLAN synchronisiert. Aktuell gehen Eingaben im Funkloch komplett verloren, das ist uns letzten Monat zweimal passiert.",
        "CSM: Und wenn Kunden anrufen, während ihr unterwegs seid?",
        "Sponsor: Da müssten wir Telefonnummern direkt aus der Kontaktansicht antippen können — Klick-to-Call. Aktuell muss meine Truppe alles abtippen, das macht im Auto niemand.",
      ].join("\n"),
      account: {
        companyName: "Albrecht Services GmbH",
        sponsorName: "Herr Vogel (Field Operations Lead)",
        productName: "Findr",
        orgName: "Findr GmbH",
      },
      recordedAt: "2026-05-27T09:30:00Z",
    },
    rationale:
      "Drei Items, alle um die gleiche Sorge \"Außendienst-Workflow\" gruppiert: MOBILE (App fehlt), NEW_CAPABILITY (Offline-Modus), UI_UX oder NEW_CAPABILITY (Klick-to-Call) — plus mindestens ein PP (UX_FRICTION für Browser-View, Datenverlust ggf. als RELIABILITY). Erwartet: 1 Theme \"Außendienst / Mobile Field Workflow\" oder ähnlich, mit relatedFeatureRequestIndices auf alle drei FRs zeigend. Stress-Test: erkennt das Modell den gemeinsamen Nenner und nutzt es Themes überhaupt korrekt (Indices statt neuer Inhalte)?",
    expected: {
      featureRequests: ["MOBILE", "NEW_CAPABILITY"],
      painPoints: ["UX_FRICTION"],
    },
  },
];

/**
 * Distribution:
 *   Language: DE ×7, EN ×0 (deferred to round 2 once DE baseline is stable —
 *                            DACH-focused product, EN cases earn their slot later).
 *   Etappe:   pre-sale ×3, post-sale ×5.
 *   FR categories touched:  INTEGRATION, REPORTING, AUTOMATION, API,
 *                           NEW_CAPABILITY, MOBILE.
 *   PP categories touched:  BUG, PERFORMANCE_ISSUE, ONBOARDING, UX_FRICTION,
 *                           MISSING_FEATURE, INTEGRATION_GAP.
 *   Empty-expected cases:  pd_05, pd_06.
 *   Theme test:            pd_08 (primary), pd_03 (linking the dedup pair).
 *
 * Round 2 candidates (not in this batch): EN transcripts, RELIABILITY pain,
 * DATA_QUALITY pain, SUPPORT pain, ENHANCEMENT vs NEW_CAPABILITY edge.
 */
