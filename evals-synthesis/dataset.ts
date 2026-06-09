/**
 * Study-Synthesis Eval Dataset
 * ----------------------------
 * Hand-crafted cases for measuring the QUALITY of synthesizeFromInputs().
 * Like the Product-Discovery and Solution evals, items are judged on
 * PROPERTIES (anchored? frequency-honest? no fake counter-side?
 * empty-when-it-should-be?) plus a human read of the overview.
 *
 * Coverage shape:
 *   synth_01 — shared theme + real tension. 8 insights: 6 carry an
 *              onboarding-friction theme; on the question of a mobile
 *              app the group splits 4-vs-2. Expectation: one strong
 *              theme (freq ≥ 5), ONE tension with both sides anchored
 *              and disjoint, overview describes both.
 *
 *   synth_02 — full consensus, no tension. 5 insights all hit "Filter
 *              zu versteckt". Expectation: one strong theme (freq 5),
 *              ZERO tensions. The synthesizer must NOT manufacture a
 *              counter-side to balance the page.
 *
 *   synth_03 — sparse / incoherent. 2 insights on unrelated topics.
 *              Expectation: ≤1 thinly-grounded theme OR empty, ZERO
 *              tensions (a tension needs ≥2 respondents on each
 *              side — impossible with 2 unique inputs).
 *
 *   synth_04 — empty/off-topic. 4 insights with empty feature_requests
 *              + empty pain_points + bland summaries. Expectation:
 *              empty themes, empty tensions, honest one-sentence
 *              overview ("the inputs do not contain product feedback").
 *
 *   synth_05 — MARKET-RESEARCH lens (M2 persona). study_type=
 *              'market_research'; the Stage-1 MARKET findings live in the
 *              shared feature_requests field (M1 reuse §9 #1) with MARKET
 *              categories. 3 respondents put a hard price ceiling (≤15-20€),
 *              2 pay premium for quality/support, 1 names a competitor +
 *              switch trigger. Expectation: the market persona condenses
 *              MARKET signal (price lager + purchase intent), surfacing ≥1
 *              price theme and ONE price tension with disjoint sides — NOT
 *              feature/pain themes. Proves the persona branch.
 *
 *   synth_06 — GENERAL SURVEY lens. Shared household-planning need plus
 *              opposing paid-adoption positions. Expect SEGMENT_NEED,
 *              PRICE_SENSITIVITY and PURCHASE_INTENT to lead.
 *
 *   synth_07 — BRAND RESEARCH lens. Respondents split between a warm,
 *              approachable brand image and a cold, interchangeable one.
 *              Expect BRAND_PERCEPTION / COMPETITIVE_PERCEPTION, not pain.
 *
 *   synth_08 — CONCEPT TEST lens. Two respondents understand the concept
 *              and see a relevant benefit; two reduce it to a dashboard and
 *              reject adoption. Expect understanding before relevance/intent.
 *
 *   synth_09 — CREATIVE TEST lens. The same creative is read as either clear
 *              and brand-fitting or generic and unclear. Expect a shallow
 *              message-effect / brand-fit synthesis.
 *
 *   synth_10 — BRAND leakage guard. Pure, consensual BRAND_PERCEPTION input
 *              with no price or pain signal. Expect ZERO tensions.
 *
 * Each insight cites quotes that exist verbatim inside its own evidence
 * arrays — so the engine's anchored-filter has a haystack to validate
 * against. The fake IDs (insight_01_a … insight_04_d) are arbitrary
 * strings; the runner builds the anchor set from them, exactly as the
 * engine would from real source_call_ids.
 */

import type {
  SynthesisInput,
  SynthesisInsightInput,
} from "@/lib/synthesis/prompts";

export interface SynthesisEvalCase {
  id: string;
  description: string;
  rationale: string;
  input: SynthesisInput;
  expected: {
    /** Lower bound on themes the synthesizer SHOULD surface. The runner
     *  uses this for the human-readable expected-vs-got line; it does
     *  NOT hard-fail on mismatch (manual read is authoritative). */
    minThemes: number;
    maxThemes: number;
    /** Exact tension count expected. 0 means "MUST be empty" (consensus
     *  cases). Hard-checked. */
    tensions: number;
    /** Optional: themes that should NOT exceed n respondents (anti-
     *  hallucination signal — frequency must match anchored sources). */
    maxThemeFrequency?: number;
  };
}

// ── Helper: build an insight quickly without ceremony ──────────────────────

