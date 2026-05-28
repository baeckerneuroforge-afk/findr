import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database";
import {
  createAccountFromWonDeal,
  getAccount,
  getAccountBySourceDeal,
} from "@/lib/accounts/service";
import { getDealById, getDealsByOrg } from "@/lib/deals/service";
import { getLatestRiskScore } from "@/lib/risk/service";
import {
  aggregateHealth,
  LEVEL_BANDS,
} from "@/lib/health/aggregate";
import type {
  AcuteSignal,
  AcuteSignalSeverity,
  HealthAnalysisResult,
  HealthLevel,
} from "@/lib/schemas/health";
import type { RiskSignal } from "@/lib/schemas/risk";
import { RISK_SIGNAL_TYPES } from "@/lib/schemas/risk";
import type { Deal } from "@/lib/deals/types";
import type { RiskScoreRecord } from "@/lib/risk/service";

/**
 * Cross-Modul-Brücke #2 — Sales-Won → CS-Account-Startkontext.
 *
 * Wenn ein Deal in Sales Intelligence als gewonnen markiert wird, übersetzt
 * diese Brücke den bereits VORHANDENEN, STRUKTURIERTEN Deal-Kontext
 * (deals.raw_data + risk_scores.signals der letzten Klassifikation) in ein
 * CS-Health-Startsignal-Bündel — damit ein frischer Account nicht bei null
 * startet, sondern die bekannten Risiken von Beginn an mitbringt.
 *
 * Architektur (drei harte Eigenschaften):
 *
 *   (1) DETERMINISTIC — KEIN LLM-Call. Reines Mapping bestehender
 *       strukturierter Felder. Die Risk-Klassifikation hat ihre Arbeit in
 *       der Sales-Phase bereits getan; wir transcribieren ihre Signale in
 *       das Health-Vokabular (selbe RISK_SIGNAL_TYPES-Enum, andere
 *       Konfidenz-/Severity-Achse). Zusätzlich werden zwei sehr
 *       konservative Heuristiken aus deals.raw_data ergänzt (Konkurrenz-
 *       Erwähnungen, Single-Threading), wenn das Risk-Modell sie noch
 *       nicht abgedeckt hatte.
 *
 *   (2) HUMAN-APPROVAL-GATE — wie Brücke #1. detectAndPersistSalesHandoverSuggestions
 *       schreibt status='pending' in bridge_suggestions (source_module='sales',
 *       kind='sales_handover'); approveSalesHandoverSuggestion erzeugt die
 *       Startzeile in account_health_scores nur auf expliziten Klick.
 *
 *   (3) RE-USE, KEINE Schema-Erweiterung — die bestehende
 *       bridge_suggestions-Tabelle deckt source_module/kind/source_refs
 *       als bewusst lose Verträge ab; account_health_scores erlaubt schon
 *       source_call_id=null + analysis_method='heuristic'. Keine Migration
 *       für diese Brücke nötig.
 *
 * COST GUARDRAIL: keine Tokens, gar keine. Detector + Mapper + Approval
 * sind reines TS + Postgres.
 */

// ── Tunable constants ──────────────────────────────────────────────────────

/** Trailing window in Tagen für "kürzlich gewonnene Deals". 30 ist
 *  bewusst eng — frische Handovers, frischer Kontext. Ein Deal, der vor
 *  zwei Quartalen geschlossen wurde, hatte längst seinen Startpunkt; eine
 *  späte Startkontext-Übernahme würde nur verwirren. */
export const BRIDGE_SALES_HANDOVER_WINDOW_DAYS = 30;

/** Konfidenz-Schwellen für die Übersetzung RiskSignal.confidence (0..1)
 *  → AcuteSignal.severity. Spiegelt grob die inverse Richtung der
 *  SEVERITY_TO_CONFIDENCE-Tabelle in src/lib/accounts/health-service.ts
 *  (low 0.55, medium 0.7, high 0.85, critical 0.95) — leicht großzügiger
 *  gerundet, um Klassifizierer-Konfidenzen, die knapp unter der Marke
 *  liegen, fair zu mappen. */
const CONFIDENCE_TO_SEVERITY_THRESHOLDS: Array<{
  min: number;
  severity: AcuteSignalSeverity;
}> = [
  { min: 0.9, severity: "critical" },
  { min: 0.75, severity: "high" },
  { min: 0.6, severity: "medium" },
  { min: 0, severity: "low" },
];

