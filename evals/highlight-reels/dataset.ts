/**
 * Highlight-Reels Eval Dataset
 * ----------------------------
 * Six hand-crafted fixtures for measuring the QUALITY of
 * generateReelFromInputs():
 *
 *   NORMAL  (4 cases) — a finished study with 3-4 verdichtungen + a
 *           Stage-2 synthesis carrying ≥2 emergent themes. The engine
 *           should pull 4-8 anchored highlights spanning ≥2 distinct
 *           themes.
 *
 *   THIN    (1 case)  — a "Mini-Pilot" with ONE verdichtung. The engine
 *           must NOT stretch — 0-2 highlights expected, no fabrication of
 *           a cross-call frame from a single voice.
 *
 *   EMPTY   (1 case)  — verdichtungen and synthesis-theme quotes are all
 *           devoid of citable text. The engine should SHORT-CIRCUIT (no
 *           Opus call) and return highlights: [] with an honest summary.
 *
 * Anti-hallu philosophy mirrors evals-synthesis and evals/chat-with-data:
 * the deterministic property checks (quote fold-substring, id-set,
 * themeRef-set, German caption, theme diversity, expected-bound) are the
 * gate — there's no LLM judge.
 *
 * Anchor checks are ROBUST in the sense of NOT depending on per-case
 * lexical whitelists — each check probes a STRUCTURAL property of the
 * output (substring membership, set membership, simple text shape) against
 * the fixture's own haystack/title set/etc. There is no "must contain noun
 * form X" anywhere here.
 */

import type {
  ReelCondensationInput,
  ReelFromInputs,
  ReelSynthesisTheme,
} from "@/lib/research/highlight-reels";

export interface ReelEvalCase {
  id: string;
  description: string;
  /** Rationale visible in the runner output — explains what property of
   *  the engine the case probes. */
  rationale: string;
  /** Stored as a getter so the dataset module doesn't blow up at import
   *  time if a typo lands. */
  buildInput: () => ReelFromInputs;
  expected: {
    /** Inclusive lower bound on highlights.length. 0 for empty/thin cases. */
    minHighlights: number;
    /** Inclusive upper bound on highlights.length. 8 for normal, low for
     *  thin/empty (the anti-stretching gate). */
    maxHighlights: number;
    /** If true, eval expects highlights.length === 0 EXACTLY — the strict
     *  "honest empty" anti-hallu gate for the EMPTY case. */
    mustBeEmpty?: boolean;
    /** If the fixture has ≥2 themes, the eval expects highlights to span
     *  ≥2 distinct themeRefs once there are ≥2 highlights. Disable for
     *  fixtures with only 1 theme. */
    requireThemeDiversity?: boolean;
  };
}

// ─── Helper: build a synthesis theme entry ─────────────────────────────────

function theme(
  title: string,
  summary: string,
  sourceInsightIds: string[],
  quotes: string[],
): ReelSynthesisTheme {
  return {
    title,
    summary,
    frequency: new Set(sourceInsightIds).size,
    sourceInsightIds,
    quotes,
  };
}

// ─── Case 1: Onboarding-Friktion (4 verdichtungen, 2 Themen) ───────────────

