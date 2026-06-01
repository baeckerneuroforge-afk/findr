import "server-only";

import { getDealsByOrg } from "@/lib/deals/service";
import type { Deal } from "@/lib/deals/types";
import { RISK_SIGNAL_TYPES, type RiskSignal } from "@/lib/schemas/risk";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export interface RepCoachingProfile {
  repName: string;
  totalDeals: number;
  activeDeals: number;
  avgRiskScore: number;
  signalFrequency: Record<string, number>;
  topPattern: { type: string; frequency: number } | null;
  recommendations: string[];
  dealsAtRisk: number;
}

const COACHING_RECOMMENDATIONS: Record<string, string[]> = {
  STALLING_PATTERN: [
    "Discovery-Calls vertiefen: konkrete Decision-Timeline + Decision-Criteria im ersten Call klären",
    "Mutual Action Plans einführen: jeder Deal bekommt Roadmap mit Owner + Datum pro Schritt",
    "Bei 'lass mich das mit dem Team durchgehen' nachfragen: wer genau, bis wann, was zeigen Sie ihnen",
  ],
  CHAMPION_LOSS: [
    "Multi-Threading früher: ab Discovery 2+ Stakeholder einbeziehen, nicht nur Champion",
    "Champion-Health-Checks: alle 2 Wochen kurzes Update-Meeting mit Champion vereinbaren",
    "Backup-Champion identifizieren: zweite Person im Account die Findr inhaltlich versteht",
  ],
  COMPETITOR_PRESSURE: [
    "Discovery-Differenzierung: Findr-USPs (DACH-Fokus, Conversation-Intelligence-Tiefe) früher im Prozess platzieren",
    "Competitive-Battle-Cards nutzen: konkrete Pros/Cons vs Konkurrenz auf Abruf",
    "Wenn Konkurrent erwähnt wird: tieferes Discovery zum echten Pain - Konkurrent ist meist nicht das eigentliche Problem",
  ],
  BUDGET_FRICTION: [
    "ROI-Calculator früher einsetzen: bei Discovery konkrete Zahlen zu lost deals/Quartal sammeln",
    "Pricing-Conversations in Demo 2 ziehen statt erst in Negotiation",
    "Procurement-Stakeholder ab Demo einbeziehen, nicht erst am Ende",
  ],
  CHAMPION_DISENGAGEMENT: [
    "Engagement-Score tracken: response time, meeting attendance, internal-share-Aktivität",
    "Bei Disengagement-Signalen: explizit fragen 'was hat sich geändert seit unserem letzten Call?'",
    "Champion-Coaching: Champion mit Talking-Points für interne Vermarktung ausstatten",
  ],
  LATE_DECISION_MAKER: [
    "Decision-Maker-Mapping in Discovery: wer entscheidet final, wer beeinflusst, wer blockt",
    "Power-Sponsor-Strategie: Executive-Briefing-Call vor Closing einführen",
    "Bei Champion-only-Calls: 'wer sollte noch dabei sein wenn wir das diskutieren?'",
  ],
  STAKEHOLDER_CHURN: [
    "Stakeholder-Tracking: pro Account Liste wer involviert ist + Status pro Person",
    "Bei Personalwechsel: schnelle Re-Engagement-Sequence (24h Outreach an Nachfolger)",
    "Champion-Redundancy: niemals nur einen Stakeholder pro Account haben",
  ],
  ENGAGEMENT_DROP: [
    "Engagement-Baseline pro Deal: response time + meeting cadence in CRM tracken",
    "Bei Drop: explizite Re-Engagement-Sequence (3 Touchpoints in 5 Tagen, dann Pause)",
    "Pattern-Detection: bei welcher Stage tritt Engagement-Drop typisch auf",
  ],
  MULTI_THREADING_FAILURE: [
    "Multi-Threading ab Discovery: mindestens 3 Stakeholder-Rollen identifizieren (Economic Buyer, Champion, User)",
    "Stakeholder-Map pro Deal pflegen: sichtbar machen wer kontaktiert ist, wer fehlt, wer Gegenwind gibt",
    "Single-Threaded-Risiko früh ansprechen: wenn nach der Demo nur eine Person spricht, gezielt Intro zu weiteren Beteiligten erbitten",
  ],
};

/** Display name for deals without an owner (incl. empty/whitespace-only). */
const UNASSIGNED_REP = "Unassigned";

/**
 * Grouping key for a rep: case- and whitespace-insensitive so the same person
 * ("sarah mueller" vs "Sarah Mueller") collapses into one rep. Display names
 * keep their original spelling (see getRepCoachingProfiles).
 */