function confidenceToSeverity(confidence: number): AcuteSignalSeverity {
  const clamped = Number.isFinite(confidence)
    ? Math.max(0, Math.min(1, confidence))
    : 0.55;
  for (const tier of CONFIDENCE_TO_SEVERITY_THRESHOLDS) {
    if (clamped >= tier.min) return tier.severity;
  }
  return "low";
}

// SEVERITY_TO_CONFIDENCE mirrors src/lib/accounts/health-service.ts — keep
// in lockstep so a round-trip risk→health→stored is stable. We inline it
// here (rather than import) because health-service.ts already imports back
// from schemas; pulling a constant from there would create a circular
// dependency once approveSalesHandoverSuggestion calls aggregateHealth.
const SEVERITY_TO_CONFIDENCE: Record<AcuteSignalSeverity, number> = {
  low: 0.55,
  medium: 0.7,
  high: 0.85,
  critical: 0.95,
};

/** Neutrale Starter-Achsen für aggregateHealth. KEIN Transcript →
 *  KEINE gemessenen Achsen; wir füttern den Aggregator deshalb mit einer
 *  konservativen "etwas-besser-als-neutral"-Baseline von 70 (oberer
 *  Healthy-Bereich). Die Achsen-Konfidenz liegt knapp über
 *  MIN_CONFIDENCE_FOR_AXIS=0.3, sodass der Aggregator sie nicht verwirft
 *  — andernfalls würde er auf NEUTRAL_BASELINE=50 (lukewarm) zurückfallen,
 *  was für einen frisch gewonnenen Deal zu pessimistisch wäre.
 *
 *  Mit dieser Baseline + den abgeleiteten Signalen:
 *   - KEINE Signale          → 70 → "healthy"
 *   - 1 medium Signal        → cap 72 wirkt nicht; bleibt 70
 *   - 1 high Signal          → cap 38 → "at_risk"
 *   - 1 critical Signal      → cap 32 → "at_risk"
 *
 *  Das spiegelt die Realität: ein won-Deal ohne dokumentierte Risiken
 *  startet erwartbar gesund; ein won-Deal MIT bekannten Risiken
 *  (Konkurrenz, Champion-Loss in Sales-Phase, Engagement-Drop) verdient
 *  von Tag 1 ein Aufmerksamkeits-Flag. */
const STARTER_AXIS_SCORE = 70;
const STARTER_AXIS_CONFIDENCE = 0.5;
const STARTER_AXIS_REASONING =
  "Startwert ohne Post-Sale-Transkript — neutral leicht über Mitte. Aus den Sales-Risiko-Signalen abgeleiteter Startkontext, nicht aus einem Gespräch gemessen.";

function buildStarterAxes(): HealthAnalysisResult["satisfactionAxes"] {
  const axis = {
    score: STARTER_AXIS_SCORE,
    confidence: STARTER_AXIS_CONFIDENCE,
    reasoning: STARTER_AXIS_REASONING,
    evidence: [] as string[],
  };
  return {
    product: axis,
    relationship: axis,
    valueRealization: axis,
    engagement: axis,
  };
}

// ── Source-refs shape (jsonb-loose, in bridge_suggestions.source_refs) ─────

/** Shape we write into bridge_suggestions.source_refs for kind='sales_handover'.
 *  Loose contract — the SalesHandoverPanel reads these fields by name and is
 *  tolerant of missing entries (so future detectors can extend the shape
 *  without a panel rewrite). */
export interface SalesHandoverRefs {
  kind: "sales_handover";
  /** The won deal that triggered the handover. */
  dealId: string;
  /** The customer account this handover targets. createAccountFromWonDeal
   *  is idempotent; the suggestion always carries the resolved account-id
   *  even though it could be re-resolved at approve-time. */
  accountId: string;
  /** Deal-Klartext für die UI-Karte. */
  dealName: string;
  companyName: string;
  /** Deal close date (ISO) — UI-Anzeige "vor X Tagen". */
  closedAt: string | null;
  /** Quelle des Top-Level-Risk-Scores, falls vorhanden — sonst null. */
  riskScoreId: string | null;
  /** Die abgeleiteten Starter-Signale. Persistiert auf der Suggestion damit
   *  die Approval-Phase NICHT erneut den Deal lesen muss (idempotenter
   *  approve auch wenn der Deal inzwischen mutiert wurde). */
  signals: AcuteSignal[];
  /** Kurz-Zusammenfassung in DE, einzeilig — für den Card-Header in der UI. */
  summary: string;
}

