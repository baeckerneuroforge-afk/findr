import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { MOCK_DEALS } from "@/lib/deals/mock-data";
import { generateCallsForDeal } from "@/lib/calls/mock-call-generator";
import type { Deal, RiskLevel } from "@/lib/deals/types";
import type { LossReasonEvidence, LossReasonType } from "@/lib/loss/extractor";
import type { RiskAnalysisResult, RiskSignal } from "@/lib/schemas/risk";
import type { Database, Json } from "@/types/database";

type SupabaseClient = ReturnType<typeof createAdminSupabaseClient>;
type DealInsert = Database["public"]["Tables"]["deals"]["Insert"];
type LossReasonInsert = Database["public"]["Tables"]["loss_reasons"]["Insert"];

interface DemoRiskScore {
  mockDealId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  overallReasoning: string;
  recommendations: string[];
  signals: RiskSignal[];
}

interface DemoLossReason {
  mockDealId: string;
  primaryReason: LossReasonType;
  secondaryReasons: LossReasonType[];
  confidence: number;
  evidenceQuotes: LossReasonEvidence[];
  extractedDaysAgo: number;
  notes: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const DEMO_LOST_DEALS: Deal[] = [
  {
    id: "deal_011",
    name: "RheinWerk Banking — €92k ARR",
    companyName: "RheinWerk Banking AG",
    amount: 92000,
    currency: "EUR",
    stage: "closed_lost",
    ownerName: "Sarah Mueller",
    championName: "Claudia Neumann",
    championTitle: "Head of Sales Operations",
    daysSinceLastActivity: 24,
    callsCompleted: 7,
    emailsSent: 19,
    stakeholdersCount: 5,
    competitorsMentioned: ["Salesforce"],
    closeDate: "2026-04-24",
    createdAt: "2026-01-18",
  },
  {
    id: "deal_012",
    name: "AlpenKasse Analytics — €54k ARR",
    companyName: "AlpenKasse eG",
    amount: 54000,
    currency: "EUR",
    stage: "closed_lost",
    ownerName: "Thomas Becker",
    championName: "Nina Vogt",
    championTitle: "VP Customer Success",
    daysSinceLastActivity: 31,
    callsCompleted: 5,
    emailsSent: 16,
    stakeholdersCount: 4,
    competitorsMentioned: ["Hubspot"],
    closeDate: "2026-04-17",
    createdAt: "2026-02-03",
  },
  {
    id: "deal_013",
    name: "HanseMed Group — €76k ARR",
    companyName: "HanseMed Group GmbH",
    amount: 76000,
    currency: "EUR",
    stage: "closed_lost",
    ownerName: "Klaus Brandt",
    championName: "Markus Klein",
    championTitle: "Revenue Operations Lead",
    daysSinceLastActivity: 18,
    callsCompleted: 6,
    emailsSent: 21,
    stakeholdersCount: 6,
    competitorsMentioned: ["Gong"],
    closeDate: "2026-05-03",
    createdAt: "2026-02-12",
  },
  {
    id: "deal_014",
    name: "MittelstandCloud — €41k ARR",
    companyName: "MittelstandCloud GmbH",
    amount: 41000,
    currency: "EUR",
    stage: "closed_lost",
    ownerName: "Rebecca Davis",
    championName: "Tobias Winter",
    championTitle: "COO",
    daysSinceLastActivity: 29,
    callsCompleted: 4,
    emailsSent: 13,
    stakeholdersCount: 3,
    competitorsMentioned: ["Clari"],
    closeDate: "2026-04-21",
    createdAt: "2026-02-28",
  },
  {
    id: "deal_015",
    name: "Nordsee Retail — €63k ARR",
    companyName: "Nordsee Retail GmbH",
    amount: 63000,
    currency: "EUR",
    stage: "closed_lost",
    ownerName: "Emily Chen",
    championName: "Laura Petersen",
    championTitle: "Sales Enablement Manager",
    daysSinceLastActivity: 36,
    callsCompleted: 8,
    emailsSent: 22,
    stakeholdersCount: 5,
    competitorsMentioned: ["Salesforce", "Hubspot"],
    closeDate: "2026-04-09",
    createdAt: "2026-01-29",
  },
];

const DEMO_DEALS: Deal[] = [...MOCK_DEALS, ...DEMO_LOST_DEALS];

const DEMO_LOSS_REASONS: DemoLossReason[] = [
  {
    mockDealId: "deal_011",
    primaryReason: "compliance",
    secondaryReasons: ["budget", "timing"],
    confidence: 0.88,
    extractedDaysAgo: 27,
    notes:
      "Demo seed: compliance loss creates the top historical pattern for early-warning.",
    evidenceQuotes: [
      {
        call_id: "demo_loss_deal_011_call_01",
        speaker: "Dr. Martin Seidel",
        quote:
          "[Dr. Martin Seidel|decision_maker|Security Review blockiert Abschluss] Ohne ISO-27001-Nachweis und eine Freigabe unserer Datenschutzbeauftragten bekommen wir das dieses Quartal nicht durch.",
        pattern_matched: "iso\\s*27001|datenschutz",
      },
      {
        call_id: "demo_loss_deal_011_call_02",
        speaker: "Claudia Neumann",
        quote:
          "[Claudia Neumann|champion|Champion kann Compliance-Blocker nicht auflösen] Ich finde Findr fachlich stark, aber Legal hat gerade die Hand drauf. Mir fehlt intern die Freigabe für die Datenverarbeitung.",
        pattern_matched: "legal|datenverarbeitung",
      },
    ],
  },
  {
    mockDealId: "deal_012",
    primaryReason: "compliance",
    secondaryReasons: ["no_decision", "timing"],
    confidence: 0.84,
    extractedDaysAgo: 34,
    notes:
      "Demo seed: second compliance loss makes compliance the clear top pattern.",
    evidenceQuotes: [
      {
        call_id: "demo_loss_deal_012_call_01",
        speaker: "Sven Hartwig",
        quote:
          "[Sven Hartwig|buyer|Betriebsrat stoppt Rollout] Der Betriebsrat möchte vor einer Entscheidung eine komplette Datenschutzfolgeabschätzung sehen. Das bekommen wir vor Q3 nicht sauber hin.",
        pattern_matched: "betriebsrat|datenschutz",
      },
      {
        call_id: "demo_loss_deal_012_call_02",
        speaker: "Nina Vogt",
        quote:
          "[Nina Vogt|champion|Entscheidung wird wegen DSGVO vertagt] Fachlich würde ich gern weitermachen, aber DSGVO und Betriebsrat sind gerade die Showstopper.",
        pattern_matched: "dsgvo|betriebsrat",
      },
    ],
  },
  {
    mockDealId: "deal_013",
    primaryReason: "compliance",
    secondaryReasons: ["feature_gap", "internal_priority"],
    confidence: 0.82,
    extractedDaysAgo: 19,
    notes:
      "Demo seed: healthcare-specific compliance loss reinforces DACH regulated-industry pattern.",
    evidenceQuotes: [
      {
        call_id: "demo_loss_deal_013_call_01",
        speaker: "Anke Lorenz",
        quote:
          "[Anke Lorenz|decision_maker|Rechtsabteilung fordert Patientendaten-Pruefung] Unsere Rechtsabteilung sagt, dass wir ohne zusätzliche Prüfung der Patientendaten-Anbindung nicht live gehen dürfen.",
        pattern_matched: "rechtsabteilung|prüfung",
      },
      {
        call_id: "demo_loss_deal_013_call_02",
        speaker: "Markus Klein",
        quote:
          "[Markus Klein|champion|Compliance-Aufwand kippt Business Case] Der Compliance-Aufwand ist für uns gerade größer als der erwartete Nutzen im ersten Halbjahr.",
        pattern_matched: "compliance",
      },
    ],
  },
  {
    mockDealId: "deal_014",
    primaryReason: "pricing",
    secondaryReasons: ["budget", "no_decision"],
    confidence: 0.79,
    extractedDaysAgo: 30,
    notes: "Demo seed: pricing loss supports budget-friction early warnings.",
    evidenceQuotes: [
      {
        call_id: "demo_loss_deal_014_call_01",
        speaker: "Tobias Winter",
        quote:
          "[Tobias Winter|decision_maker|Preis liegt ueber Mittelstandsbudget] Preislich ist Findr für uns aktuell zu hoch. Wir müssten dafür ein anderes Tool streichen, und das bekomme ich nicht genehmigt.",
        pattern_matched: "preislich|zu\\s+hoch",
      },
      {
        call_id: "demo_loss_deal_014_call_02",
        speaker: "Miriam Schulz",
        quote:
          "[Miriam Schulz|buyer|Rabatt reicht nicht fuer CFO-Freigabe] Selbst mit Rabatt sagt der CFO, dass das Budget für dieses Jahr nicht reicht.",
        pattern_matched: "rabatt|budget",
      },
    ],
  },
  {
    mockDealId: "deal_015",
    primaryReason: "competitor",
    secondaryReasons: ["pricing", "feature_gap"],
    confidence: 0.86,
    extractedDaysAgo: 42,
    notes: "Demo seed: competitor loss provides a secondary pattern.",
    evidenceQuotes: [
      {
        call_id: "demo_loss_deal_015_call_01",
        speaker: "Laura Petersen",
        quote:
          "[Laura Petersen|champion|Salesforce gewinnt wegen Bundle-Preis] Wir haben uns am Ende für Salesforce entschieden, weil der Bundle-Preis mit dem bestehenden CRM intern leichter zu verkaufen war.",
        pattern_matched: "entschieden|salesforce",
      },
      {
        call_id: "demo_loss_deal_015_call_02",
        speaker: "Kai Mertens",
        quote:
          "[Kai Mertens|decision_maker|Konkurrent deckt Einkaufskriterien ausreichend ab] Findr ist fachlich stärker, aber Salesforce erfüllt genug Kriterien und Procurement bevorzugt ein bestehendes Vendor-Setup.",
        pattern_matched: "salesforce|konkurrent",
      },
    ],
  },
];

export const DEMO_RISK_SCORES: DemoRiskScore[] = [
  {
    mockDealId: "deal_001",
    riskScore: 72,
    riskLevel: "high",
    overallReasoning:
      "Nordbank is materially at risk: the buyer has stalled for two weeks, the CFO joined late with security concerns, and competitor pressure is active in the account.",
    recommendations: [
      "Schedule a 30-minute CFO security review with a concrete decision checklist.",
      "Send a mutual action plan with owners and dates for legal, security, and procurement.",
      "Arm Sarah with a short Salesforce/Hubspot comparison focused on DACH data residency.",
    ],
    signals: [
      {
        type: "STALLING_PATTERN",
        confidence: 0.86,
        reasoning:
          "The buyer repeatedly pushes the decision back without a concrete next step.",
        quotes: [
          "[Anna Keller|champion|Kein konkreter Owner oder Termin für den nächsten Schritt] Wir müssen das nochmal intern besprechen. Ich will nichts versprechen, wir melden uns dann wieder.",
        ],
      },
      {
        type: "LATE_DECISION_MAKER",
        confidence: 0.78,
        reasoning:
          "The CFO entered after the commercial process was already in negotiation.",
        quotes: [
          "[Thomas Becker|decision_maker|Neue Compliance-Anforderung spät im Prozess eingebracht] Ehrlich gesagt, unser CFO hat da nochmal Fragen zur Datensicherheit. Das müssen wir intern klären bevor wir weitermachen.",
        ],
      },
      {
        type: "COMPETITOR_PRESSURE",
        confidence: 0.73,
        reasoning:
          "Salesforce and Hubspot are being evaluated as active alternatives.",
        quotes: [
          "[Anna Keller|champion|Konkurrenz wird als kommerzieller Benchmark genutzt] Salesforce ist preislich ziemlich aggressiv reingegangen, und Hubspot kennen wir aus einem anderen Team schon.",
        ],
      },
    ],
  },
  {
    mockDealId: "deal_002",
    riskScore: 25,
    riskLevel: "low",
    overallReasoning:
      "TechCorp is healthy: the champion is active, procurement is aligned, and the verbal commit has clear next steps.",
    recommendations: [
      "Keep the closing plan moving with procurement and confirm signature date.",
      "Ask the champion for one internal reference quote after renewal.",
    ],
    signals: [],
  },
  {
    mockDealId: "deal_003",
    riskScore: 84,
    riskLevel: "critical",
    overallReasoning:
      "Bayrische Versicherung is in critical territory: procurement has gone quiet, three competitors are in play, and the budget owner is pushing for a lower quarterly spend.",
    recommendations: [
      "Run an executive rescue call with procurement, finance, and the business sponsor.",
      "Reframe pricing around risk reduction and implementation timeline, not feature comparison.",
      "Create a deadline-backed decision plan before the May close date slips.",
    ],
    signals: [
      {
        type: "BUDGET_FRICTION",
        confidence: 0.9,
        reasoning:
          "Procurement explicitly says the current quarter budget is below the proposal.",
        quotes: [
          "[Martina Schmid|buyer|Budget-Freigabe ist nicht für dieses Quartal gesichert] Für dieses Quartal ist das Budget eigentlich schon verplant. Wenn wir das machen, müssten wir an anderer Stelle kürzen.",
        ],
      },
      {
        type: "COMPETITOR_PRESSURE",
        confidence: 0.88,
        reasoning:
          "The buyer is comparing Salesforce, Microsoft Dynamics, and SAP as alternatives.",
        quotes: [
          "[Jens Richter|decision_maker|Mehrere Alternativen liegen in der finalen Auswahl] SAP und Microsoft liegen uns auch vor. Beide sind im Paket günstiger, auch wenn sie fachlich nicht ganz so tief gehen.",
        ],
      },
      {
        type: "ENGAGEMENT_DROP",
        confidence: 0.8,
        reasoning:
          "The account has not responded for more than three weeks near the close date.",
        quotes: [
          "[Martina Schmid|champion|Champion bestätigt nachlassende interne Aktivität] Sorry, ich war die letzten Wochen nicht dazu gekommen, das intern wirklich zu treiben. Es ist gerade sehr viel parallel.",
        ],
      },
    ],
  },
  {
    mockDealId: "deal_004",
    riskScore: 52,
    riskLevel: "medium",
    overallReasoning:
      "CloudCommerce is mostly constructive, but one competitor is still being benchmarked and the buyer wants a stronger ROI case before final approval.",
    recommendations: [
      "Send a one-page ROI model tied to churn reduction and manager productivity.",
      "Keep the COO and finance stakeholder in the same next-step thread.",
    ],
    signals: [
      {
        type: "COMPETITOR_PRESSURE",
        confidence: 0.68,
        reasoning:
          "Hubspot remains a comparison point, though the buyer prefers Findr's depth.",
        quotes: [
          "[Florian Neumann|buyer|Hubspot ist noch im Vergleich, aber nicht klar führend] Hubspot hat uns auch was gezeigt. Ihr seid da tiefer, aber ich muss den Unterschied noch sauber erklären können.",
        ],
      },
    ],
  },
  {
    mockDealId: "deal_005",
    riskScore: 58,
    riskLevel: "medium",
    overallReasoning:
      "Helven has early buying intent, but the account is thinly threaded and the VP Sales still needs to convince her manager.",
    recommendations: [
      "Bring the manager into the next demo and align on decision criteria.",
      "Ask Petra to name the technical and commercial blockers before proposal.",
    ],
    signals: [
      {
        type: "LATE_DECISION_MAKER",
        confidence: 0.72,
        reasoning:
          "A manager with approval influence is only being introduced after discovery.",
        quotes: [
          "[Petra Vogel|champion|Approver wird erst nach Discovery in den Prozess geholt] Ich muss meinen Vorgesetzten noch überzeugen. Der ist beim nächsten Termin dabei und wird wahrscheinlich ziemlich kritisch fragen.",
        ],
      },
      {
        type: "COMPETITOR_PRESSURE",
        confidence: 0.67,
        reasoning:
          "Gong and Chorus are active reference points in the evaluation.",
        quotes: [
          "[Petra Vogel|champion|Gong und Chorus werden als fachliche Alternativen geprüft] Wir vergleichen gerade auch Gong und Chorus für Conversation Intelligence. Da geht es vor allem um Reporting und Coaching-Workflows.",
        ],
      },
    ],
  },
  {
    mockDealId: "deal_006",
    riskScore: 18,
    riskLevel: "low",
    overallReasoning:
      "Lattix is a clean late-stage deal with strong champion engagement, clear technical fit, and immediate contracting intent.",
    recommendations: [
      "Keep legal turnaround tight and confirm implementation kickoff date.",
    ],
    signals: [],
  },
  {
    mockDealId: "deal_007",
    riskScore: 91,
    riskLevel: "critical",
    overallReasoning:
      "DACH Logistics needs immediate intervention: the champion changed, multiple competitors are in the room, and the CEO is re-opening the business case late.",
    recommendations: [
      "Move Sarah's manager or founder into an executive alignment call this week.",
      "Rebuild the business case with CEO-level metrics and document the cost of delay.",
      "Map every stakeholder and identify a second champion outside the CEO path.",
    ],
    signals: [
      {
        type: "CHAMPION_LOSS",
        confidence: 0.92,
        reasoning:
          "The original champion is no longer driving the buying process.",
        quotes: [
          "[Miriam Hartmann|buyer|Originaler Champion ist nicht mehr im Projekt aktiv] Lukas ist nicht mehr im Projekt, ich übernehme das erstmal kommissarisch. Ich kenne aber nicht alle Details aus den letzten Gesprächen.",
        ],
      },
      {
        type: "STAKEHOLDER_CHURN",
        confidence: 0.86,
        reasoning:
          "Ownership of the project shifted during negotiation, forcing re-discovery.",
        quotes: [
          "[Miriam Hartmann|buyer_team|Neuer Stakeholder muss Deal-Historie neu aufarbeiten] Der neue Verantwortliche muss sich erst in die Historie einarbeiten. Wir sollten nicht davon ausgehen, dass er die Entscheidung so mitträgt.",
        ],
      },
      {
        type: "COMPETITOR_PRESSURE",
        confidence: 0.88,
        reasoning:
          "Four CRM vendors are active in the final evaluation.",
        quotes: [
          "[Karsten Lehmann|decision_maker|Finale Auswahl ist breit und kommerziell offen] Wir haben Angebote von Salesforce, Pipedrive, Zoho und Microsoft auf dem Tisch. Ich will das nochmal nebeneinander sehen.",
        ],
      },
      {
        type: "STALLING_PATTERN",
        confidence: 0.82,
        reasoning:
          "The buyer is delaying signature until leadership re-validates the initiative.",
        quotes: [
          "[Karsten Lehmann|decision_maker|Unterschrift wird bis zur neuen Geschäftsleitung blockiert] Vor der neuen Geschäftsleitung unterschreiben wir hier nichts. Die wollen erst verstehen, warum das jetzt Priorität hat.",
        ],
      },
    ],
  },
  {
    mockDealId: "deal_008",
    riskScore: 46,
    riskLevel: "medium",
    overallReasoning:
      "RootSignal has a moderate risk profile: the proposal is live, but engagement slowed and the buyer is still comparing Hubspot.",
    recommendations: [
      "Send a crisp proposal recap with explicit owner/date for the next decision.",
      "Ask whether Hubspot is a budget anchor or a functional alternative.",
    ],
    signals: [
      {
        type: "ENGAGEMENT_DROP",
        confidence: 0.7,
        reasoning:
          "Response cadence slowed after proposal, though the buyer remains engaged.",
        quotes: [
          "[Nadine Krüger|champion|Antwortkadenz fällt nach Proposal sichtbar ab] Sorry für die Funkstille, bei uns war die Woche komplett voll. Ich habe es noch nicht geschafft, Feedback einzusammeln.",
        ],
      },
      {
        type: "CHAMPION_DISENGAGEMENT",
        confidence: 0.66,
        reasoning:
          "The champion is still responsive but is no longer actively driving internal momentum.",
        quotes: [
          "[Nadine Krüger|champion|Champion ist erreichbar, treibt aber intern nicht mehr aktiv] Ich habe es noch nicht geschafft, das intern weiterzutragen. Wenn ich ehrlich bin, fehlt mir gerade ein bisschen die Zeit dafür.",
        ],
      },
    ],
  },
  {
    mockDealId: "deal_009",
    riskScore: 64,
    riskLevel: "high",
    overallReasoning:
      "SaaSCo is a large high-value deal with good activity but clear competitor pressure and finance scrutiny before contract approval.",
    recommendations: [
      "Multi-thread finance and product leadership before final negotiation.",
      "Turn the comparison against Salesforce/Hubspot into a weighted decision matrix.",
      "Confirm whether budget is approved or still conditional on board review.",
    ],
    signals: [
      {
        type: "COMPETITOR_PRESSURE",
        confidence: 0.8,
        reasoning:
          "Salesforce and Hubspot are being used as late-stage commercial benchmarks.",
        quotes: [
          "[Oliver Brandt|buyer|Konkurrenz setzt spät im Prozess Preisanker] Salesforce gibt uns Enterprise-Rabatt, Hubspot wäre im Bundle günstiger. Das müssen wir intern schon begründen.",
        ],
      },
      {
        type: "BUDGET_FRICTION",
        confidence: 0.71,
        reasoning:
          "Finance is asking for a board-level justification before approval.",
        quotes: [
          "[Katrin Wolf|decision_maker|Finance verlangt Board-fähigen Business Case vor Freigabe] Finance braucht eine Board-taugliche ROI-Begründung vor Freigabe. Ohne die Zahlen wird das nicht durchgehen.",
        ],
      },
    ],
  },
  {
    mockDealId: "deal_010",
    riskScore: 29,
    riskLevel: "low",
    overallReasoning:
      "MunichSoft is early but healthy: the buyer has a clear use case, active technical sponsor, and no meaningful competitive or budget pressure.",
    recommendations: [
      "Keep the trial focused on one measurable sales-manager workflow.",
      "Invite the second stakeholder to the next demo to keep momentum.",
    ],
    signals: [],
  },
];

export function getDemoRiskSnapshot(
  mockDealId: string,
): RiskAnalysisResult | null {
  const snapshot = DEMO_RISK_SCORES.find(
    (score) => score.mockDealId === mockDealId,
  );

  if (!snapshot) return null;

  return {
    riskScore: snapshot.riskScore,
    riskLevel: snapshot.riskLevel,
    signals: snapshot.signals,
    overallReasoning: snapshot.overallReasoning,
    recommendations: snapshot.recommendations,
  };
}

function scoreToLevel(score: number): RiskLevel {
  if (score < 40) return "low";
  if (score < 60) return "medium";
  if (score < 80) return "high";
  return "critical";
}

function historicalScore(currentScore: number, index: number): number {
  const drift = index * 1.8;
  const wobble = ((index % 3) - 1) * 2.5;
  return Math.max(0, Math.min(100, Math.round(currentScore - drift + wobble)));
}

function daysAgoIso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * DAY_MS).toISOString();
}