function buildOnboardingInputs(): ReelFromInputs {
  const condensations: ReelCondensationInput[] = [
    {
      id: "onb_call_anna",
      respondentRole: "Admin",
      respondentSegment: "SMB",
      sentiment: "negative",
      summary:
        "Anna berichtet, dass die schriftliche Anleitung nicht zum aktuellen Stand der App passte.",
      featureRequests: [],
      painPoints: [
        {
          category: "ONBOARDING",
          title: "Anleitung veraltet",
          description:
            "Die schriftliche Anleitung passte nicht zum aktuellen Stand der App.",
          severity: "high",
          confidence: 0.9,
          evidence: [
            "Die Anleitung war veraltet, drei Screenshots stimmten nicht mehr.",
          ],
        },
      ],
      themes: [],
    },
    {
      id: "onb_call_ben",
      respondentRole: "Admin",
      respondentSegment: "SMB",
      sentiment: "negative",
      summary: "Ben hatte kein internes Schulungsmaterial fuer neue Kollegen.",
      featureRequests: [],
      painPoints: [
        {
          category: "ONBOARDING",
          title: "Kein Schulungsmaterial",
          description:
            "Ohne internes Schulungsmaterial sass der neue Kollege vor dem Tool.",
          severity: "medium",
          confidence: 0.85,
          evidence: [
            "wir hatten kein Schulungsmaterial fuer die neuen Kollegen",
          ],
        },
      ],
      themes: [],
    },
    {
      id: "onb_call_clara",
      respondentRole: "Admin im Aussendienst",
      respondentSegment: "Enterprise",
      sentiment: "neutral",
      summary: "Clara braucht das Tool unterwegs und wuenscht eine Mobile App.",
      featureRequests: [
        {
          category: "MOBILE",
          title: "Mobile App",
          description: "Im Aussendienst brauchen wir das auf dem Handy.",
          intensity: "high",
          confidence: 0.9,
          evidence: [
            "wir braeuchten eine richtige App fuer den Aussendienst",
          ],
        },
      ],
      painPoints: [],
      themes: [],
    },
    {
      id: "onb_call_dirk",
      respondentRole: "Admin",
      respondentSegment: "SMB",
      sentiment: "positive",
      summary: "Dirk findet die Browser-Version ausreichend.",
      featureRequests: [],
      painPoints: [
        {
          category: "UX_FRICTION",
          title: "Browser reicht",
          description:
            "Der Browser-View ist fuer sein Setup vollkommen ausreichend.",
          severity: "low",
          confidence: 0.8,
          evidence: [
            "eine App brauchen wir nicht, der Browser reicht uns vollkommen",
          ],
        },
      ],
      themes: [],
    },
  ];

  return {
    plan: {
      title: "Onboarding-Studie Q3",
      objective:
        "Verstehen, wo neue Admin-User aufgeben oder haengen bleiben im Onboarding.",
      persona: "Admin-User bei SMB SaaS",
    },
    synthesis: {
      overview:
        "Zwei von vier Teilnehmern berichten von Onboarding-Friktion durch fehlende Materialien. Bei der Mobile-App-Frage gibt es zwei Lager.",
      emergent_themes: [
        theme(
          "Onboarding-Friktion durch fehlende Materialien",
          "Zwei Admin-User schildern, dass die Einstiegsmaterialien nicht ausreichten — einmal veraltete Anleitung, einmal kein internes Schulungsmaterial.",
          ["onb_call_anna", "onb_call_ben"],
          [
            "Die Anleitung war veraltet, drei Screenshots stimmten nicht mehr.",
            "wir hatten kein Schulungsmaterial fuer die neuen Kollegen",
          ],
        ),
        theme(
          "Mobile-App-Bedarf vs Browser ausreichend",
          "Im Aussendienst wird eine native App gefordert, andere Setups kommen mit dem Browser klar.",
          ["onb_call_clara", "onb_call_dirk"],
          [
            "wir braeuchten eine richtige App fuer den Aussendienst",
            "eine App brauchen wir nicht, der Browser reicht uns vollkommen",
          ],
        ),
      ],
    },
    condensations,
  };
}

// ─── Case 2: Sales-Closing-Friktion (4 verdichtungen, 2 Themen) ────────────