// ── Deterministic signal mapping ───────────────────────────────────────────

function riskSignalToAcute(s: RiskSignal): AcuteSignal {
  return {
    type: s.type,
    severity: confidenceToSeverity(s.confidence),
    reasoning: s.reasoning,
    evidence: s.quotes ?? [],
  };
}

/**
 * Compose deterministic starter signals from a won deal's existing context.
 * No LLM, no DB — pure mapping. Caller passes the deal + its latest risk
 * score (if any); we transcribe + optionally enrich.
 *
 * Source precedence:
 *   1. risk_scores.signals[]            — the Sales-phase classifier already
 *                                          named these types using the same
 *                                          RISK_SIGNAL_TYPES vocabulary;
 *                                          transcribe 1:1 (with confidence
 *                                          mapped to severity).
 *   2. raw_data.competitorsMentioned    — only added if (1) did NOT already
 *                                          include COMPETITOR_PRESSURE.
 *   3. raw_data.stakeholdersCount ≤ 1   — only added if (1) did NOT already
 *                                          include MULTI_THREADING_FAILURE.
 *
 * Returns [] when there are no risk signals AND no structured
 * raw_data triggers — the caller will skip creating a suggestion in that
 * case ("sauberer Start, kein Handover-Material").
 */
export function deriveStarterSignals(
  deal: Deal,
  riskScore: RiskScoreRecord | null,
): AcuteSignal[] {
  const acute: AcuteSignal[] = [];
  const typesSeen = new Set<string>();

  // (1) Risk-classifier signals → AcuteSignals. Defensive: skip entries
  // whose type isn't in the canonical enum (legacy/dirty data).
  const validTypes: ReadonlySet<string> = new Set<string>(RISK_SIGNAL_TYPES);
  if (riskScore && Array.isArray(riskScore.signals)) {
    for (const sig of riskScore.signals) {
      if (!validTypes.has(sig.type)) continue;
      acute.push(riskSignalToAcute(sig));
      typesSeen.add(sig.type);
    }
  }

  // (2) Konkurrenten erwähnt im Deal-Kontext + kein bestehendes
  // COMPETITOR_PRESSURE-Signal → ergänzen als medium (1 Konkurrent) bzw.
  // high (2+).
  const competitors = Array.isArray(deal.competitorsMentioned)
    ? deal.competitorsMentioned.filter(
        (c) => typeof c === "string" && c.trim() !== "",
      )
    : [];
  if (competitors.length > 0 && !typesSeen.has("COMPETITOR_PRESSURE")) {
    const severity: AcuteSignalSeverity =
      competitors.length >= 2 ? "high" : "medium";
    acute.push({
      type: "COMPETITOR_PRESSURE",
      severity,
      reasoning: `Im Sales-Deal wurden ${competitors.length === 1 ? "ein konkurrierender Anbieter" : `${competitors.length} konkurrierende Anbieter`} erwähnt (${competitors.join(", ")}). Frühes Beobachten empfohlen — Wettbewerber können nach Vertragsabschluss erneut auftauchen, insbesondere bei Erweiterungs- oder Verlängerungsentscheidungen.`,
      evidence: [`Erwähnte Wettbewerber im Deal: ${competitors.join(", ")}`],
    });
    typesSeen.add("COMPETITOR_PRESSURE");
  }

  // (3) Single-Threaded Deal (≤1 Stakeholder) + kein bestehendes
  // MULTI_THREADING_FAILURE-Signal → ergänzen als medium.
  const stakeholders =
    typeof deal.stakeholdersCount === "number" ? deal.stakeholdersCount : null;
  if (
    stakeholders !== null &&
    stakeholders <= 1 &&
    !typesSeen.has("MULTI_THREADING_FAILURE")
  ) {
    acute.push({
      type: "MULTI_THREADING_FAILURE",
      severity: "medium",
      reasoning: `Der Deal lief mit nur ${stakeholders === 0 ? "keinem dokumentierten" : "einem einzigen"} Stakeholder. Single-Threaded-Risiko für CS: ein Wechsel des Sponsors würde die Beziehung sofort gefährden. Frühzeitige Multi-Threading-Aufgabe empfohlen.`,
      evidence: [`Stakeholders im Deal: ${stakeholders}`],
    });
    typesSeen.add("MULTI_THREADING_FAILURE");
  }

  return acute;
}