function toDealInsert(orgId: string, deal: Deal): DealInsert {
  const lastActivityAt = daysAgoIso(deal.daysSinceLastActivity);

  return {
    org_id: orgId,
    external_id: deal.id,
    source: "mock",
    name: deal.name,
    amount: deal.amount,
    stage: deal.stage,
    owner_email: `${deal.ownerName.toLowerCase().replaceAll(" ", ".")}@findr.demo`,
    closed_at: deal.closeDate,
    raw_data: {
      demo_seed: true,
      mock_deal_id: deal.id,
      championName: deal.championName,
      championTitle: deal.championTitle,
      callsCompleted: deal.callsCompleted,
      emailsSent: deal.emailsSent,
      stakeholdersCount: deal.stakeholdersCount,
      competitorsMentioned: deal.competitorsMentioned,
      closeDate: deal.closeDate,
    } satisfies Json,
    company_name: deal.companyName,
    owner_name: deal.ownerName,
    last_activity_at: lastActivityAt,
    currency: deal.currency,
    data_source: "mock",
  };
}

async function insertCallsForDeal(
  supabase: SupabaseClient,
  orgId: string,
  deal: Deal,
  dbDealId: string,
) {
  const { data: existingCalls } = await supabase
    .from("calls")
    .select("id")
    .eq("org_id", orgId)
    .eq("deal_id", dbDealId)
    .eq("source", "mock")
    .limit(1);

  if (existingCalls && existingCalls.length > 0) return;

  const callCount = deal.riskLevel === "low" ? 2 : 3;
  const mockCalls = generateCallsForDeal(deal, callCount);

  for (const mockCall of mockCalls) {
    const { data: callRecord, error: callError } = await supabase
      .from("calls")
      .insert({
        org_id: orgId,
        deal_id: dbDealId,
        transcript: mockCall.transcript,
        transcript_summary: mockCall.transcript_summary,
        duration_seconds: mockCall.duration_seconds,
        recorded_at: mockCall.recorded_at,
        source: "mock",
        call_type: mockCall.call_type,
        participants: mockCall.speakers as unknown as Json,
      })
      .select()
      .single();

    if (callError || !callRecord) {
      throw new Error(
        `Failed to seed call for ${deal.name}: ${callError?.message ?? "missing row"}`,
      );
    }

    const speakerIds: string[] = [];
    for (const speaker of mockCall.speakers) {
      const { data: speakerRecord, error: speakerError } = await supabase
        .from("call_speakers")
        .insert({
          call_id: callRecord.id,
          name: speaker.name,
          role: speaker.role,
          organization: speaker.organization,
          speaker_type: speaker.speaker_type,
        })
        .select()
        .single();

      if (speakerError || !speakerRecord) {
        throw new Error(
          `Failed to seed speaker for ${deal.name}: ${speakerError?.message ?? "missing row"}`,
        );
      }

      speakerIds.push(speakerRecord.id);
    }

    const segmentsToInsert = mockCall.segments
      .map((segment) => {
        const speakerId = speakerIds[segment.speaker_index];
        if (!speakerId) return null;
        return {
          call_id: callRecord.id,
          speaker_id: speakerId,
          start_seconds: segment.start_seconds,
          end_seconds: segment.end_seconds,
          text: segment.text,
          signals: segment.signals,
        };
      })
      .filter((segment): segment is NonNullable<typeof segment> => Boolean(segment));

    const { error: segmentError } = await supabase
      .from("transcript_segments")
      .insert(segmentsToInsert);

    if (segmentError) {
      throw new Error(
        `Failed to seed transcript segments for ${deal.name}: ${segmentError.message}`,
      );
    }
  }
}

