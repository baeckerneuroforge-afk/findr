/**
 * Solution-Layer Eval Dataset
 * ---------------------------
 * 6 hand-crafted cases for measuring the QUALITY of generateSolution(). Unlike
 * the risk/loss evals there is no right/wrong label — solutions are judged on
 * properties (grounded? concrete next step? no hallucination?) plus a human read.
 *
 * Each case is a realistic deal: deal context + transcript + a HAND-SET risk
 * analysis (the kind the risk layer would produce) as the input to the solution
 * layer. The cases cover different signal types plus one healthy deal.
 *
 * IMPORTANT: every quote inside `riskAnalysis.signals[].quotes` is written as a
 * verbatim substring of that case's `transcript`. That keeps the cases honest
 * (the model can actually ground on them) and lets the runner's anchoring /
 * hallucination heuristics check evidence against the transcript.
 *
 * No `companyProfile` in this first round — that variant comes later.
 */

import type { RiskAnalysisResult } from "@/lib/schemas/risk";
import type { SolutionDealContext } from "@/lib/solution/extractor";

export interface SolutionEvalCase {
  id: string;
  description: string;
  deal: SolutionDealContext;
  transcript: string;
  /** A hand-set risk analysis standing in for the risk layer's output. */
  riskAnalysis: RiskAnalysisResult;
  /** Why this case exists / what it stresses. For human readers. */
  rationale: string;
}