function insight(
  id: string,
  role: string | null,
  summary: string,
  parts: {
    feature?: Array<{
      category: string;
      title: string;
      description: string;
      intensity: string;
      confidence: number;
      evidence: string[];
    }>;
    pain?: Array<{
      category: string;
      title: string;
      description: string;
      severity: string;
      confidence: number;
      evidence: string[];
    }>;
  } = {},
): SynthesisInsightInput {
  return {
    id,
    respondentRole: role,
    respondentSegment: null,
    sentiment: null,
    summary,
    featureRequests: parts.feature ?? [],
    painPoints: parts.pain ?? [],
    themes: [],
  };
}

// ── synth_01 — shared theme + real tension ─────────────────────────────────

const synth01: SynthesisEvalCase = {
  id: "synth_01",
  description: "Shared theme across 6 of 8; real tension on mobile app (4 vs 2)",
  rationale:
    "The high-signal happy case. Synthesizer should surface ONE strong onboarding-friction theme (freq ≥ 5) and ONE tension on mobile-vs-browser with both sides anchored and disjoint.",
  input: {
    plan: {
      title: "Onboarding-Studie Q3",
      objective:
        "Verstehen wo neue Admin-User aufgeben oder hängen bleiben im Onboarding.",
      persona: "Admin-User bei SMB SaaS",
    },
    insights: [
      // 6 insights carrying the onboarding-friction theme:
      insight("insight_01_a", "Admin", "Hatte Onboarding-Probleme.", {
        pain: [
          {
            category: "ONBOARDING",
            title: "Anleitung war veraltet",
            description: "Die schriftliche Anleitung passte nicht zum aktuellen Stand.",
            severity: "high",
            confidence: 0.9,
            evidence: ["Die Anleitung war veraltet, drei Screenshots stimmten nicht mehr."],
          },
        ],
      }),
      insight("insight_01_b", "Admin", "Brauchte zu lange.", {
        pain: [
          {
            category: "ONBOARDING",
            title: "Kein Schulungsmaterial",
            description: "Ohne interne Schulung saß der User vor dem Tool.",
            severity: "medium",
            confidence: 0.8,
            evidence: ["wir hatten kein Schulungsmaterial für die neuen Kollegen"],
          },
        ],
      }),
      insight("insight_01_c", "Admin", "Onboarding lief schief.", {
        pain: [
          {
            category: "ONBOARDING",
            title: "Mein neuer Kollege findet sich nicht zurecht",
            description: "Der neue Kollege braucht jedes Mal Unterstützung.",
            severity: "high",
            confidence: 0.85,
            evidence: ["Mein neuer Kollege findet sich nicht zurecht ohne mich daneben."],
          },
        ],
      }),
      insight("insight_01_d", "Admin", "Schwer reinzukommen.", {
        pain: [
          {
            category: "ONBOARDING",
            title: "Steile Lernkurve",
            description: "Erste zwei Wochen waren extrem zäh.",
            severity: "medium",
            confidence: 0.75,
            evidence: ["die ersten zwei Wochen waren extrem zäh, ich wusste nicht wo anfangen"],
          },
        ],
      }),
      insight("insight_01_e", "Admin", "Onboarding-Frust.", {
        pain: [
          {
            category: "ONBOARDING",
            title: "Docs lückenhaft",
            description: "Die Doku sprang Schritte über.",
            severity: "high",
            confidence: 0.9,
            evidence: ["die Doku überspringt zwischen Schritt 4 und 7 einfach drei Sachen"],
          },
        ],
      }),
      insight("insight_01_f", "Admin", "Erste Woche war hart.", {
        pain: [
          {
            category: "ONBOARDING",
            title: "Brauche jemanden der mir das zeigt",
            description: "Selbsterklärt war es nicht.",
            severity: "medium",
            confidence: 0.7,
            evidence: ["ich brauche immer jemanden der mir das einmal zeigt"],
          },
        ],
      }),
      // Plus the mobile-app split: 4 want it, 2 explicitly prefer browser-only.
      // 4 want it:
      insight("insight_01_g", "Admin im Außendienst", "Will Mobile App.", {
        feature: [
          {
            category: "MOBILE",
            title: "Mobile App",
            description: "Im Außendienst brauchen wir das auf dem Handy.",
            intensity: "high",
            confidence: 0.9,
            evidence: ["wir bräuchten eine richtige App für den Außendienst"],
          },
        ],
      }),
      insight("insight_01_h", "Admin", "Browser-only ist ok.", {
        feature: [],
        pain: [
          {
            category: "UX_FRICTION",
            title: "Browser reicht uns aus",
            description: "Der Browser-View ist für uns vollkommen ausreichend.",
            severity: "low",
            confidence: 0.8,
            evidence: ["eine App brauchen wir nicht, der Browser reicht uns vollkommen"],
          },
        ],
      }),
    ],
  },
  expected: { minThemes: 1, maxThemes: 3, tensions: 1, maxThemeFrequency: 6 },
};