async function insertRiskHistory(
  supabase: SupabaseClient,
  orgId: string,
  dbDealId: string,
  score: DemoRiskScore,
) {
  const { data: existingScores } = await supabase
    .from("risk_scores")
    .select("id")
    .eq("org_id", orgId)
    .eq("deal_id", dbDealId)
    .limit(1);

  if (existingScores && existingScores.length > 0) return;

  const historicalRows = [14, 12, 10, 8, 6, 4, 2].map((daysAgo, index) => {
    const riskScore = historicalScore(score.riskScore, 7 - index);

    return {
      org_id: orgId,
      deal_id: dbDealId,
      risk_score: riskScore,
      risk_level: scoreToLevel(riskScore),
      overall_reasoning: `Historical snapshot from ${daysAgo} days ago. ${score.overallReasoning}`,
      recommendations: score.recommendations,
      signals: score.signals as unknown as Json,
      analyzed_at: daysAgoIso(daysAgo),
    };
  });

  const currentRow = {
    org_id: orgId,
    deal_id: dbDealId,
    risk_score: score.riskScore,
    risk_level: score.riskLevel,
    overall_reasoning: score.overallReasoning,
    recommendations: score.recommendations,
    signals: score.signals as unknown as Json,
    analyzed_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("risk_scores")
    .insert([...historicalRows, currentRow]);

  if (error) {
    throw new Error(
      `Failed to seed risk history for ${score.mockDealId}: ${error.message}`,
    );
  }
}

async function insertDemoLossReasons(
  supabase: SupabaseClient,
  orgId: string,
  idByMockDealId: Map<string, string>,
) {
  const rows = DEMO_LOSS_REASONS.map((reason): LossReasonInsert | null => {
    const dbDealId = idByMockDealId.get(reason.mockDealId);
    if (!dbDealId) return null;

    return {
      org_id: orgId,
      deal_id: dbDealId,
      primary_reason: reason.primaryReason,
      secondary_reasons: reason.secondaryReasons,
      confidence: reason.confidence,
      evidence_quotes: reason.evidenceQuotes as unknown as Json,
      extraction_method: "heuristic",
      extracted_at: daysAgoIso(reason.extractedDaysAgo),
      manually_corrected: false,
      notes: reason.notes,
    };
  }).filter((row): row is LossReasonInsert => Boolean(row));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("loss_reasons")
    .upsert(rows, { onConflict: "deal_id" });

  if (error) {
    throw new Error(`Failed to seed demo loss reasons: ${error.message}`);
  }
}

export async function seedDemoData(orgId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const idByMockDealId = new Map<string, string>();

  for (const deal of DEMO_DEALS) {
    const { data, error } = await supabase
      .from("deals")
      .upsert(toDealInsert(orgId, deal), {
        onConflict: "org_id,source,external_id",
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to seed deal ${deal.name}: ${error?.message ?? "missing row"}`,
      );
    }

    idByMockDealId.set(deal.id, data.id);
  }

  for (const deal of DEMO_DEALS) {
    const dbDealId = idByMockDealId.get(deal.id);
    if (!dbDealId) continue;
    await insertCallsForDeal(supabase, orgId, deal, dbDealId);
  }

  for (const score of DEMO_RISK_SCORES) {
    const dbDealId = idByMockDealId.get(score.mockDealId);
    if (!dbDealId) continue;
    await insertRiskHistory(supabase, orgId, dbDealId, score);
  }

  await insertDemoLossReasons(supabase, orgId, idByMockDealId);
}