function buildSalesClosingInputs(): ReelFromInputs {
  const condensations: ReelCondensationInput[] = [
    {
      id: "sales_call_eva",
      respondentRole: "Account Executive",
      respondentSegment: "Mid-Market",
      sentiment: "negative",
      summary:
        "Eva verliert Deals weil ihre Champions die Buying Group nicht oeffnen.",
      featureRequests: [],
      painPoints: [
        {
          category: "MULTI_THREADING",
          title: "Single-threaded Champion",
          description:
            "Champion bringt die anderen Stakeholder nicht an den Tisch.",
          severity: "high",
          confidence: 0.92,
          evidence: [
            "mein Champion hat sich geweigert, Finance einzubinden, und der Deal ist im Sand verlaufen",
          ],
        },
      ],
      themes: [],
    },
    {
      id: "sales_call_finn",
      respondentRole: "Account Executive",
      respondentSegment: "Enterprise",
      sentiment: "negative",
      summary:
        "Finn beschreibt, wie Pricing-Intransparenz spaet im Funnel das Closing blockiert.",
      featureRequests: [],
      painPoints: [
        {
          category: "BUDGET_FRICTION",
          title: "Pricing zu spaet sichtbar",
          description:
            "Pricing kommt erst nach dem Demo-Termin auf den Tisch, was Procurement provoziert.",
          severity: "high",
          confidence: 0.88,
          evidence: [
            "wir muessen den Preis frueher zeigen, sonst kippt der Deal im Procurement-Review",
          ],
        },
      ],
      themes: [],
    },
    {
      id: "sales_call_greta",
      respondentRole: "Sales Manager",
      respondentSegment: "Mid-Market",
      sentiment: "negative",
      summary: "Greta sieht das Champion-Problem strukturell ueber ihr Team.",
      featureRequests: [],
      painPoints: [
        {
          category: "MULTI_THREADING",
          title: "Buying Group nie geoeffnet",
          description:
            "Die Reps schaffen es nicht, ueber den ersten Kontakt hinaus zu skalieren.",
          severity: "high",
          confidence: 0.9,
          evidence: [
            "wir kommen ueber den ersten Kontakt nie zu CFO oder Procurement",
          ],
        },
      ],
      themes: [],
    },
    {
      id: "sales_call_hannes",
      respondentRole: "Account Executive",
      respondentSegment: "Enterprise",
      sentiment: "neutral",
      summary:
        "Hannes bestaetigt Pricing-Druck im Procurement, hat aber Workarounds.",
      featureRequests: [],
      painPoints: [
        {
          category: "BUDGET_FRICTION",
          title: "Procurement-Druck",
          description: "Procurement hinterfragt das Listing-Pricing immer.",
          severity: "medium",
          confidence: 0.78,
          evidence: [
            "Procurement hinterfragt unser Listing-Pricing in jedem Enterprise-Deal",
          ],
        },
      ],
      themes: [],
    },
  ];

  return {
    plan: {
      title: "Sales-Closing-Friktion DACH",
      objective:
        "Verstehen, woran Deals im DACH-Mid-Market und Enterprise spaet im Funnel scheitern.",
      persona: "Account Executive bei B2B-SaaS",
    },
    synthesis: {
      overview:
        "Im DACH-Funnel scheitern Deals an zwei Stellen: Multi-Threading-Versagen ueber den Champion hinaus und Pricing-Transparenz erst nach dem Demo-Termin.",
      emergent_themes: [
        theme(
          "Single-threaded Champion blockiert Buying Group",
          "Reps schaffen es nicht, ueber den initialen Champion hinaus zu skalieren — der Deal verliert seine Procurement- und Finance-Spur.",
          ["sales_call_eva", "sales_call_greta"],
          [
            "mein Champion hat sich geweigert, Finance einzubinden, und der Deal ist im Sand verlaufen",
            "wir kommen ueber den ersten Kontakt nie zu CFO oder Procurement",
          ],
        ),
        theme(
          "Pricing zu spaet im Funnel sichtbar",
          "Wenn der Preis erst nach der Demo kommt, eskaliert Procurement; einige Reps haben Workarounds, die meisten verlieren Tempo.",
          ["sales_call_finn", "sales_call_hannes"],
          [
            "wir muessen den Preis frueher zeigen, sonst kippt der Deal im Procurement-Review",
            "Procurement hinterfragt unser Listing-Pricing in jedem Enterprise-Deal",
          ],
        ),
      ],
    },
    condensations,
  };
}