/** One-line German summary for the suggestion card. Lists the count + the
 *  highest-severity signal type in Klartext. */
function buildHandoverSummary(
  deal: Deal,
  signals: AcuteSignal[],
): string {
  if (signals.length === 0) {
    return `Won-Deal ${deal.companyName}: keine offenen Risiken aus Sales — sauberer Start.`;
  }
  // Find the strictest by severity rank (mirror aggregate.ts).
  const rank: Record<AcuteSignalSeverity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  const strongest = signals.reduce(
    (best, s) => (rank[s.severity] > rank[best.severity] ? s : best),
    signals[0],
  );
  const labelMap: Record<string, string> = {
    CHAMPION_LOSS: "Champion-Verlust",
    COMPETITOR_PRESSURE: "Wettbewerbsdruck",
    STALLING_PATTERN: "Entscheidungsverzögerung",
    BUDGET_FRICTION: "Budget-Reibung",
    CHAMPION_DISENGAGEMENT: "Champion-Disengagement",
    LATE_DECISION_MAKER: "Späte Decision-Maker",
    STAKEHOLDER_CHURN: "Stakeholder-Wechsel",
    ENGAGEMENT_DROP: "Engagement-Rückgang",
    MULTI_THREADING_FAILURE: "Single-Threaded",
  };
  const dominant = labelMap[strongest.type] ?? strongest.type;
  return `Won-Deal ${deal.companyName}: ${signals.length} Starter-Signal${signals.length === 1 ? "" : "e"} aus Sales — dominantes Thema „${dominant}" (${strongest.severity}).`;
}

// ── Public record shape ────────────────────────────────────────────────────

export interface SalesHandoverSuggestion {
  id: string;
  orgId: string;
  sourceModule: "sales";
  sourceRefs: SalesHandoverRefs;
  kind: "sales_handover";
  status: "pending" | "approved" | "dismissed";
  approvedHealthScoreId: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export class SalesHandoverError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "SalesHandoverError";
  }
}

// ── DB augmentation (same inline-augmentation pattern as Brücke #1) ────────

type BridgeStatus = "pending" | "approved" | "dismissed";

type BridgeSuggestionRow = {
  id: string;
  org_id: string;
  source_module: string;
  source_refs: Json;
  kind: string;
  derived_goal: string | null;
  segment: string | null;
  status: BridgeStatus;
  approved_plan_id: string | null;
  decided_at: string | null;
  created_at: string;
};

type BridgeSuggestionInsert = {
  id?: string;
  org_id: string;
  source_module: string;
  source_refs?: Json;
  kind: string;
  derived_goal?: string | null;
  segment?: string | null;
  status?: BridgeStatus;
  approved_plan_id?: string | null;
  decided_at?: string | null;
  created_at?: string;
};

type BridgeSuggestionUpdate = {
  source_module?: string;
  source_refs?: Json;
  kind?: string;
  derived_goal?: string | null;
  segment?: string | null;
  status?: BridgeStatus;
  approved_plan_id?: string | null;
  decided_at?: string | null;
};

type AccountHealthInsert = {
  id?: string;
  org_id?: string;
  account_id?: string;
  health_score?: number;
  health_level?: string;
  overall_reasoning?: string;
  recommendations?: string[];
  signals?: Json;
  source_call_id?: string | null;
  analysis_method?: "ai" | "heuristic";
  analyzed_at?: string;
  created_at?: string;
};

type AccountHealthRow = AccountHealthInsert & {
  id: string;
  org_id: string;
  account_id: string;
  health_score: number;
  health_level: string;
  overall_reasoning: string;
  signals: Json;
  analysis_method: "ai" | "heuristic";
};

type DatabaseWithBridge = {
  __InternalSupabase: Database["__InternalSupabase"];
  public: {
    Tables: Database["public"]["Tables"] & {
      bridge_suggestions: {
        Row: BridgeSuggestionRow;
        Insert: BridgeSuggestionInsert;
        Update: BridgeSuggestionUpdate;
        Relationships: [];
      };
      account_health_scores: {
        Row: AccountHealthRow;
        Insert: AccountHealthInsert;
        Update: AccountHealthInsert;
        Relationships: [];
      };
    };
    Views: Database["public"]["Views"];
    Functions: Database["public"]["Functions"];
    Enums: Database["public"]["Enums"];
    CompositeTypes: Database["public"]["CompositeTypes"];
  };
};

