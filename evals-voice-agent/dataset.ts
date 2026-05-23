/**
 * Voice-Agent Eval Dataset
 * ------------------------
 * 6 lost-deal cases for measuring the post-loss interview agent. Each case pairs
 * a deal + the risk-analysis prediction with a hidden "customer persona": the
 * REAL loss reason (ground truth) and a behavior description that a second LLM
 * uses to role-play the buyer in run.ts.
 *
 * Coverage: cooperative (says the real reason openly), polite half-truth (gives a
 * surface reason, only reveals the truth when probed), evasive (deflects), and
 * cases where the risk prediction was WRONG (real reason differs) — plus one
 * "partial" where the prediction only half-overlaps the truth.
 *
 * The hidden truth and behavior are NEVER passed to the interview agent — only
 * to the simulated customer.
 */

import type { LossReasonType } from "@/lib/loss/extractor";
import type { RiskAnalysisResult } from "@/lib/schemas/risk";
import type { VoiceDealContext } from "@/lib/voice-agent/interviewer";

export interface VoicePersona {
  /** The real loss reason (ground truth, hidden from the agent). */
  realReason: LossReasonType;
  language: "de" | "en";
  /** Does the buyer give a polite surface reason before the truth? */
  surfaceAnswerFirst: boolean;
  /** Expected verdict from the agent's risk-match judgement. */
  expectedMatch: "yes" | "no" | "partial";
  /** Instructions for the simulated customer (contains the real-reason story). */
  behavior: string;
}

export interface VoiceEvalCase {
  id: string;
  description: string;
  deal: VoiceDealContext;
  /** What the risk analysis predicted (the agent sees this; the truth it doesn't). */
  riskAnalysis: RiskAnalysisResult;
  persona: VoicePersona;
  rationale: string;
}