// ─── Case 3: Power-User-Workflow (4 verdichtungen, 2 Themen) ───────────────

function buildPowerUserInputs(): ReelFromInputs {
  const condensations: ReelCondensationInput[] = [
    {
      id: "pu_call_ines",
      respondentRole: "Operations Analyst",
      respondentSegment: "Mid-Market",
      sentiment: "negative",
      summary:
        "Ines verliert Zeit weil Bulk-Actions in der Tabellenansicht fehlen.",
      featureRequests: [
        {
          category: "BULK_OPERATIONS",
          title: "Bulk-Edit in der Tabelle",
          description:
            "Mehrere Zeilen markieren und in einem Rutsch bearbeiten.",
          intensity: "high",
          confidence: 0.9,
          evidence: [
            "ich muesste 80 Zeilen einzeln anfassen, das frisst meinen Vormittag",
          ],
        },
      ],
      painPoints: [],
      themes: [],
    },
    {
      id: "pu_call_jonas",
      respondentRole: "Data Engineer",
      respondentSegment: "Enterprise",
      sentiment: "negative",
      summary:
        "Jonas waere mit Keyboard-Shortcuts viel schneller; aktuell viel Klick-Klick.",
      featureRequests: [
        {
          category: "KEYBOARD",
          title: "Tastatur-Shortcuts",
          description:
            "Power-User-Aktionen brauchen Tastenkombinationen statt Mausweg.",
          intensity: "high",
          confidence: 0.88,
          evidence: [
            "ohne Shortcuts ist jeder Workflow mindestens doppelt so lang wie noetig",
          ],
        },
      ],
      painPoints: [],
      themes: [],
    },
    {
      id: "pu_call_klara",
      respondentRole: "Data Steward",
      respondentSegment: "Mid-Market",
      sentiment: "negative",
      summary:
        "Klara braucht ebenfalls Bulk-Operationen, gerade im Quartalsabschluss.",
      featureRequests: [
        {
          category: "BULK_OPERATIONS",
          title: "Bulk-Move in andere Pipeline",
          description:
            "Hundert Datensaetze auf einmal in eine andere Pipeline schieben.",
          intensity: "high",
          confidence: 0.85,
          evidence: [
            "am Quartalsende muss ich 200 Datensaetze umziehen, das geht nur einzeln",
          ],
        },
      ],
      painPoints: [],
      themes: [],
    },
    {
      id: "pu_call_lars",
      respondentRole: "Solutions Engineer",
      respondentSegment: "Enterprise",
      sentiment: "neutral",
      summary:
        "Lars sieht beides: Shortcuts spart Sekunden, Bulk-Ops spart Stunden.",
      featureRequests: [
        {
          category: "KEYBOARD",
          title: "Shortcuts fuer Standard-Aktionen",
          description: "Mindestens Save, Duplicate, Move via Tasten.",
          intensity: "medium",
          confidence: 0.8,
          evidence: [
            "Shortcuts sparen Sekunden, Bulk-Operationen sparen ganze Stunden",
          ],
        },
      ],
      painPoints: [],
      themes: [],
    },
  ];

  return {
    plan: {
      title: "Power-User-Workflow-Studie",
      objective:
        "Verstehen, wo Power-User durch das aktuelle UI in Standard-Workflows ausgebremst werden.",
      persona: "Power-User in Data/Ops-Rollen",
    },
    synthesis: {
      overview:
        "Power-User verlieren Zeit an zwei Stellen: fehlende Tastatur-Shortcuts und das Fehlen echter Bulk-Operationen. Beides wird mehrfach genannt.",
      emergent_themes: [
        theme(
          "Bulk-Operationen in der Tabellenansicht",
          "Mehrere Power-User berichten, dass das Fehlen echter Bulk-Edits/Moves den groessten Zeitverlust verursacht — gerade rund um Quartalswechsel.",
          ["pu_call_ines", "pu_call_klara"],
          [
            "ich muesste 80 Zeilen einzeln anfassen, das frisst meinen Vormittag",
            "am Quartalsende muss ich 200 Datensaetze umziehen, das geht nur einzeln",
          ],
        ),
        theme(
          "Tastatur-Shortcuts fuer Standard-Aktionen",
          "Standard-Aktionen wie Save, Move, Duplicate brauchen Tastenkombinationen; ohne sie verdoppelt sich die Workflow-Zeit.",
          ["pu_call_jonas", "pu_call_lars"],
          [
            "ohne Shortcuts ist jeder Workflow mindestens doppelt so lang wie noetig",
            "Shortcuts sparen Sekunden, Bulk-Operationen sparen ganze Stunden",
          ],
        ),
      ],
    },
    condensations,
  };
}