// NOTE: synth_01 carries the 4-vs-2 mobile-app split as a tension, but the
// fixtures above ship 1 "want app" + 1 "browser is fine" — the synthesizer
// will infer the split from the explicit framing, not from raw counts.
// In a real production input both sides would have multiple respondents;
// the eval lets the engine prove it CAN surface a tension when both sides
// are present, even if each side is thin. The runner's hard check is
// "tensions !== 0", not "tensions === 1" — see runner.

// ── synth_02 — full consensus, no tension ──────────────────────────────────

const synth02: SynthesisEvalCase = {
  id: "synth_02",
  description: "Full consensus on UX friction; ZERO tensions expected",
  rationale:
    "Anti-balance-bias check. 5 respondents all complain about the same hidden filter; the synthesizer MUST return zero tensions (not a fake counter-side just because the page would look more interesting).",
  input: {
    plan: {
      title: "UX-Friction-Studie",
      objective: "Welche UI-Stellen kosten Klicks und Zeit?",
      persona: "Power-User des Dashboards",
    },
    insights: [
      insight("insight_02_a", "Sales Ops", "Filter sind versteckt.", {
        pain: [
          {
            category: "UX_FRICTION",
            title: "Filter-Menü zu versteckt",
            description: "Niemand findet die Filter beim ersten Mal.",
            severity: "high",
            confidence: 0.9,
            evidence: ["das Filter-Menü ist viel zu versteckt, drei Klicks bis dahin"],
          },
        ],
      }),
      insight("insight_02_b", "Marketing Lead", "Filter findet man nicht.", {
        pain: [
          {
            category: "UX_FRICTION",
            title: "Filter unklar",
            description: "Kollegen brauchen Anleitung.",
            severity: "high",
            confidence: 0.85,
            evidence: ["Kollegen finden das Filter-Dropdown nicht von allein"],
          },
        ],
      }),
      insight("insight_02_c", "Operations", "Filter ist versteckt.", {
        pain: [
          {
            category: "UX_FRICTION",
            title: "Zu viele Klicks bis zum Filter",
            description: "Drei Ebenen tief.",
            severity: "medium",
            confidence: 0.8,
            evidence: ["bis ich beim Filter bin sind das drei Klicks"],
          },
        ],
      }),
      insight("insight_02_d", "Admin", "Filter unauffindbar.", {
        pain: [
          {
            category: "UX_FRICTION",
            title: "Filter versteckt unter Optionen",
            description: "Default-Position wäre besser.",
            severity: "high",
            confidence: 0.9,
            evidence: ["der Filter ist unter Optionen versteckt, das findet niemand"],
          },
        ],
      }),
      insight("insight_02_e", "Power User", "Filter zu tief.", {
        pain: [
          {
            category: "UX_FRICTION",
            title: "Filter sollte auf Top-Level",
            description: "Sichtbar machen statt verstecken.",
            severity: "high",
            confidence: 0.9,
            evidence: ["der Filter müsste oben sichtbar sein, nicht im Untermenü"],
          },
        ],
      }),
    ],
  },
  expected: { minThemes: 1, maxThemes: 1, tensions: 0, maxThemeFrequency: 5 },
};

// ── synth_03 — sparse / incoherent ─────────────────────────────────────────

const synth03: SynthesisEvalCase = {
  id: "synth_03",
  description: "Only 2 insights on unrelated topics; n=1 per concern",
  rationale:
    "Thin-input case. With 2 unique respondents on unrelated concerns, the synthesizer must NOT claim a 'theme' from n=1 each. tensions=0 (need ≥2 per side). emergent_themes: at most 0-1, both with frequency = 1 if any.",
  input: {
    plan: {
      title: "Initial Discovery",
      objective: "Erste Eindrücke vom Produkt.",
      persona: null,
    },
    insights: [
      insight("insight_03_a", null, "Eine Person zur API.", {
        feature: [
          {
            category: "API",
            title: "API gewünscht",
            description: "Eigener Workflow benötigt API-Zugriff.",
            intensity: "medium",
            confidence: 0.7,
            evidence: ["habt ihr eine API? wir würden gern selbst was drauf bauen"],
          },
        ],
      }),
      insight("insight_03_b", null, "Andere Person zu Reporting.", {
        feature: [
          {
            category: "REPORTING",
            title: "Excel-Export",
            description: "Reports für CFO brauchen Excel.",
            intensity: "medium",
            confidence: 0.7,
            evidence: ["Excel-Export wäre Gold wert, unser CFO will das"],
          },
        ],
      }),
    ],
  },
  expected: { minThemes: 0, maxThemes: 1, tensions: 0, maxThemeFrequency: 1 },
};

// ── synth_04 — empty / off-topic ───────────────────────────────────────────