export const VOICE_EVAL_CASES: VoiceEvalCase[] = [
  {
    id: "voice_01",
    description: "Cooperative — open about the real reason (budget); risk was right",
    deal: {
      dealName: "Q2 Renewal",
      company: "Nordwind Logistik GmbH",
      contactName: "Anna Berg",
      amount: 64000,
      currency: "EUR",
    },
    riskAnalysis: {
      riskScore: 70,
      riskLevel: "high",
      signals: [
        {
          type: "BUDGET_FRICTION",
          confidence: 0.82,
          reasoning: "Finance was non-committal and a spend review was mentioned.",
          quotes: [],
        },
      ],
      overallReasoning:
        "Budget pressure flagged late in the cycle; finance had not committed funds.",
      recommendations: [],
    },
    persona: {
      realReason: "budget",
      language: "de",
      surfaceAnswerFirst: false,
      expectedMatch: "yes",
      behavior:
        "Der echte Grund: die Geschäftsführung hat das Budget für neue Tools dieses Jahr eingefroren. Du bist offen und nennst das schon auf die erste Frage hin direkt — du hast nichts zu verbergen, das Produkt fandest du gut, es lag wirklich nur am eingefrorenen Budget.",
    },
    rationale:
      "Easy baseline: cooperative buyer, real reason stated immediately, risk prediction correct -> expect match=yes, agent shouldn't need to over-probe.",
  },
  {
    id: "voice_02",
    description: "Polite half-truth — says 'too expensive', real reason is champion loss",
    deal: {
      dealName: "Acme Rollout",
      company: "Acme GmbH",
      contactName: "Markus Klein",
      amount: 85000,
      currency: "EUR",
    },
    riskAnalysis: {
      riskScore: 78,
      riskLevel: "high",
      signals: [
        {
          type: "CHAMPION_LOSS",
          confidence: 0.86,
          reasoning: "The internal champion appeared to be leaving.",
          quotes: [],
        },
      ],
      overallReasoning:
        "Suspected champion departure putting continuity and momentum at risk.",
      recommendations: [],
    },
    persona: {
      realReason: "champion_lost",
      language: "en",
      surfaceAnswerFirst: true,
      expectedMatch: "yes",
      behavior:
        "Your polite first answer is that the price was a little high. The REAL reason: the colleague championing this internally (Sarah) left the company and nobody picked it up — it quietly died on your side. Only admit the champion part if the agent asks an empathetic, specific follow-up (about who was driving it internally, or whether something changed on your team). If they just accept 'too expensive', don't volunteer more.",
    },
    rationale:
      "The core test: surface price answer hiding champion_lost. Agent must probe to reach the truth; risk predicted champion -> expect match=yes.",
  },
  {
    id: "voice_03",
    description: "Evasive — deflects to 'timing/internal', real reason is a competitor",
    deal: {
      dealName: "Pipeline Intelligence",
      company: "Helvetia Vertrieb",
      contactName: "Lena Fischer",
      amount: 110000,
      currency: "EUR",
    },
    riskAnalysis: {
      riskScore: 62,
      riskLevel: "high",
      signals: [
        {
          type: "COMPETITOR_PRESSURE",
          confidence: 0.74,
          reasoning: "A competitor benchmark came up during evaluation.",
          quotes: [],
        },
      ],
      overallReasoning:
        "Competitor comparison surfaced; an executive wanted a differentiation rationale.",
      recommendations: [],
    },
    persona: {
      realReason: "competitor",
      language: "de",
      surfaceAnswerFirst: true,
      expectedMatch: "yes",
      behavior:
        "Du bist zurückhaltend und weichst aus — erst 'gerade kein guter Zeitpunkt', dann 'eher interne Gründe'. Der echte Grund: ihr habt euch für einen Wettbewerber (Gong) entschieden, der im direkten Vergleich besser abgeschnitten hat. Das gibst du erst zu, wenn der Agent freundlich, aber konkret nachhakt (z.B. ob ihr eine andere Lösung evaluiert habt). Bleib höflich; nenne den Wettbewerber erst nach ein bis zwei gezielten Nachfragen.",
    },
    rationale:
      "Evasive buyer requiring persistence. Tests whether the agent keeps gently probing instead of accepting the deflection; risk predicted competitor -> expect match=yes.",
  },
  {
    id: "voice_04",
    description: "Risk WRONG — predicted competitor, real reason is a feature/integration gap",
    deal: {
      dealName: "CS Expansion",
      company: "TechCorp Solutions",
      contactName: "David Huber",
      amount: 95000,
      currency: "EUR",
    },
    riskAnalysis: {
      riskScore: 58,
      riskLevel: "medium",
      signals: [
        {
          type: "COMPETITOR_PRESSURE",
          confidence: 0.7,
          reasoning: "Comparison questions were read as competitor pressure.",
          quotes: [],
        },
      ],
      overallReasoning:
        "Assumed a competitor was winning based on pointed comparison questions.",
      recommendations: [],
    },
    persona: {
      realReason: "feature_gap",
      language: "en",
      surfaceAnswerFirst: true,
      expectedMatch: "no",
      behavior:
        "Your first, polite answer is that it mostly came down to pricing. The REAL reason: findr. couldn't integrate with your existing Salesforce setup the way your ops team needed — a hard blocker. There was no competitor in play; the risk team guessed wrong. Reveal the integration gap once the agent digs past price (e.g. asks what specifically tipped the decision, or whether the product fit your stack).",
    },
    rationale:
      "Risk prediction is wrong (competitor) vs real feature_gap, hidden behind a price half-truth. Tests both probing AND correct match=no detection.",
  },
  {
    id: "voice_05",
    description: "Half-truth 'timing' hiding a compliance blocker; risk predicted budget",
    deal: {
      dealName: "Security Pilot",
      company: "Rheinland Bank",
      contactName: "Petra Wagner",
      amount: 150000,
      currency: "EUR",
    },
    riskAnalysis: {
      riskScore: 66,
      riskLevel: "high",
      signals: [
        {
          type: "BUDGET_FRICTION",
          confidence: 0.68,
          reasoning: "Heavy procurement involvement was read as budget scrutiny.",
          quotes: [],
        },
      ],
      overallReasoning:
        "Procurement-led process assumed to be a budget/spend constraint.",
      recommendations: [],
    },
    persona: {
      realReason: "compliance",
      language: "de",
      surfaceAnswerFirst: true,
      expectedMatch: "no",
      behavior:
        "Erste Antwort: 'der Zeitpunkt hat einfach nicht gepasst'. Der echte Grund: euer Betriebsrat und die Rechtsabteilung hatten DSGVO- und Datenschutz-Bedenken, die nicht ausgeräumt werden konnten — ein klarer Compliance-Blocker, nichts mit Budget. Das erzählst du erst, wenn der Agent einfühlsam nachfragt, was konkret im Weg stand. (Die Risk-Analyse vermutete 'Budget' und lag damit falsch.)",
    },
    rationale:
      "Compliance truth behind a 'timing' deflection; risk predicted budget -> expect match=no. Tests probing + mismatch detection in German.",
  },
  {
    id: "voice_06",
    description: "Partial — risk led with competitor but real reason is budget (it also flagged budget)",
    deal: {
      dealName: "Growth Tier",
      company: "Mittelstand AG",
      contactName: "Thomas Bauer",
      amount: 48000,
      currency: "EUR",
    },
    riskAnalysis: {
      riskScore: 60,
      riskLevel: "high",
      signals: [
        {
          type: "COMPETITOR_PRESSURE",
          confidence: 0.7,
          reasoning: "A competitor benchmark was mentioned and emphasized.",
          quotes: [],
        },
        {
          type: "BUDGET_FRICTION",
          confidence: 0.6,
          reasoning: "Some budget tightness was noted as a secondary concern.",
          quotes: [],
        },
      ],
      overallReasoning:
        "Led with competitor pressure as the primary risk; budget tightness flagged as secondary.",
      recommendations: [],
    },
    persona: {
      realReason: "budget",
      language: "de",
      surfaceAnswerFirst: false,
      expectedMatch: "partial",
      behavior:
        "Du bist relativ offen. Der echte Grund war am Ende schlicht das Budget — die Mittel wurden gekürzt und ihr musstet priorisieren. Einen Wettbewerber habt ihr kurz angeschaut, aber der war nicht ausschlaggebend. Nenne Budget als Hauptgrund, wenn gefragt, und erwähne den Wettbewerber nur als Randnotiz.",
    },
    rationale:
      "Risk led with competitor but also flagged budget; real reason is budget -> expect match=partial (prediction overlapped but mis-prioritized).",
  },
];

/**
 * Distribution — expectedMatch: yes ×3 (01,02,03), no ×2 (04,05), partial ×1 (06).
 * surfaceAnswerFirst: 4 of 6 (the probing test). Language: de ×4, en ×2.
 */