// ─── Case 4: Pricing-Tier-Update-Feedback (3 verdichtungen, 2 Themen) ──────

function buildPricingFeedbackInputs(): ReelFromInputs {
  const condensations: ReelCondensationInput[] = [
    {
      id: "price_call_meta",
      respondentRole: "Procurement Lead",
      respondentSegment: "Mid-Market",
      sentiment: "negative",
      summary:
        "Meta versteht das neue Tier-Modell nicht klar — Add-Ons wirken intransparent.",
      featureRequests: [],
      painPoints: [
        {
          category: "PRICING_CLARITY",
          title: "Add-Ons unklar",
          description:
            "Welche Funktion in welchem Tier liegt, ist aus der Preisliste nicht ablesbar.",
          severity: "high",
          confidence: 0.88,
          evidence: [
            "aus eurer Preisliste wird nicht klar, was zum Pro-Tier gehoert und was Add-On ist",
          ],
        },
      ],
      themes: [],
    },
    {
      id: "price_call_nils",
      respondentRole: "Finance Manager",
      respondentSegment: "Enterprise",
      sentiment: "negative",
      summary:
        "Nils wuerde lieber von Pro auf Enterprise wechseln, sieht aber keinen klaren Trigger.",
      featureRequests: [
        {
          category: "TIER_MIGRATION",
          title: "Klarer Wechsel-Trigger",
          description:
            "Wann lohnt sich der Sprung von Pro auf Enterprise nachweisbar?",
          intensity: "medium",
          confidence: 0.82,
          evidence: [
            "ich weiss nicht, ab welchem Nutzungsvolumen sich Enterprise rechnet",
          ],
        },
      ],
      painPoints: [],
      themes: [],
    },
    {
      id: "price_call_ole",
      respondentRole: "Head of Operations",
      respondentSegment: "Mid-Market",
      sentiment: "negative",
      summary:
        "Ole hat ebenfalls den Wunsch nach Tier-Wechsel, aber Procurement blockiert.",
      featureRequests: [
        {
          category: "TIER_MIGRATION",
          title: "Pilot-Phase fuer naechsten Tier",
          description:
            "Probe-Periode auf Enterprise-Tier vor dem Commit.",
          intensity: "medium",
          confidence: 0.79,
          evidence: [
            "wir braeuchten eine Pilot-Phase auf Enterprise, sonst kriegen wir Procurement nicht ueberzeugt",
          ],
        },
      ],
      painPoints: [],
      themes: [],
    },
  ];

  return {
    plan: {
      title: "Tier-Update-Feedback Q4",
      objective:
        "Verstehen, wie das neue Tier-Modell bei Bestandskunden ankommt und wo Friktionen entstehen.",
      persona: "Procurement/Finance bei Bestandskunden",
    },
    synthesis: {
      overview:
        "Das neue Tier-Modell stoesst auf zwei klare Friktionen: Add-Ons werden als intransparent erlebt, und der Wechsel auf den naechsten Tier hat keinen klaren Trigger.",
      emergent_themes: [
        theme(
          "Add-Ons in der Preisliste intransparent",
          "Bestandskunden verstehen aus der aktuellen Preisliste nicht, welche Funktion zum Tier gehoert und welche zusaetzlich kostet.",
          ["price_call_meta"],
          [
            "aus eurer Preisliste wird nicht klar, was zum Pro-Tier gehoert und was Add-On ist",
          ],
        ),
        theme(
          "Wechselwunsch ohne klaren Trigger",
          "Bestandskunden haetten Interesse am naechsten Tier, koennen aber den Business Case intern nicht bauen — fehlende Trigger-Metrik und keine Pilot-Phase.",
          ["price_call_nils", "price_call_ole"],
          [
            "ich weiss nicht, ab welchem Nutzungsvolumen sich Enterprise rechnet",
            "wir braeuchten eine Pilot-Phase auf Enterprise, sonst kriegen wir Procurement nicht ueberzeugt",
          ],
        ),
      ],
    },
    condensations,
  };
}