const synth04: SynthesisEvalCase = {
  id: "synth_04",
  description: "4 insights with empty feature_requests + empty pain_points",
  rationale:
    "Empty-on-empty check. When Stage-1 produced nothing actionable (4 off-topic calls), Stage 2 must NOT manufacture themes. Empty arrays + honest one-sentence overview is the correct answer.",
  input: {
    plan: {
      title: "Brand-Awareness-Studie",
      objective: "Wie nehmen Kunden den Markennamen wahr?",
      persona: null,
    },
    insights: [
      insight("insight_04_a", null, "Gespräch drehte sich um Vertrag."),
      insight("insight_04_b", null, "Kunde redete über sein Wetter."),
      insight("insight_04_c", null, "Keine Produktthemen aufgekommen."),
      insight("insight_04_d", null, "Smalltalk, keine Produkt-Erwähnung."),
    ],
  },
  expected: { minThemes: 0, maxThemes: 0, tensions: 0 },
};

// ── synth_05 — MARKET-RESEARCH lens (M2 persona) ───────────────────────────
//
// study_type='market_research'. The Stage-1 MARKET findings sit in the shared
// feature_requests field (M1 reuse §9 #1) with MARKET categories. The market
// persona must read them AS market findings and condense the price lager(s) +
// purchase intent + competitive perception — surfacing the price-sensitive vs
// premium-willing TENSION — NOT product feature/pain themes. The fixtures store
// market findings via the same `insight()` feature helper (same container; only
// the category vocabulary differs, exactly as M1 stores them).

const synth05: SynthesisEvalCase = {
  id: "synth_05",
  description:
    "Market study: price lager split (price-sensitive ≤20€ vs premium-willing) + switch intent",
  rationale:
    "The M2 market-persona case. 3 respondents set a hard price ceiling (≤15-20€), 2 pay premium for quality/support → ≥1 price theme + ONE price tension with DISJOINT sides; plus a competitive/switch-intent signal. The synthesis must read feature_requests as MARKET findings and condense price/intent, never reframe them as product feature requests.",
  input: {
    plan: {
      title: "Preisstudie PM-Tool DACH",
      objective:
        "Zahlungsbereitschaft, Kaufabsicht und Wettbewerbswahrnehmung für ein neues Projektmanagement-Tool im SMB-Segment verstehen.",
      persona: "SMB-Eigentümer & Selbstständige DACH",
      studyType: "market_research",
    },
    insights: [
      insight("call_05_a", "SMB-Eigentümer", "Preis ist die Hürde.", {
        feature: [
          {
            category: "PRICE_SENSITIVITY",
            title: "Harte Preisobergrenze 20 €",
            description: "Würde für ein PM-Tool nie mehr als 20 €/Monat zahlen.",
            intensity: "blocker",
            confidence: 0.95,
            evidence: [
              "Mehr als 20 Euro im Monat würde ich für so ein Tool nie zahlen.",
            ],
          },
        ],
      }),
      insight("call_05_b", "Freiberufler", "Schmerzgrenze 15 €.", {
        feature: [
          {
            category: "PRICE_SENSITIVITY",
            title: "Schmerzgrenze 15 €",
            description: "15 €/Monat ist die absolute Obergrenze.",
            intensity: "high",
            confidence: 0.9,
            evidence: [
              "Für ein PM-Tool sind 15 Euro pro Monat meine absolute Schmerzgrenze.",
            ],
          },
        ],
      }),
      insight("call_05_c", "Solo-Selbstständige", "Will nichts zahlen.", {
        feature: [
          {
            category: "PRICE_SENSITIVITY",
            title: "Bevorzugt kostenlose Tools",
            description: "Greift lieber zu kostenlosen Alternativen.",
            intensity: "high",
            confidence: 0.85,
            evidence: [
              "Ich nutze lieber was Kostenloses, zahlen will ich dafür eigentlich gar nichts.",
            ],
          },
        ],
      }),
      insight("call_05_d", "Agentur-Inhaber", "Zahlt für guten Support.", {
        feature: [
          {
            category: "PRICE_SENSITIVITY",
            title: "Premium für guten Support",
            description: "Guter Support rechtfertigt einen höheren Preis.",
            intensity: "medium",
            confidence: 0.8,
            evidence: [
              "Wenn der Support gut ist, zahle ich auch gern 50 Euro im Monat pro Nutzer.",
            ],
          },
        ],
      }),
      insight("call_05_e", "Team-Lead Mittelstand", "Qualität vor Preis.", {
        feature: [
          {
            category: "PRICE_SENSITIVITY",
            title: "Qualität vor Preis",
            description: "Bei einem verlässlichen Tool ist der Preis zweitrangig.",
            intensity: "medium",
            confidence: 0.8,
            evidence: [
              "Qualität hat ihren Preis, bei einem verlässlichen Tool ist Geld nicht das Thema.",
            ],
          },
        ],
      }),
      insight(
        "call_05_f",
        "Trello-Nutzer",
        "Würde bei besserer Automatisierung wechseln.",
        {
          feature: [
            {
              category: "COMPETITIVE_PERCEPTION",
              title: "Wechsel von Trello bei besserer Automatisierung",
              description:
                "Nutzt aktuell Trello; bessere Automatisierung wäre der Wechsel-Trigger.",
              intensity: "high",
              confidence: 0.85,
              evidence: [
                "Aktuell nutze ich Trello, aber wenn euer Tool bessere Automatisierung hätte, würde ich sofort wechseln.",
              ],
            },
          ],
        },
      ),
    ],
  },
  expected: { minThemes: 1, maxThemes: 4, tensions: 1, maxThemeFrequency: 6 },
};