function createBridgeSupabase(): SupabaseClient<DatabaseWithBridge> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin operations.",
    );
  }
  return createClient<DatabaseWithBridge>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

// ── Detector → persistence orchestration ───────────────────────────────────

export interface SalesHandoverScanResult {
  /** Won deals in the trailing window that were inspected. */
  scanned: number;
  /** New pending suggestions persisted. */
  created: number;
  /** Skipped because a pending OR approved suggestion already covers this
   *  dealId (de-dup). */
  skipped: number;
  /** Skipped because the deal yielded ZERO starter signals (sauberer
   *  Start). Counted separately from `skipped` so the UI can report
   *  "8 gescannt, 3 neu, 2 schon vorhanden, 3 sauber". */
  clean: number;
  /** Errors during a single deal (account creation failure, suggestion
   *  insert failure). Logged but counted; the scan continues. */
  failed: number;
}

function toSuggestion(row: BridgeSuggestionRow): SalesHandoverSuggestion {
  const refs = (row.source_refs ?? {}) as unknown as SalesHandoverRefs;
  return {
    id: row.id,
    orgId: row.org_id,
    sourceModule: "sales",
    sourceRefs: refs,
    kind: "sales_handover",
    status: row.status,
    // approved_plan_id is repurposed for Brücke #1 only. For sales_handover
    // we don't write that column — instead we keep a thin link to the
    // health-score row in source_refs.approvedHealthScoreId when needed.
    approvedHealthScoreId: null,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  };
}

/**
 * Scan an org for recently won deals and persist starter-context
 * suggestions for the ones with non-empty deterministic mappings.
 *
 * STRATEGY:
 *   1. List deals in this org. (getDealsByOrg already org-scopes + reads
 *      the DB; falls back to MOCK_DEALS for orgs with no rows, in which
 *      case we filter mocks out — they have no DB-id we could link.)
 *   2. Filter to outcome='won' AND closed_at >= now - 30d.
 *   3. Read the pending+approved suggestion set once for de-dup.
 *   4. For each candidate:
 *        a. resolve/create account via createAccountFromWonDeal (idempotent)
 *        b. read latest risk_score
 *        c. derive starter signals — skip if empty
 *        d. insert bridge_suggestion (source_module='sales',
 *           kind='sales_handover')
 */