function normalizeRepKey(displayName: string): string {
  return displayName.toLowerCase().replace(/\s+/g, " ");
}

type RiskScoreRow = Pick<
  Database["public"]["Tables"]["risk_scores"]["Row"],
  "deal_id" | "risk_score" | "risk_level" | "signals" | "analyzed_at"
>;

interface RepAggregation {
  /** Readable original spelling (first occurrence), used for display. */
  displayName: string;
  deals: Deal[];
  scores: number[];
  activeCount: number;
  atRiskCount: number;
  signalCounts: Record<string, number>;
}

function isRiskSignalType(value: unknown): value is (typeof RISK_SIGNAL_TYPES)[number] {
  return (
    typeof value === "string" &&
    RISK_SIGNAL_TYPES.includes(value as (typeof RISK_SIGNAL_TYPES)[number])
  );
}

function parseSignals(signals: RiskScoreRow["signals"]): RiskSignal[] {
  if (!Array.isArray(signals)) return [];

  return signals.filter((signal): signal is RiskSignal => {
    if (!signal || typeof signal !== "object" || Array.isArray(signal)) {
      return false;
    }

    return isRiskSignalType(signal.type);
  });
}

function getTopPattern(
  signalCounts: Record<string, number>,
): { type: string; frequency: number } | null {
  let topPattern: { type: string; frequency: number } | null = null;

  for (const [type, count] of Object.entries(signalCounts)) {
    if (!topPattern || count > topPattern.frequency) {
      topPattern = { type, frequency: count };
    }
  }

  return topPattern;
}

export async function getRepCoachingProfiles(
  orgId: string,
): Promise<RepCoachingProfile[]> {
  const supabase = createAdminSupabaseClient();
  const deals = await getDealsByOrg(orgId);

  const { data: riskScores, error } = await supabase
    .from("risk_scores")
    .select("deal_id, risk_score, risk_level, signals, analyzed_at")
    .eq("org_id", orgId)
    .order("analyzed_at", { ascending: false });

  if (error || !riskScores) return [];

  const latestScorePerDeal = new Map<string, RiskScoreRow>();
  for (const row of riskScores) {
    if (!latestScorePerDeal.has(row.deal_id)) {
      latestScorePerDeal.set(row.deal_id, row);
    }
  }

  const repMap = new Map<string, RepAggregation>();

  for (const deal of deals) {
    // Display keeps the first original spelling; an empty/whitespace-only
    // owner is treated like an unassigned deal rather than its own rep.
    const trimmedName = (deal.ownerName ?? "").trim();
    const displayName = trimmedName.length > 0 ? trimmedName : UNASSIGNED_REP;
    const repKey = normalizeRepKey(displayName);

    let rep = repMap.get(repKey);
    if (!rep) {
      rep = {
        displayName,
        deals: [],
        scores: [],
        activeCount: 0,
        atRiskCount: 0,
        signalCounts: {},
      };
      repMap.set(repKey, rep);
    }

    rep.deals.push(deal);

    const isActive = !["closed_won", "closed_lost"].includes(deal.stage);
    if (isActive) rep.activeCount++;

    const latestScore = latestScorePerDeal.get(deal.id);
    if (!latestScore) continue;

    rep.scores.push(latestScore.risk_score);
    // "At risk" is an active-pipeline metric: closed deals (won/lost) never
    // count, even if their last score was >= 60.
    if (isActive && latestScore.risk_score >= 60) rep.atRiskCount++;

    for (const signal of parseSignals(latestScore.signals)) {
      rep.signalCounts[signal.type] = (rep.signalCounts[signal.type] ?? 0) + 1;
    }
  }

  const profiles: RepCoachingProfile[] = [];

  for (const data of repMap.values()) {
    const avgRiskScore =
      data.scores.length > 0
        ? Math.round(
            data.scores.reduce((sum, score) => sum + score, 0) /
              data.scores.length,
          )
        : 0;
    const topPattern = getTopPattern(data.signalCounts);
    const recommendations = topPattern
      ? COACHING_RECOMMENDATIONS[topPattern.type] ?? []
      : [];

    profiles.push({
      repName: data.displayName,
      totalDeals: data.deals.length,
      activeDeals: data.activeCount,
      avgRiskScore,
      signalFrequency: data.signalCounts,
      topPattern,
      recommendations,
      dealsAtRisk: data.atRiskCount,
    });
  }

  return profiles.sort((a, b) => {
    if (b.dealsAtRisk !== a.dealsAtRisk) return b.dealsAtRisk - a.dealsAtRisk;
    return b.avgRiskScore - a.avgRiskScore;
  });
}