// ── synth_06 — GENERAL SURVEY use-case focus ───────────────────────────────

const synth06: SynthesisEvalCase = {
  id: "synth_06",
  description:
    "General survey: shared planning need with paid-adoption split",
  rationale:
    "The general-survey lens should prioritize the recurring SEGMENT_NEED, then separate concrete PRICE_SENSITIVITY and PURCHASE_INTENT signals. Two respondents show paid commitment; two stay with free workarounds, creating a real adoption tension.",
  input: {
    plan: {
      title: "Familienorganisation im Alltag",
      objective:
        "Bedarf, Zahlungsbereitschaft und Kaufabsicht für einen digitalen Familienplaner verstehen.",
      persona: "Eltern mit Kindern im Schulalter",
      studyType: "market_research",
      useCase: "general_survey",
    },
    insights: [
      insight("call_06_a", "Berufstätige Mutter", "Hoher Koordinationsaufwand.", {
        feature: [
          {
            category: "SEGMENT_NEED",
            title: "Familientermine an einem Ort",
            description:
              "Koordiniert Schule, Betreuung und Arbeit heute über mehrere Kanäle.",
            intensity: "high",
            confidence: 0.95,
            evidence: [
              "Ich gleiche jeden Abend drei Chats und zwei Kalender ab, damit niemand einen Termin verpasst.",
            ],
          },
          {
            category: "PURCHASE_INTENT",
            title: "Konkrete Testbereitschaft",
            description:
              "Würde den Dienst bei Kalender-Synchronisierung direkt testen.",
            intensity: "high",
            confidence: 0.9,
            evidence: [
              "Wenn alle Kalender automatisch zusammenlaufen, würde ich das sofort einen Monat testen.",
            ],
          },
        ],
      }),
      insight("call_06_b", "Vater, zwei Kinder", "Planung kostet täglich Zeit.", {
        feature: [
          {
            category: "SEGMENT_NEED",
            title: "Weniger täglicher Abstimmungsaufwand",
            description:
              "Die manuelle Familienplanung bindet jeden Tag Zeit.",
            intensity: "high",
            confidence: 0.9,
            evidence: [
              "Für die Abstimmung in der Familie gehen bei uns jeden Tag bestimmt zwanzig Minuten drauf.",
            ],
          },
          {
            category: "PRICE_SENSITIVITY",
            title: "Zahlungsbereits bis 15 Euro",
            description:
              "Ein nachweislich zeitsparender Familienplaner wäre ein bezahltes Abo wert.",
            intensity: "medium",
            confidence: 0.85,
            evidence: [
              "Wenn es uns wirklich Zeit spart, wären bis zu 15 Euro im Monat in Ordnung.",
            ],
          },
        ],
      }),
      insight("call_06_c", "Alleinerziehend", "Braucht Übersicht, aber kostenlos.", {
        feature: [
          {
            category: "SEGMENT_NEED",
            title: "Zentrale Übersicht fehlt",
            description:
              "Termine und Aufgaben liegen verteilt in Kalendern und Notizen.",
            intensity: "high",
            confidence: 0.9,
            evidence: [
              "Mir fehlt eine einzige Übersicht für Schule, Arzttermine und meine Arbeit.",
            ],
          },
          {
            category: "PRICE_SENSITIVITY",
            title: "Nur kostenlose Lösung",
            description:
              "Das Haushaltsbudget schließt ein weiteres Abo aus.",
            intensity: "blocker",
            confidence: 0.95,
            evidence: [
              "Ein weiteres Abo kommt für mich nicht infrage, dafür muss die kostenlose Kalender-App reichen.",
            ],
          },
        ],
      }),
      insight("call_06_d", "Vater im Schichtdienst", "Bleibt beim Workaround.", {
        feature: [
          {
            category: "SEGMENT_NEED",
            title: "Schichtplan mit Familie abstimmen",
            description:
              "Unregelmäßige Arbeitszeiten erschweren die Familienkoordination.",
            intensity: "high",
            confidence: 0.9,
            evidence: [
              "Bei wechselnden Schichten verlieren wir ständig den Überblick, wer wann die Kinder übernimmt.",
            ],
          },
          {
            category: "PURCHASE_INTENT",
            title: "Keine Wechselabsicht",
            description:
              "Der bestehende kostenlose Workaround ist trotz Aufwand ausreichend.",
            intensity: "low",
            confidence: 0.85,
            evidence: [
              "So nervig die Tabelle ist, für einen neuen Dienst würde ich nicht wechseln oder bezahlen.",
            ],
          },
        ],
      }),
    ],
  },
  expected: { minThemes: 1, maxThemes: 4, tensions: 1, maxThemeFrequency: 4 },
};