export const SOLUTION_EVAL_CASES: SolutionEvalCase[] = [
  {
    id: "sol_01",
    description: "Champion Loss — champion leaving, successor will re-evaluate",
    deal: {
      stage: "negotiation",
      amount: 85000,
      currency: "EUR",
      callsCount: 4,
      industry: "Logistics",
    },
    transcript: [
      "Rep: Schön, dass wir heute nochmal sprechen. Wo stehen wir aus Ihrer Sicht?",
      "Champion: Ich wollte Ihnen offen sagen: Ich verlasse das Unternehmen Ende des Monats. Meine Nachfolgerin Frau Klein übernimmt das Projekt, aber sie muss sich erst komplett einarbeiten.",
      "Rep: Das tut mir leid zu hören. Wie geht es dann mit unserem Projekt weiter?",
      "Champion: Ehrlich gesagt weiß ich nicht, ob Frau Klein die gleiche Priorität sieht. Sie hat schon angedeutet, dass sie erst alle laufenden Themen neu bewerten will.",
    ].join("\n"),
    riskAnalysis: {
      riskScore: 78,
      riskLevel: "high",
      signals: [
        {
          type: "CHAMPION_LOSS",
          confidence: 0.9,
          reasoning:
            "The internal champion is leaving at month-end and the successor has signaled she will re-evaluate all open initiatives.",
          quotes: [
            "Ich verlasse das Unternehmen Ende des Monats",
            "Meine Nachfolgerin Frau Klein übernimmt das Projekt, aber sie muss sich erst komplett einarbeiten",
          ],
        },
      ],
      overallReasoning:
        "The deal's champion is leaving and the successor (Frau Klein) intends to re-assess all running topics, putting continuity and priority at risk late in negotiation.",
      recommendations: [],
    },
    rationale:
      "Single clear CHAMPION_LOSS. A good solution secures a warm handover to Frau Klein and re-anchors priority before the champion leaves.",
  },
  {
    id: "sol_02",
    description: "Late Decision-Maker — CFO surfaces before signature",
    deal: {
      stage: "proposal_sent",
      amount: 120000,
      currency: "EUR",
      callsCount: 3,
      industry: "Manufacturing",
    },
    transcript: [
      "Champion: Das Angebot sieht gut aus, danke. Aber bevor wir unterschreiben, muss unser CFO, Herr Wagner, noch zustimmen.",
      "Rep: War Herr Wagner bisher eingebunden?",
      "Champion: Nein, er war bisher nicht involviert und will den Business Case nochmal komplett sehen. Er ist sehr zahlengetrieben.",
    ].join("\n"),
    riskAnalysis: {
      riskScore: 64,
      riskLevel: "high",
      signals: [
        {
          type: "LATE_DECISION_MAKER",
          confidence: 0.85,
          reasoning:
            "A previously uninvolved CFO must approve before signature and wants to re-examine the full business case.",
          quotes: [
            "bevor wir unterschreiben, muss unser CFO, Herr Wagner, noch zustimmen",
            "er war bisher nicht involviert und will den Business Case nochmal komplett sehen",
          ],
        },
      ],
      overallReasoning:
        "A late, numbers-driven gate: CFO Herr Wagner, not previously involved, must sign off and wants the full business case re-presented before signature.",
      recommendations: [],
    },
    rationale:
      "LATE_DECISION_MAKER. A good solution arms the champion with a CFO-grade business case and gets the rep into the room with Herr Wagner.",
  },
  {
    id: "sol_03",
    description: "Competitor Pressure — Gong in the deal, no company profile",
    deal: {
      stage: "demo",
      amount: 64000,
      currency: "USD",
      callsCount: 2,
      industry: "SaaS",
    },
    transcript: [
      "Buyer: The demo was solid. I'll be transparent though — we're also looking seriously at Gong.",
      "Rep: Appreciate the honesty. What's drawing you to them?",
      "Buyer: Honestly their conversation analytics felt more mature in the demo, and our CRO will ask why we'd pick you over them.",
    ].join("\n"),
    riskAnalysis: {
      riskScore: 58,
      riskLevel: "medium",
      signals: [
        {
          type: "COMPETITOR_PRESSURE",
          confidence: 0.8,
          reasoning:
            "Buyer is actively evaluating Gong, perceives their analytics as more mature, and the CRO will demand a differentiation rationale.",
          quotes: [
            "we're also looking seriously at Gong",
            "their conversation analytics felt more mature in the demo, and our CRO will ask why we'd pick you over them",
          ],
        },
      ],
      overallReasoning:
        "Active competitive evaluation against Gong with a perceived analytics-maturity gap and an executive (CRO) who will require a clear reason to choose us.",
      recommendations: [],
    },
    rationale:
      "COMPETITOR_PRESSURE with NO company profile — tests whether the model stays grounded in the transcript instead of inventing differentiators it cannot support.",
  },
  {
    id: "sol_04",
    description: "Budget Friction — spend freeze, ROI gate",
    deal: {
      stage: "proposal_sent",
      amount: 95000,
      currency: "EUR",
      callsCount: 3,
      industry: "Retail",
    },
    transcript: [
      "Buyer: Wir wollen das Projekt wirklich, aber es gibt ein Problem. Der CFO hat gerade alle neuen Ausgaben eingefroren.",
      "Rep: Was würde den Spielraum wieder öffnen?",
      "Buyer: Ohne einen klaren ROI-Nachweis in unter sechs Monaten bekommen wir das Budget dieses Jahr nicht frei. So einfach ist das gerade.",
    ].join("\n"),
    riskAnalysis: {
      riskScore: 72,
      riskLevel: "high",
      signals: [
        {
          type: "BUDGET_FRICTION",
          confidence: 0.88,
          reasoning:
            "A company-wide spend freeze blocks the deal; budget only reopens with a hard ROI proof of payback under six months.",
          quotes: [
            "Der CFO hat gerade alle neuen Ausgaben eingefroren",
            "Ohne einen klaren ROI-Nachweis in unter sechs Monaten bekommen wir das Budget dieses Jahr nicht frei",
          ],
        },
      ],
      overallReasoning:
        "Budget is frozen company-wide; the only path to release this year is a concrete ROI proof showing payback in under six months.",
      recommendations: [],
    },
    rationale:
      "BUDGET_FRICTION. A good solution builds a sub-6-month ROI case tied to the freeze, not a generic 'show value'.",
  },
  {
    id: "sol_05",
    description:
      "Multi-signal critical — disengagement + competitor + stalling",
    deal: {
      stage: "negotiation",
      amount: 210000,
      currency: "EUR",
      callsCount: 5,
      industry: "Financial Services",
    },
    transcript: [
      "Rep: Wir hatten letzte Woche keine Rückmeldung — wie sieht Ihr Zeitplan aus?",
      "Champion: Ehrlich, ich melde mich in zwei, drei Wochen, gerade andere Prioritäten.",
      "Rep: Verstanden. Gibt es noch andere Optionen, die Sie prüfen?",
      "Champion: Wir schauen uns parallel Clari an, das will die Bereichsleitung so.",
      "Rep: Und der Vertrag selbst?",
      "Champion: Lass uns das auf nach dem Quartal verschieben, vorher passiert hier nichts.",
    ].join("\n"),
    riskAnalysis: {
      riskScore: 84,
      riskLevel: "critical",
      signals: [
        {
          type: "CHAMPION_DISENGAGEMENT",
          confidence: 0.8,
          reasoning:
            "Champion has gone quiet and defers contact by weeks, citing other priorities.",
          quotes: ["ich melde mich in zwei, drei Wochen, gerade andere Prioritäten"],
        },
        {
          type: "COMPETITOR_PRESSURE",
          confidence: 0.75,
          reasoning:
            "A competitor (Clari) is being evaluated in parallel at leadership's request.",
          quotes: [
            "Wir schauen uns parallel Clari an, das will die Bereichsleitung so",
          ],
        },
        {
          type: "STALLING_PATTERN",
          confidence: 0.72,
          reasoning:
            "Contract is explicitly pushed past quarter-end with no interim progress.",
          quotes: [
            "Lass uns das auf nach dem Quartal verschieben, vorher passiert hier nichts",
          ],
        },
      ],
      overallReasoning:
        "Three compounding signals on a large deal: a disengaging champion, a leadership-driven Clari evaluation, and an explicit push past quarter-end.",
      recommendations: [],
    },
    rationale:
      "Multi-signal critical — tests prioritization and whether each recommendation stays tied to its OWN signal/quote rather than blurring into one generic plan.",
  },
  {
    id: "sol_06",
    description: "Healthy deal — no signals, should produce no recommendations",
    deal: {
      stage: "verbal_commit",
      amount: 76000,
      currency: "USD",
      callsCount: 4,
      industry: "Healthcare",
    },
    transcript: [
      "Buyer: This looks great. I've looped in our VP and Legal, and we're targeting signature by the 15th.",
      "Rep: Perfect. Anything you still need from us?",
      "Buyer: Just send the order form and we'll get it moving. The team is aligned.",
    ].join("\n"),
    riskAnalysis: {
      riskScore: 12,
      riskLevel: "low",
      signals: [],
      overallReasoning:
        "Healthy, multi-threaded deal: VP and Legal are engaged, a signature date (the 15th) is set, and the buyer requested the order form.",
      recommendations: [],
    },
    rationale:
      "Healthy control case — a good solution returns NO recommendations and salvageable 'yes', proving the model does not manufacture problems.",
  },
];

/**
 * Distribution:
 *   Signals covered: CHAMPION_LOSS, LATE_DECISION_MAKER, COMPETITOR_PRESSURE,
 *                    BUDGET_FRICTION, CHAMPION_DISENGAGEMENT + STALLING_PATTERN
 *                    (in the multi-signal case), plus one healthy (no signals).
 *   Language: de ×4, en ×2.   Company profile: none (round 1).
 */
