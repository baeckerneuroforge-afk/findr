/**
 * Bridge Research→Sales Eval Dataset — EXACTLY 6 cases.
 * -----------------------------------------------------
 * 4 klare risiko-relevante Themen · 1 dünner Fall (frequency=2 — knapp)
 * · 1 nicht-risiko-relevantes Thema (muss ehrlich KEINEN Kandidaten
 * erzeugen).
 *
 * Anti-Hallu-Posture: bei nicht-risiko-relevanten Themen MUSS die
 * Derivation ehrlich kein Kandidat liefern (derivable=false). Beim
 * dünnen Thema (frequency=2) erlaubt der System-Prompt einen vorsichtigen
 * Mini-Kandidaten — die Eval-Heuristik akzeptiert das, prüft aber, dass
 * der candidateName ODER das reasoning die kleine Fallzahl semantisch
 * widerspiegelt ("erste Hinweise", "explorativ", "Watch", "2 Respondenten").
 *
 * Anchor-Check: jeder klare Case hat eine Liste deutscher Schlüssel-
 * stämme (PREFIX-Match, lehre aus #1 — z.B. "konkurr" deckt
 * "konkurrenz/konkurrierend/konkurrenzfaehig"). Mindestens einer MUSS
 * irgendwo in (candidateName + reasoning) vorkommen — lexikalisch
 * geprüft nach Umlaut-Folding, kein LLM-Judge.
 */

import type { DeriveRiskCandidateInput } from "@/lib/bridge/research-to-sales";

export interface ResearchRiskEvalCase {
  id: string;
  description: string;
  rationale: string;
  input: DeriveRiskCandidateInput;
  expected: {
    /** Soll derivable=true sein oder ehrliche Absage (false)? */
    derivable: boolean;
    /** Bei derivable=true: deutsche Schlüsselstämme (PREFIX-Match),
     *  von denen mindestens einer in (candidateName + reasoning)
     *  vorkommen MUSS. Ignoriert für derivable=false. */
    anchorTerms?: string[];
    /** Bei derivable=true: zulässige mappedRiskType-Werte. Wenn gesetzt,
     *  MUSS das Ergebnis einen davon liefern. Falls leer/nicht gesetzt
     *  wird nur geprüft, dass mappedRiskType ∈ RISK_SIGNAL_TYPES ∪
     *  {"UNKLASSIFIZIERT"} liegt (schema-getrieben). */
    allowedRiskTypes?: string[];
    /** Bei dünnen Fällen (frequency=2): mindestens eines dieser Wörter
     *  MUSS in candidateName ODER reasoning vorkommen. Ignoriert sonst. */
    cautionTerms?: string[];
    /** Strings, die in candidateName/reasoning NICHT vorkommen dürfen
     *  (typische Halluzinationen — z.B. konkrete Konkurrent-Namen, die
     *  nicht im Theme stehen). Schmal halten — wir wollen False Positives
     *  vermeiden. */
    forbiddenTerms?: string[];
  };
}