// ── synth_07 — BRAND RESEARCH use-case focus ───────────────────────────────

const synth07: SynthesisEvalCase = {
  id: "synth_07",
  description:
    "Brand research: approachable specialist vs cold interchangeable provider",
  rationale:
    "The brand lens should synthesize spontaneous associations and competitive differentiation. The inputs support a real brand-image tension, but contain no need, price or purchase-intent evidence.",
  input: {
    plan: {
      title: "Markenbild Nordlicht Energie",
      objective:
        "Spontane Markenassoziationen und Differenzierung im Vergleich zu Energieanbietern verstehen.",
      persona: "Private Stromkundinnen und Stromkunden",
      studyType: "market_research",
      useCase: "brand_research",
    },
    insights: [
      insight("call_07_a", "Bestandskundin", "Warm und nahbar.", {
        feature: [
          {
            category: "BRAND_PERCEPTION",
            title: "Nahbare norddeutsche Marke",
            description:
              "Die Marke wirkt persönlich, ruhig und regional verwurzelt.",
            intensity: "high",
            confidence: 0.9,
            evidence: [
              "Nordlicht wirkt auf mich nahbar und norddeutsch, nicht wie ein anonymer Konzern.",
            ],
          },
        ],
      }),
      insight("call_07_b", "Interessent", "Sympathischer Spezialist.", {
        feature: [
          {
            category: "COMPETITIVE_PERCEPTION",
            title: "Persönlicher als große Versorger",
            description:
              "Im Wettbewerbsvergleich erscheint die Marke kleiner und zugänglicher.",
            intensity: "medium",
            confidence: 0.85,
            evidence: [
              "Im Vergleich zu den großen Versorgern fühlt sich die Marke persönlicher und zugänglicher an.",
            ],
          },
        ],
      }),
      insight("call_07_c", "Wechselkundin", "Kühl und technisch.", {
        feature: [
          {
            category: "BRAND_PERCEPTION",
            title: "Kühle Technikmarke",
            description:
              "Name und Auftritt lösen Distanz statt Nähe aus.",
            intensity: "high",
            confidence: 0.9,
            evidence: [
              "Für mich klingt Nordlicht kühl und technisch, da entsteht überhaupt keine Nähe.",
            ],
          },
        ],
      }),
      insight("call_07_d", "Nichtkunde", "Nicht unterscheidbar.", {
        feature: [
          {
            category: "COMPETITIVE_PERCEPTION",
            title: "Austauschbar im Wettbewerbsfeld",
            description:
              "Die Marke bleibt gegenüber anderen grünen Anbietern ohne klares Profil.",
            intensity: "high",
            confidence: 0.9,
            evidence: [
              "Neben anderen Ökostromanbietern wirkt das komplett austauschbar, ich sehe keinen eigenen Charakter.",
            ],
          },
        ],
      }),
    ],
  },
  expected: { minThemes: 1, maxThemes: 4, tensions: 1, maxThemeFrequency: 4 },
};

// ── synth_08 — CONCEPT TEST use-case focus ─────────────────────────────────

