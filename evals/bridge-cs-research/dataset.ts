/**
 * Bridge CS→Research Eval Dataset — EXACTLY 6 cases.
 * --------------------------------------------------
 * 4 klare Cluster · 1 dünner Cluster (an der Schwelle) · 1 mehrdeutiger.
 *
 * Anti-Hallu-Posture: bei mehrdeutigem Cluster MUSS die Derivation
 * ehrlich kein Goal liefern (derivable=false, goal=null). Beim dünnen
 * Cluster (2 Accounts) erlaubt der System-Prompt einen vorsichtigen
 * Minimal-Goal — die Eval-Heuristik akzeptiert das, prüft aber, dass
 * der Goal-Satz die kleine Fallzahl semantisch widerspiegelt.
 *
 * Anchor-Check: jedes signalType hat eine Liste deutscher Schlüssel-
 * begriffe. Mindestens einer davon MUSS im goal-Feld vorkommen (lexikalisch
 * geprüft nach Umlaut-Folding, kein LLM-Judge). Sonst hat das Goal den
 * Cluster-Grund nicht referenziert.
 */

import type { DeriveInput } from "@/lib/bridge/cs-to-research";

export interface BridgeEvalCase {
  id: string;
  description: string;
  rationale: string;
  input: DeriveInput;
  expected: {
    /** Soll derivable=true sein oder ehrliche Absage (false)? */
    derivable: boolean;
    /** Bei derivable=true: deutsche Schlüsselbegriffe, von denen mindestens
     *  einer im goal-Feld vorkommen MUSS. Vom Klartext-Label der Signal-Type
     *  abgeleitet. Ignoriert für derivable=false. */
    anchorTerms?: string[];
    /** Bei dünnen Clustern (2 Accounts): das goal soll Vorsicht
     *  ausdrücken — eines dieser Wörter MUSS vorkommen ("erste",
     *  "explorativ", "vorsichtig", "klein", "Mini-Studie"). Ignoriert
     *  für klare/Mixed-Cases. */
    cautionTerms?: string[];
    /** Strings, die im goal NICHT vorkommen dürfen (typische
     *  Halluzinationen). Schmal halten — wir wollen False Positives
     *  vermeiden. */
    forbiddenTerms?: string[];
  };
}