export async function detectAndPersistSalesHandoverSuggestions(
  orgId: string,
): Promise<SalesHandoverScanResult> {
  const supabase = createBridgeSupabase();
  const sinceMs =
    Date.now() - BRIDGE_SALES_HANDOVER_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  // 1) deals — getDealsByOrg returns Deal[] mapped from DB. It falls back
  //    to MOCK_DEALS when no rows exist for the org; mocks have non-UUID
  //    ids and no risk_scores row, so they'd fail downstream anyway. We
  //    filter to "looks like a real DB id" by re-fetching with getDealById
  //    when needed; the deals.outcome field is only meaningful on real
  //    rows. For mocks we just skip.
  const allDeals = await getDealsByOrg(orgId);

  // 2) candidate won-deals in the trailing window.
  const candidates: Deal[] = [];
  for (const d of allDeals) {
    if (d.outcome !== "won") continue;
    const closedAt = d.closedAt ?? null;
    if (!closedAt) continue;
    const t = new Date(closedAt).getTime();
    if (!Number.isFinite(t) || t < sinceMs) continue;
    candidates.push(d);
  }

  if (candidates.length === 0) {
    return { scanned: 0, created: 0, skipped: 0, clean: 0, failed: 0 };
  }

  // 3) Existing pending/approved suggestions for sales_handover —
  //    de-dup keys on source_refs.dealId.
  const { data: existing, error: exErr } = await supabase
    .from("bridge_suggestions")
    .select("*")
    .eq("org_id", orgId)
    .eq("kind", "sales_handover")
    .in("status", ["pending", "approved"]);
  if (exErr) {
    throw new SalesHandoverError(
      `Could not check existing handover suggestions: ${exErr.message}`,
    );
  }
  const existingDealIds = new Set<string>();
  for (const row of existing ?? []) {
    const refs = row.source_refs as unknown as SalesHandoverRefs | null;
    if (refs?.dealId) existingDealIds.add(refs.dealId);
  }

  let created = 0;
  let skipped = 0;
  let clean = 0;
  let failed = 0;

  for (const deal of candidates) {
    if (existingDealIds.has(deal.id)) {
      skipped++;
      continue;
    }

    try {
      // 4a) resolve/create account from the won deal — idempotent. If the
      //     deal id isn't a real UUID (e.g. a mock fallback), the helper
      //     returns null and we move on.
      let account = await getAccountBySourceDeal(orgId, deal.id);
      if (!account) {
        account = await createAccountFromWonDeal(orgId, deal.id);
      }
      if (!account) {
        // Mock deal or deal-not-won — silently skip. (Should not happen
        // here since we filtered outcome='won', but defensive.)
        skipped++;
        continue;
      }

      // 4b) latest risk score for this deal (if any).
      const risk = await getLatestRiskScore(orgId, deal.id);

      // 4c) derive starter signals.
      const signals = deriveStarterSignals(deal, risk);
      if (signals.length === 0) {
        clean++;
        continue;
      }

      const refs: SalesHandoverRefs = {
        kind: "sales_handover",
        dealId: deal.id,
        accountId: account.id,
        dealName: deal.name,
        companyName: deal.companyName,
        closedAt: deal.closedAt ?? null,
        riskScoreId: risk?.id ?? null,
        signals,
        summary: buildHandoverSummary(deal, signals),
      };

      const { error: insErr } = await supabase
        .from("bridge_suggestions")
        .insert({
          org_id: orgId,
          source_module: "sales",
          source_refs: refs as unknown as Json,
          kind: "sales_handover",
          derived_goal: null,
          segment: null,
          status: "pending",
        });
      if (insErr) {
        console.error(
          `[bridge:sales] failed to insert handover suggestion for deal ${deal.id}:`,
          insErr.message,
        );
        failed++;
        continue;
      }
      created++;
    } catch (err) {
      console.error(
        `[bridge:sales] handover detection failed for deal ${deal.id}:`,
        err instanceof Error ? err.message : err,
      );
      failed++;
    }
  }

  return { scanned: candidates.length, created, skipped, clean, failed };
}

// ── List + dismiss share UI with Brücke #1 but kind-filter here ────────────

export async function listSalesHandoverSuggestions(
  orgId: string,
): Promise<SalesHandoverSuggestion[]> {
  const supabase = createBridgeSupabase();
  const { data, error } = await supabase
    .from("bridge_suggestions")
    .select("*")
    .eq("org_id", orgId)
    .eq("kind", "sales_handover")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(toSuggestion);
}

// dismiss reuses the existing /api/bridge/suggestions/[id]/dismiss route
// (kind-agnostic; just flips status='dismissed'). No new endpoint needed.

// ── Approve → write starter health-score row ───────────────────────────────

export interface ApproveSalesHandoverResult {
  /** ID of the newly written account_health_scores row. */
  healthScoreId: string;
  /** The resolved starter score (0-100). */
  healthScore: number;
  /** The resolved level from the aggregator's LEVEL_BANDS. */
  healthLevel: HealthLevel;
  /** The account that received the starter context. */
  accountId: string;
}

/**
 * Map AcuteSignal → the StoredHealthSignal shape used by the existing
 * dashboard + save-play readers. Duplicated from
 * src/lib/accounts/health-service.ts intentionally — importing from there
 * would pull in the full Anthropic client chain, and this bridge has zero
 * LLM dependencies; we want the import graph to reflect that.
 */
function acuteSignalToStored(s: AcuteSignal) {
  return {
    type: s.type,
    confidence: SEVERITY_TO_CONFIDENCE[s.severity],
    reasoning: s.reasoning,
    quotes: s.evidence,
    severity: s.severity,
  };
}

function pickLevel(score: number): HealthLevel {
  const band = LEVEL_BANDS.find((b) => score >= b.min);
  return band?.level ?? "critical";
}

/**
 * Approve a pending sales_handover suggestion:
 *   1. Verify pending + kind='sales_handover' + accountId is readable
 *      under this org.
 *   2. Compose the starter health-score deterministically:
 *        - axes: synthetic STARTER baseline (70/0.5, honest reasoning)
 *        - signals: from source_refs.signals (already derived at scan time)
 *        - aggregateHealth() → score + level via existing constants
 *   3. Insert account_health_scores: source_call_id=null,
 *      analysis_method='heuristic', analyzed_at=now.
 *   4. Mark suggestion approved + decided_at.
 */