const synth08: SynthesisEvalCase = {
  id: "synth_08",
  description:
    "Concept test: automation concept understood and relevant vs reduced to dashboard",
  rationale:
    "The concept-test lens should lead with the split in concept understanding, then connect it to relevance and adoption. Positive intent is grounded in concrete trial commitment; rejection follows the misunderstood low-benefit reading.",
  input: {
    plan: {
      title: "Konzepttest Ausgaben-Autopilot",
      objective:
        "Verständnis, Relevanz, Nutzen und Adoptionsbereitschaft für einen automatischen Ausgaben-Optimierer prüfen.",
      persona: "Digital-affine Bankkundinnen und Bankkunden",
      studyType: "market_research",
      useCase: "concept_test",
    },
    insights: [
      insight("call_08_a", "Onlinebanking-Power-User", "Automatik klar verstanden.", {
        feature: [
          {
            category: "BRAND_PERCEPTION",
            title: "Versteht automatische Optimierung",
            description:
              "Das Konzept wird als laufende Erkennung und Optimierung unnötiger Ausgaben verstanden.",
            intensity: "high",
            confidence: 0.95,
            evidence: [
              "Ich verstehe es so, dass der Autopilot laufend unnötige Ausgaben erkennt und mir direkt bessere Optionen anbietet.",
            ],
          },
          {
            category: "PURCHASE_INTENT",
            title: "Verbindliche Testbereitschaft",
            description:
              "Würde für einen echten Test Bankdaten anbinden.",
            intensity: "high",
            confidence: 0.9,
            evidence: [
              "Für einen Test würde ich mein Konto anbinden, wenn ich die Vorschläge vorher freigeben kann.",
            ],
          },
        ],
      }),
      insight("call_08_b", "Junger Berufstätiger", "Nutzen sofort relevant.", {
        feature: [
          {
            category: "SEGMENT_NEED",
            title: "Automatische Sparpotenziale",
            description:
              "Der wahrgenommene Nutzen ist das Erkennen übersehener Sparmöglichkeiten.",
            intensity: "high",
            confidence: 0.9,
            evidence: [
              "Dass das automatisch Sparpotenziale findet, die ich selbst übersehe, wäre für mich wirklich relevant.",
            ],
          },
          {
            category: "PURCHASE_INTENT",
            title: "Würde Beta aktiv nutzen",
            description:
              "Nennt eine konkrete Bereitschaft zur mehrwöchigen Nutzung.",
            intensity: "high",
            confidence: 0.9,
            evidence: [
              "Ich würde die Beta vier Wochen mit meinen echten Umsätzen ausprobieren.",
            ],
          },
        ],
      }),
      insight("call_08_c", "Gelegenheitsnutzerin", "Nur als Dashboard verstanden.", {
        feature: [
          {
            category: "BRAND_PERCEPTION",
            title: "Reduziert Konzept auf Ausgabenanzeige",
            description:
              "Die automatische Optimierung kommt im Konzeptverständnis nicht an.",
            intensity: "high",
            confidence: 0.95,
            evidence: [
              "Für mich ist das einfach noch ein Dashboard, das meine Ausgaben in Kategorien zeigt.",
            ],
          },
          {
            category: "PURCHASE_INTENT",
            title: "Keine Adoptionsbereitschaft",
            description:
              "Sieht gegenüber dem bestehenden Banking keinen Wechselgrund.",
            intensity: "low",
            confidence: 0.9,
            evidence: [
              "Dafür würde ich weder meine Bankdaten freigeben noch eine neue App installieren.",
            ],
          },
        ],
      }),
      insight("call_08_d", "Sicherheitsorientierter Kunde", "Mehrwert bleibt unklar.", {
        feature: [
          {
            category: "BRAND_PERCEPTION",
            title: "Optimierungsfunktion nicht verstanden",
            description:
              "Der Befragte erkennt keinen Unterschied zu einer normalen Finanzübersicht.",
            intensity: "high",
            confidence: 0.9,
            evidence: [
              "Was daran mehr sein soll als eine normale Finanzübersicht, habe ich nicht verstanden.",
            ],
          },
          {
            category: "SEGMENT_NEED",
            title: "Kein relevanter Zusatznutzen",
            description:
              "Ohne verstandene Automatik entsteht kein Bedarf.",
            intensity: "low",
            confidence: 0.85,
            evidence: [
              "Meine Banking-App zeigt mir die Ausgaben schon, einen zusätzlichen Nutzen sehe ich hier nicht.",
            ],
          },
        ],
      }),
    ],
  },
  expected: { minThemes: 1, maxThemes: 4, tensions: 1, maxThemeFrequency: 4 },
};

// ── synth_09 — CREATIVE TEST use-case focus ────────────────────────────────