export const RESEARCH_RISK_EVAL_CASES: ResearchRiskEvalCase[] = [
  // ── 1/6 KLAR — Integrations-Tiefe als Kaufkriterium ────────────────────
  {
    id: "research_risk_01_integration_competition",
    description:
      "Enterprise-Käufer evaluieren parallel zu Salesforce, sorgen sich um Integrationstiefe",
    rationale:
      "Klares COMPETITOR_PRESSURE-Muster. Mehrere Respondenten, expliziter Wettbewerber im Theme. Goal soll Wettbewerb/Konkurrenz oder Integration referenzieren — KEINE konkreten weiteren Wettbewerber-Namen erfinden.",
    input: {
      themeTitle:
        "Integrationstiefe als zentrales Kaufkriterium bei Enterprise-Käufern",
      themeSummary:
        "Mehrere Enterprise-Respondenten erwähnen unaufgefordert, dass sie parallel zu Salesforce evaluieren und ihre Kaufentscheidung primär von der Integrationstiefe mit der bestehenden CRM-Landschaft abhängt. Eine flache Integration wird als Knockout-Kriterium benannt.",
      frequency: 5,
      quotes: [
        "Wir schauen uns das parallel zu Salesforce an — entscheidend ist, wie tief sich das in unser bestehendes Setup einbettet.",
        "Wenn die Integration nur oberflächlich ist, fliegt das Tool bei uns sofort raus.",
      ],
      studyTitle: "Enterprise-Kaufkriterien Q2 2026",
    },
    expected: {
      derivable: true,
      // Prefix-Stämme — decken "konkurrenz/konkurrierend", "wettbewerb/-er/-sdruck",
      // "integration/integriert/integrationstiefe", "salesforce" (steht
      // im Theme, ist legitim — KEIN halluziniertes Spezifikum).
      anchorTerms: ["konkurr", "wettbewerb", "integration", "salesforce"],
      // Wahrscheinlichste Mappings; UNKLASSIFIZIERT nur falls das LLM
      // keinen sauberen Match sieht.
      allowedRiskTypes: ["COMPETITOR_PRESSURE", "UNKLASSIFIZIERT"],
      // Konkret nicht im Theme genannte Wettbewerber dürfen nicht
      // auftauchen.
      forbiddenTerms: ["hubspot", "pipedrive", "microsoft dynamics"],
    },
  },

  // ── 2/6 KLAR — Pricing-Intransparenz blockiert Mid-Market ──────────────
  {
    id: "research_risk_02_pricing_intransparency",
    description:
      "Mid-Market-Käufer beklagen undurchsichtiges Pricing und verzögern Entscheidung",
    rationale:
      "BUDGET_FRICTION-Muster aus mehreren Respondenten. Goal soll Budget/Preis/Kosten referenzieren, idealerweise auch das Mid-Market-Segment.",
    input: {
      themeTitle: "Pricing-Intransparenz blockiert Mid-Market-Entscheidungen",
      themeSummary:
        'Mehrere Mid-Market-Respondenten berichten, dass das undurchsichtige Pricing-Modell mit „auf Anfrage"-Tarifen, vagen Volumen-Rabatten und unklaren Add-on-Kosten dazu führt, dass sie die Entscheidung intern aufschieben oder zu Wettbewerbern mit veröffentlichten Tarifen wechseln.',
      frequency: 4,
      quotes: [
        "Ich kann meinem CFO nichts ausrechnen, wenn ich nicht weiß, was es kostet.",
        "Wir haben zwei andere Tools auf der Liste, die ihre Preise auf der Website zeigen.",
      ],
      studyTitle: "Mid-Market Buying Friction Study",
    },
    expected: {
      derivable: true,
      anchorTerms: ["budget", "preis", "kosten", "pricing"],
      // Pricing-Intransparenz, die Entscheidungen blockiert, ist sowohl
      // als BUDGET_FRICTION (Kosten-Aspekt) als auch als STALLING_PATTERN
      // (Entscheidungs-Aspekt) defensibel — beide valide Mappings.
      // UNKLASSIFIZIERT bleibt erlaubt, falls das Modell keinen sauberen
      // Match sieht.
      allowedRiskTypes: ["BUDGET_FRICTION", "STALLING_PATTERN", "UNKLASSIFIZIERT"],
      forbiddenTerms: [],
    },
  },

  // ── 3/6 KLAR — Späte Decision-Maker / VP-Layer ─────────────────────────
  {
    id: "research_risk_03_late_decision_maker",
    description:
      "VP-Layer steigt erst nach Vertragsverhandlung ein und stellt Veto-Fragen",
    rationale:
      "LATE_DECISION_MAKER-Muster: ein höherer Entscheidungsträger kommt erst spät dazu. Goal muss Entscheidung/Decision/spät/Stakeholder referenzieren.",
    input: {
      themeTitle:
        "VP-Layer erscheint erst nach Vertragsverhandlung und stellt Vetofragen",
      themeSummary:
        "In mehreren Interviews wurde berichtet, dass der bisherige Sales-Prozess auf Director-Ebene gut funktioniert, der VP/CFO aber erst NACH der Vertragsverhandlung eingeschaltet wird und dann unerwartete Veto-Fragen zu Compliance, Datenresidenz und Total-Cost-of-Ownership stellt — was Deals um mehrere Wochen verzögert.",
      frequency: 3,
      quotes: [
        "Unser VP wurde erst zwei Wochen vor Vertragsabschluss eingebunden — der hat dann alles nochmal von vorne hinterfragt.",
        "Der CFO wollte plötzlich Datenresidenz-Garantien, die vorher nie Thema waren.",
      ],
      studyTitle: "Deal-Cycle-Verzögerungen Q1 2026",
    },
    expected: {
      derivable: true,
      // Stämme: "entscheid" deckt "Entscheidung/Entscheider"; "spaet"/"spät"
      // beides nach Umlaut-Folding (spät → spaet, beides match). "approv"
      // deckt "Approval"; "stakeholder" deckt sich selbst.
      anchorTerms: ["entscheid", "spaet", "veto", "approv", "stakeholder", "vp", "cfo"],
      allowedRiskTypes: [
        "LATE_DECISION_MAKER",
        "STALLING_PATTERN",
        "STAKEHOLDER_CHURN",
        "UNKLASSIFIZIERT",
      ],
      forbiddenTerms: [],
    },
  },

  // ── 4/6 KLAR — Single-Threaded Champion-Risiko ─────────────────────────
  {
    id: "research_risk_04_single_threaded_champion",
    description:
      "Champion ist einziger Kontaktpunkt, bei Wechsel reißt die Beziehung",
    rationale:
      "Klares MULTI_THREADING_FAILURE-Muster (oder CHAMPION_LOSS-Vorlage). Goal muss Champion / Sponsor / Threading / single referenzieren.",
    input: {
      themeTitle:
        "Champion als alleiniger Kontaktpunkt — Beziehungsabbruch bei Wechsel",
      themeSummary:
        "Mehrere Respondenten beschreiben, dass die gesamte Käufer-Kommunikation über eine einzige Person läuft (typischerweise einen Director of Operations oder Head of Sales Ops). Wechselt diese Person die Firma — was in den letzten 12 Monaten in 3 von 4 Fällen passierte — bricht der Deal oder die Beziehung ein, weil kein zweiter Sponsor existiert.",
      frequency: 4,
      quotes: [
        "Als unser Head of Sales Ops gewechselt hat, hatte plötzlich niemand mehr Kontext zu dem Tool.",
        "Wir kennen eigentlich nur eine Person dort — wenn die geht, sind wir raus.",
      ],
      studyTitle: "Sponsor-Risiken in mittelgroßen B2B-Deals",
    },
    expected: {
      derivable: true,
      anchorTerms: [
        "champion",
        "sponsor",
        "threading",
        "single",
        "kontaktpunkt",
        "fuersprecher",
        "alleinig",
      ],
      allowedRiskTypes: [
        "MULTI_THREADING_FAILURE",
        "CHAMPION_LOSS",
        "CHAMPION_DISENGAGEMENT",
        "STAKEHOLDER_CHURN",
        "UNKLASSIFIZIERT",
      ],
      forbiddenTerms: [],
    },
  },

  // ── 5/6 DÜNN — frequency=2, Onboarding-Friction (knapp an der Schwelle)
  {
    id: "research_risk_05_thin_onboarding_friction",
    description:
      "Nur 2 Respondenten erwähnen Onboarding-Friction — sehr dünne Basis",
    rationale:
      "frequency=2: System-Prompt erlaubt derivable=true mit vorsichtiger Formulierung. candidateName ODER reasoning MUSS die kleine Fallzahl reflektieren (caution terms).",
    input: {
      themeTitle:
        "Aufwändiges Onboarding bremst frühe Adoption in technischen Teams",
      themeSummary:
        "Zwei Respondenten — beide in technischen Teams (DevOps und Plattform-Engineering) — schildern, dass der initiale Setup-Aufwand für die Integration in ihren CI/CD-Stack höher war als erwartet und dass die Adoption deshalb erst nach mehreren Wochen einsetzte.",
      frequency: 2,
      quotes: [
        "Das initiale Setup hat uns drei Wochen gekostet, bis das Team es wirklich genutzt hat.",
        "Wir haben mit der Integration in unseren CI gehadert.",
      ],
      studyTitle: "Onboarding-Studie Tech-Buyers",
    },
    expected: {
      derivable: true,
      anchorTerms: ["onboarding", "setup", "adoption", "integration"],
      // Bei thin: Vorsichts-Marker erwartet. Modell kann "erste Hinweise",
      // "explorativ", "Watch-Kandidat", "zwei/2 Respondenten" wählen.
      cautionTerms: [
        "erste",
        "explorativ",
        "watch",
        "vorsichtig",
        "zwei",
        " 2 ",
        "klein",
        "mini",
        "duenn",
        "dünn",
      ],
      allowedRiskTypes: [
        "ENGAGEMENT_DROP",
        "STALLING_PATTERN",
        "UNKLASSIFIZIERT",
      ],
      forbiddenTerms: [],
    },
  },

  // ── 6/6 NICHT-RISIKO — Feature-Wunsch, kein Sales-Risk ─────────────────
  {
    id: "research_risk_06_non_risk_feature_wish",
    description:
      "Reiner Feature-Wunsch (Dark Mode) — kein Sales-Risk-Muster",
    rationale:
      "Härtester Anti-Hallu-Test. Ein wiederkehrender Feature-Wunsch ist KEIN Risk-Signal — er beeinflusst weder Kaufentscheidung noch Kündigungswahrscheinlichkeit. Derivation MUSS derivable=false liefern.",
    input: {
      themeTitle: "Dark Mode wird häufig als Komfortfeature gewünscht",
      themeSummary:
        "Mehrere Respondenten erwähnen beiläufig, dass sie sich einen Dark Mode für das Dashboard wünschen würden, vor allem bei abendlicher Nutzung. Niemand der Befragten gibt an, dass das Fehlen einen Einfluss auf Kaufentscheidung, Verlängerung oder Empfehlung hat — es bleibt ein UI-Komfortwunsch.",
      frequency: 4,
      quotes: [
        "Wäre nett, wenn es einen Dark Mode gäbe — aber kein Showstopper.",
        "Ich würde abends weniger blinzeln müssen, das wär's auch.",
      ],
      studyTitle: "Dashboard-UX-Studie",
    },
    expected: {
      derivable: false,
    },
  },
];