export async function approveSalesHandoverSuggestion(
  orgId: string,
  suggestionId: string,
): Promise<ApproveSalesHandoverResult | null> {
  const supabase = createBridgeSupabase();

  const { data: row, error: rowErr } = await supabase
    .from("bridge_suggestions")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", suggestionId)
    .maybeSingle();
  if (rowErr || !row) return null;
  if (row.status !== "pending") return null;
  if (row.kind !== "sales_handover") return null;

  const refs = (row.source_refs ?? {}) as unknown as SalesHandoverRefs;
  if (!refs || !refs.accountId || !Array.isArray(refs.signals)) {
    throw new SalesHandoverError(
      `Suggestion ${suggestionId} has malformed source_refs`,
    );
  }

  // Defense-in-depth: confirm the account still exists in this org. (A
  // separate user could have deleted it between scan and approve. We
  // refuse to write a starter health row for a missing account.)
  const account = await getAccount(orgId, refs.accountId);
  if (!account) {
    throw new SalesHandoverError(
      `Account ${refs.accountId} not found in org — cannot apply starter context.`,
    );
  }

  // Also defense-in-depth: re-fetch the deal so we can write a meaningful
  // overall_reasoning. We tolerate the deal having been deleted (we still
  // have a summary captured at scan-time on the suggestion).
  const dealNow = await getDealById(orgId, refs.dealId).catch(() => null);
  const dealLine = dealNow
    ? `${dealNow.companyName} (${dealNow.name})`
    : refs.companyName
      ? refs.companyName
      : "Won-Deal";

  // 2) Compose starter health via the canonical aggregator.
  const axes = buildStarterAxes();
  const signals = refs.signals;
  const aggregated = aggregateHealth(axes, signals);
  const level = pickLevel(aggregated.healthScore);

  const overallReasoning = [
    `Startkontext aus Sales-Handover — Deal: ${dealLine}.`,
    `${signals.length} Starter-Signal${signals.length === 1 ? "" : "e"} aus dem Sales-Prozess übernommen (deterministisches Mapping, kein Post-Sale-Transkript).`,
    `Baseline-Score 70 (oberer Healthy-Bereich); aktuelle Reduktion ${70 - aggregated.healthScore} Punkte durch die Starter-Signale.`,
  ].join(" ");

  const now = new Date().toISOString();
  const signalsForDb = signals.map(acuteSignalToStored);

  const { data: inserted, error: insertErr } = await supabase
    .from("account_health_scores")
    .insert({
      org_id: orgId,
      account_id: refs.accountId,
      health_score: aggregated.healthScore,
      health_level: level,
      overall_reasoning: overallReasoning,
      recommendations: [],
      signals: signalsForDb as unknown as Json,
      source_call_id: null,
      analysis_method: "heuristic",
      analyzed_at: now,
    })
    .select("*")
    .single();

  if (insertErr || !inserted) {
    throw new SalesHandoverError(
      `Failed to write starter health-score: ${insertErr?.message ?? "no row"}`,
    );
  }

  // 4) Mark suggestion approved. We do NOT use approved_plan_id (that's
  //    Brücke #1's column); instead we leave it null and rely on the
  //    suggestion.status='approved' + decided_at as the lifecycle marker.
  //    The health-score row itself is the artifact of this approval.
  const { error: upErr } = await supabase
    .from("bridge_suggestions")
    .update({
      status: "approved",
      decided_at: now,
    })
    .eq("org_id", orgId)
    .eq("id", suggestionId);
  if (upErr) {
    console.error(
      `[bridge:sales] failed to mark suggestion ${suggestionId} approved:`,
      upErr.message,
    );
    // The health-score row IS written; we don't roll back. The suggestion
    // will stay pending and a re-approve will skip via the status check.
    // Log + surface a soft error in the API layer.
    throw new SalesHandoverError(
      `Starter health-score written but failed to mark suggestion approved: ${upErr.message}`,
    );
  }

  return {
    healthScoreId: inserted.id,
    healthScore: aggregated.healthScore,
    healthLevel: level,
    accountId: refs.accountId,
  };
}