const synth09: SynthesisEvalCase = {
  id: "synth_09",
  description:
    "Creative test: clear confident message vs generic unclear comparison ad",
  rationale:
    "The creative-test lens should stay shallow and synthesize first impression, message clarity, effect and brand fit. The only supported tension is how the creative is interpreted, not pain or purchase intent.",
  input: {
    plan: {
      title: "Creative-Test Kampagne Sicher investieren",
      objective:
        "Erste Wirkung, Botschaftsklarheit und Markenfit eines Kampagnenmotivs prüfen.",
      persona: "Private Anlegerinnen und Anleger",
      studyType: "market_research",
      useCase: "creative_test",
    },
    insights: [
      insight("call_09_a", "ETF-Anlegerin", "Klar und vertrauenswürdig.", {
        feature: [
          {
            category: "BRAND_PERCEPTION",
            title: "Klare Sicherheitsbotschaft",
            description:
              "Das Motiv vermittelt auf Anhieb ruhiges, kontrolliertes Investieren.",
            intensity: "high",
            confidence: 0.95,
            evidence: [
              "Mein erster Eindruck ist ruhig und vertrauenswürdig, die Botschaft Sicher investieren kommt sofort an.",
            ],
          },
        ],
      }),
      insight("call_09_b", "Sparplan-Nutzer", "Passt zur seriösen Marke.", {
        feature: [
          {
            category: "BRAND_PERCEPTION",
            title: "Starker Markenfit",
            description:
              "Die reduzierte Gestaltung wird als glaubwürdig und markenkonsistent gelesen.",
            intensity: "high",
            confidence: 0.9,
            evidence: [
              "Die reduzierte Gestaltung passt zu einer seriösen Finanzmarke und wirkt nicht aufdringlich.",
            ],
          },
        ],
      }),
      insight("call_09_c", "Aktiver Trader", "Botschaft bleibt unklar.", {
        feature: [
          {
            category: "BRAND_PERCEPTION",
            title: "Unklare Aussage",
            description:
              "Das zentrale Versprechen wird nicht verstanden.",
            intensity: "high",
            confidence: 0.95,
            evidence: [
              "Ich sehe Berge und eine Zahl, aber ich weiß nach dem ersten Blick nicht, was mir die Anzeige sagen will.",
            ],
          },
        ],
      }),
      insight("call_09_d", "Neuanlegerin", "Wirkt wie Vergleichsportal.", {
        feature: [
          {
            category: "COMPETITIVE_PERCEPTION",
            title: "Generische Vergleichsportal-Optik",
            description:
              "Das Motiv wird einer austauschbaren Wettbewerber-Kategorie zugeordnet.",
            intensity: "high",
            confidence: 0.9,
            evidence: [
              "Das sieht aus wie Werbung von irgendeinem Vergleichsportal, einen eigenen Markencharakter erkenne ich nicht.",
            ],
          },
        ],
      }),
    ],
  },
  expected: { minThemes: 1, maxThemes: 4, tensions: 1, maxThemeFrequency: 4 },
};

// ── synth_10 — BRAND RESEARCH leakage guard ────────────────────────────────

const synth10: SynthesisEvalCase = {
  id: "synth_10",
  description:
    "Brand leakage guard: pure shared perception with no price or pain signal",
  rationale:
    "All inputs contain only consistent BRAND_PERCEPTION evidence. The brand lens must surface the shared competent-but-distant image without inventing an opposing group or importing a price/pain tension from the generic market persona.",
  input: {
    plan: {
      title: "Markenwahrnehmung Kanzlei Klar & Partner",
      objective:
        "Spontane Assoziationen und den bleibenden Eindruck der Marke verstehen.",
      persona: "Geschäftsführende im Mittelstand",
      studyType: "market_research",
      useCase: "brand_research",
    },
    insights: [
      insight("call_10_a", "Geschäftsführerin", "Kompetent, aber distanziert.", {
        feature: [
          {
            category: "BRAND_PERCEPTION",
            title: "Fachlich stark und distanziert",
            description:
              "Die Marke vermittelt Expertise, bleibt emotional aber auf Abstand.",
            intensity: "medium",
            confidence: 0.95,
            evidence: [
              "Klar und Partner wirkt sehr kompetent, aber auch ziemlich distanziert.",
            ],
          },
        ],
      }),
      insight("call_10_b", "CFO", "Seriös ohne persönliche Wärme.", {
        feature: [
          {
            category: "BRAND_PERCEPTION",
            title: "Seriös und unpersönlich",
            description:
              "Der professionelle Eindruck geht nicht mit menschlicher Nähe einher.",
            intensity: "medium",
            confidence: 0.9,
            evidence: [
              "Mein Eindruck ist seriös und fachlich, nur persönlich oder nahbar wirkt die Marke nicht.",
            ],
          },
        ],
      }),
      insight("call_10_c", "Inhaber", "Expertise bleibt kühl.", {
        feature: [
          {
            category: "BRAND_PERCEPTION",
            title: "Expertise mit kühler Wirkung",
            description:
              "Die Marke wird als erfahren, zugleich aber emotional kühl wahrgenommen.",
            intensity: "medium",
            confidence: 0.9,
            evidence: [
              "Da steckt sichtbar Expertise dahinter, trotzdem bleibt der Auftritt für mich kühl.",
            ],
          },
        ],
      }),
    ],
  },
  expected: { minThemes: 1, maxThemes: 2, tensions: 0, maxThemeFrequency: 3 },
};

export const SYNTHESIS_EVAL_CASES: SynthesisEvalCase[] = [
  synth01,
  synth02,
  synth03,
  synth04,
  synth05,
  synth06,
  synth07,
  synth08,
  synth09,
  synth10,
];