// ─── Case 5: Thin study — 1 verdichtung, 1 Thema ───────────────────────────

function buildThinPilotInputs(): ReelFromInputs {
  const condensations: ReelCondensationInput[] = [
    {
      id: "pilot_call_peer",
      respondentRole: "Solo Founder",
      respondentSegment: "Pre-Seed",
      sentiment: "neutral",
      summary:
        "Peer hat die Bildverarbeitung in einem Pilot-Setup getestet und sieht erste Engpaesse.",
      featureRequests: [],
      painPoints: [
        {
          category: "PERFORMANCE",
          title: "Bild-Upload langsam",
          description:
            "Beim Upload von vielen Bildern dauert die Verarbeitung lang.",
          severity: "medium",
          confidence: 0.7,
          evidence: [
            "der Upload mehrerer Bilder dauerte deutlich laenger als ich erwartet hatte",
          ],
        },
      ],
      themes: [],
    },
  ];

  return {
    plan: {
      title: "Mini-Pilot Bildverarbeitung",
      objective:
        "Erste Reaktionen auf den Bildverarbeitungs-Prototyp bei einem Solo-Founder.",
      persona: "Solo-Founder im Pre-Seed-Stadium",
    },
    synthesis: {
      overview:
        "Ein einzelner Pilot-Teilnehmer beschreibt erste Performance-Engpaesse beim Bild-Upload. Auf Basis von n=1 ist kein Cross-Call-Muster ableitbar.",
      emergent_themes: [
        theme(
          "Performance beim Bild-Upload",
          "Beim Upload mehrerer Bilder kommt es zu spuerbaren Verzoegerungen — n=1, nicht generalisierbar.",
          ["pilot_call_peer"],
          [
            "der Upload mehrerer Bilder dauerte deutlich laenger als ich erwartet hatte",
          ],
        ),
      ],
    },
    condensations,
  };
}

// ─── Case 6: No usable quotes — empty haystack ─────────────────────────────