export const BRIDGE_EVAL_CASES: BridgeEvalCase[] = [
  // ── 1/6 KLAR — Champion-Loss-Cluster, normaler Umfang ───────────────────
  {
    id: "bridge_01_champion_loss_normal",
    description: "5 verlorene Accounts mit Champion-Verlust, klares Signal",
    rationale:
      "Standard-Happy-Case. Erwartung: derivable=true, Goal referenziert Champion-Verlust auf Deutsch (Wort 'Champion' oder 'Fürsprecher'), keine erfundenen Spezifika.",
    input: {
      signalType: "CHAMPION_LOSS",
      accountCount: 5,
      windowDays: 90,
    },
    expected: {
      derivable: true,
      anchorTerms: ["champion", "fuersprecher", "fürsprecher"],
      forbiddenTerms: ["hubspot", "salesforce"],
    },
  },

  // ── 2/6 KLAR — Competitor-Pressure, Enterprise-Segment ──────────────────
  {
    id: "bridge_02_competitor_enterprise",
    description: "4 Enterprise-Kunden durch Wettbewerber-Druck verloren",
    rationale:
      "Mit Segment-Hinweis. Goal soll Wettbewerb/Konkurrenz nennen und das Enterprise-Segment einfangen — KEINE konkreten Wettbewerber-Namen erfinden.",
    input: {
      signalType: "COMPETITOR_PRESSURE",
      accountCount: 4,
      segment: "Enterprise B2B",
      windowDays: 60,
    },
    expected: {
      derivable: true,
      // Der Anchor prüft die inhaltliche Cluster-Referenz (semantischer
      // Bezug auf Wettbewerber-Druck), NICHT eine bestimmte Nomen-Form.
      // "wettbewerb" deckt "wettbewerber/wettbewerbsdruck" als Teilstring
      // ab; "konkurr" deckt "konkurrenz/konkurrierende/konkurrenzdruck"
      // (Adjektiv- + Nomen-Formen).
      anchorTerms: ["wettbewerb", "konkurr", "mitbewerb"],
      // Konkrete Wettbewerber sind keine im Input — dürfen also nicht
      // halluziniert werden. Beispielhafte Listen-Items.
      forbiddenTerms: ["salesforce", "hubspot", "pipedrive"],
    },
  },

  // ── 3/6 KLAR — Budget-Friction ───────────────────────────────────────────
  {
    id: "bridge_03_budget_friction_smb",
    description: "3 SMB-Kunden durch Budget-Reibung verloren",
    rationale:
      "Knapp über Threshold, klares Signal. Goal muss Budget oder Kosten referenzieren.",
    input: {
      signalType: "BUDGET_FRICTION",
      accountCount: 3,
      segment: "SMB SaaS",
      windowDays: 90,
    },
    expected: {
      derivable: true,
      anchorTerms: ["budget", "kosten", "preis"],
      forbiddenTerms: [],
    },
  },

  // ── 4/6 KLAR — Engagement-Drop, größerer Cluster ─────────────────────────
  {
    id: "bridge_04_engagement_drop_large",
    description: "8 Accounts mit massivem Engagement-Rückgang vor Kündigung",
    rationale:
      "Größter Cluster im Set. Goal muss Engagement / Kommunikation / Rückgang nennen.",
    input: {
      signalType: "ENGAGEMENT_DROP",
      accountCount: 8,
      windowDays: 120,
    },
    expected: {
      derivable: true,
      anchorTerms: ["engagement", "kommunikation", "rueckgang", "rückgang"],
      forbiddenTerms: [],
    },
  },

  // ── 5/6 DÜNN — knapp an der Schwelle ────────────────────────────────────
  {
    id: "bridge_05_thin_two_accounts",
    description: "Nur 2 Accounts mit Stalling-Pattern — sehr dünne Basis",
    rationale:
      "Knapp an der Schwelle — der System-Prompt erlaubt derivable=true mit vorsichtiger Formulierung. Goal MUSS Vorsicht signalisieren ('erste', 'explorativ', 'vorsichtig', 'klein', 'Mini-Studie') UND den Stalling-Grund referenzieren.",
    input: {
      signalType: "STALLING_PATTERN",
      accountCount: 2,
      windowDays: 90,
    },
    expected: {
      derivable: true,
      anchorTerms: ["verzoegerung", "verzögerung", "stalling", "stockend", "entscheidung"],
      cautionTerms: ["erste", "explorativ", "vorsichtig", "klein", "mini", "dünn", "duenn"],
      forbiddenTerms: [],
    },
  },

  // ── 6/6 MEHRDEUTIG — Mixed-Signal-Cluster ───────────────────────────────
  {
    id: "bridge_06_mixed_signals",
    description: "Cluster mit gemischten Signalen — Brücke muss ehrlich refuse",
    rationale:
      "Härtester Anti-Hallu-Test. Der signalType ist 'MIXED' und die Notes machen klar, dass keine eindeutige Ursache erkennbar ist. Engine MUSS derivable=false + goal=null liefern, NICHT zwei Themen zu einem zusammenrühren oder eines bevorzugen.",
    input: {
      signalType: "MIXED",
      accountCount: 5,
      signalNotes:
        "Im Cluster sind 2 Accounts mit CHAMPION_LOSS, 2 mit BUDGET_FRICTION und 1 mit ENGAGEMENT_DROP — keine dominante Ursache.",
      windowDays: 90,
    },
    expected: {
      derivable: false,
    },
  },
];
