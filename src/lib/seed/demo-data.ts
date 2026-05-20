import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { MOCK_DEALS } from "@/lib/deals/mock-data";
import { generateCallsForDeal } from "@/lib/calls/mock-call-generator";
import type { Deal, RiskLevel } from "@/lib/deals/types";
import type { RiskAnalysisResult, RiskSignal } from "@/lib/schemas/risk";
import type { Database, Json } from "@/types/database";

type SupabaseClient = ReturnType<typeof createAdminSupabaseClient>;
type DealInsert = Database["public"]["Tables"]["deals"]["Insert"];

interface DemoRiskScore {
  mockDealId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  overallReasoning: string;
  recommendations: string[];
  signals: RiskSignal[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

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
        quotes: ["Wir müssen das nochmal intern besprechen, wir melden uns."],
      },
      {
        type: "LATE_DECISION_MAKER",
        confidence: 0.78,
        reasoning:
          "The CFO entered after the commercial process was already in negotiation.",
        quotes: ["Unser CFO hat noch ein paar Fragen zur Datensicherheit."],
      },
      {
        type: "COMPETITOR_PRESSURE",
        confidence: 0.73,
        reasoning:
          "Salesforce and Hubspot are being evaluated as active alternatives.",
        quotes: ["Salesforce ist preislich aggressiver, Hubspot kennen wir schon."],
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
        quotes: ["Für dieses Quartal ist das Budget eigentlich schon verplant."],
      },
      {
        type: "COMPETITOR_PRESSURE",
        confidence: 0.88,
        reasoning:
          "The buyer is comparing Salesforce, Microsoft Dynamics, and SAP as alternatives.",
        quotes: ["SAP und Microsoft liegen uns auch vor, beide sind günstiger im Paket."],
      },
      {
        type: "ENGAGEMENT_DROP",
        confidence: 0.8,
        reasoning:
          "The account has not responded for more than three weeks near the close date.",
        quotes: ["Ich war die letzten Wochen nicht dazu gekommen, das intern zu treiben."],
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
        quotes: ["Hubspot hat uns auch was gezeigt, aber ihr seid da tiefer."],
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
        quotes: ["Ich muss meinen Vorgesetzten überzeugen, der ist beim nächsten Termin dabei."],
      },
      {
        type: "COMPETITOR_PRESSURE",
        confidence: 0.67,
        reasoning:
          "Gong and Chorus are active reference points in the evaluation.",
        quotes: ["Wir vergleichen gerade auch Gong und Chorus für Conversation Intelligence."],
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
        quotes: ["Lukas ist nicht mehr im Projekt, ich übernehme das erstmal kommissarisch."],
      },
      {
        type: "STAKEHOLDER_CHURN",
        confidence: 0.86,
        reasoning:
          "Ownership of the project shifted during negotiation, forcing re-discovery.",
        quotes: ["Der neue Verantwortliche muss sich erst in die Historie einarbeiten."],
      },
      {
        type: "COMPETITOR_PRESSURE",
        confidence: 0.88,
        reasoning:
          "Four CRM vendors are active in the final evaluation.",
        quotes: ["Wir haben Angebote von Salesforce, Pipedrive, Zoho und Microsoft auf dem Tisch."],
      },
      {
        type: "STALLING_PATTERN",
        confidence: 0.82,
        reasoning:
          "The buyer is delaying signature until leadership re-validates the initiative.",
        quotes: ["Vor der neuen Geschäftsleitung unterschreiben wir hier nichts."],
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
        quotes: ["Sorry für die Funkstille, bei uns war die Woche komplett voll."],
      },
      {
        type: "CHAMPION_DISENGAGEMENT",
        confidence: 0.66,
        reasoning:
          "The champion is still responsive but is no longer actively driving internal momentum.",
        quotes: ["Ich habe es noch nicht geschafft, das intern weiterzutragen."],
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
        quotes: ["Salesforce gibt uns Enterprise-Rabatt, Hubspot wäre im Bundle günstiger."],
      },
      {
        type: "BUDGET_FRICTION",
        confidence: 0.71,
        reasoning:
          "Finance is asking for a board-level justification before approval.",
        quotes: ["Finance braucht eine Board-taugliche ROI-Begründung vor Freigabe."],
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

export async function seedDemoData(orgId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const idByMockDealId = new Map<string, string>();

  for (const deal of MOCK_DEALS) {
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

  for (const deal of MOCK_DEALS) {
    const dbDealId = idByMockDealId.get(deal.id);
    if (!dbDealId) continue;
    await insertCallsForDeal(supabase, orgId, deal, dbDealId);
  }

  for (const score of DEMO_RISK_SCORES) {
    const dbDealId = idByMockDealId.get(score.mockDealId);
    if (!dbDealId) continue;
    await insertRiskHistory(supabase, orgId, dbDealId, score);
  }
}