function buildEmptyHaystackInputs(): ReelFromInputs {
  // Two condensations exist (so the no_condensations short-circuit doesn't
  // trigger) BUT both carry zero citable text. The synthesis has one theme
  // with quotes=[] (so the no_themes short-circuit doesn't trigger either).
  // The engine should land in the no_haystack branch and return empty
  // WITHOUT calling Opus.
  const condensations: ReelCondensationInput[] = [
    {
      id: "empty_call_quentin",
      respondentRole: null,
      respondentSegment: null,
      sentiment: null,
      summary: null,
      featureRequests: [],
      painPoints: [],
      themes: [],
    },
    {
      id: "empty_call_rita",
      respondentRole: null,
      respondentSegment: null,
      sentiment: null,
      summary: null,
      featureRequests: [],
      painPoints: [],
      themes: [],
    },
  ];

  return {
    plan: {
      title: "Frueh-Beobachtung ohne Inhalte",
      objective:
        "Edge-Case: Verdichtungen sind angelegt, enthalten aber keinen verwertbaren Text.",
      persona: null,
    },
    synthesis: {
      overview:
        "Synthese-Slot existiert, hat aber keine zitierbaren Inhalte zugespielt bekommen.",
      emergent_themes: [
        theme(
          "Platzhalter-Thema ohne Evidenz",
          "Theme-Slot ist gesetzt, traegt aber keine zitierbaren Quotes.",
          ["empty_call_quentin"],
          [],
        ),
      ],
    },
    condensations,
  };
}

// ─── Final case set — EXACTLY 6 ────────────────────────────────────────────

export const REEL_EVAL_CASES: ReelEvalCase[] = [
  {
    id: "reel_01_onboarding",
    description: "Onboarding-Studie mit 4 Verdichtungen + 2 Themen",
    rationale:
      "Reguläre Studie. Engine muss 4-7 wörtliche Highlights über beide Themen ziehen, jedes anker-konform.",
    buildInput: buildOnboardingInputs,
    expected: {
      minHighlights: 4,
      maxHighlights: 8,
      requireThemeDiversity: true,
    },
  },
  {
    id: "reel_02_sales_closing",
    description: "Sales-Closing-Friktion mit 4 Verdichtungen + 2 Themen",
    rationale:
      "B2B-Sales-Kontext mit deutlich unterscheidbaren Themen — Diversitäts-Check muss bestehen.",
    buildInput: buildSalesClosingInputs,
    expected: {
      minHighlights: 4,
      maxHighlights: 8,
      requireThemeDiversity: true,
    },
  },
  {
    id: "reel_03_power_user",
    description: "Power-User-Workflow mit 4 Verdichtungen + 2 Themen",
    rationale:
      "Reguläre Studie mit zwei sauberen Themen — Curation- und Anchor-Verhalten im Normalfall.",
    buildInput: buildPowerUserInputs,
    expected: {
      minHighlights: 4,
      maxHighlights: 8,
      requireThemeDiversity: true,
    },
  },
  {
    id: "reel_04_pricing_feedback",
    description: "Tier-Update-Feedback mit 3 Verdichtungen + 2 Themen",
    rationale:
      "Etwas kleinere Studie (n=3) — Engine muss trotzdem ≥3 Highlights ziehen und beide Themen abdecken.",
    buildInput: buildPricingFeedbackInputs,
    expected: {
      minHighlights: 3,
      maxHighlights: 6,
      requireThemeDiversity: true,
    },
  },
  {
    id: "reel_05_thin_pilot",
    description: "Mini-Pilot mit n=1 — Anti-Stretching-Test",
    rationale:
      "Eine einzelne Verdichtung. Engine darf 0-2 Highlights produzieren — KEIN Aufblähen auf 5-8 aus einer einzigen Stimme.",
    buildInput: buildThinPilotInputs,
    expected: {
      minHighlights: 0,
      maxHighlights: 2,
      // Only 1 theme — diversity check is vacuous.
      requireThemeDiversity: false,
    },
  },
  {
    id: "reel_06_no_usable_quotes",
    description: "Edge-Case ohne zitierbaren Inhalt — Short-Circuit",
    rationale:
      "Verdichtungen vorhanden aber leer, Synthese-Theme ohne Quotes — Engine MUSS leer zurückgeben (ohne Opus-Call) und KEINE Quotes erfinden.",
    buildInput: buildEmptyHaystackInputs,
    expected: {
      minHighlights: 0,
      maxHighlights: 0,
      mustBeEmpty: true,
      requireThemeDiversity: false,
    },
  },
];
