import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import type { Database, Json } from "@/types/database";
import {
  createResearchPlan,
  getResearchPlan,
} from "@/lib/research/plans-service";
import {
  generateInterviewGuide,
  GuideGeneratorUnavailableError,
} from "@/lib/research/guide-generator";
import { RISK_SIGNAL_TYPES } from "@/lib/schemas/risk";
import type { AcuteSignalSeverity } from "@/lib/schemas/health";

/**
 * Cross-Modul-Brücke #1 — CS Health-Churn-Muster → Research-Vorschlag.
 *
 * Architektur (zwei harte Trennlinien):
 *
 *   (1) DETECTOR — vollständig deterministisch, KEIN LLM-Call. Liest churned
 *       accounts in einem trailing window, holt für jeden den letzten
 *       account_health_scores-Row, extrahiert das höchstrangige Signal,
 *       gruppiert nach signalType und liefert Cluster ab Schwelle
 *       BRIDGE_CHURN_MIN_ACCOUNTS = 3.
 *
 *   (2) DERIVATION — einzige LLM-Surface (Opus default). Bekommt einen
 *       Cluster-Deskriptor (signalType, accountCount, segment, windowDays)
 *       und liefert EINE deutsche Research-Goal-Zeile oder eine ehrliche
 *       Absage ("derivable=false") bei mehrdeutigem Input. Pure-Input-
 *       Entry für die Eval; KEIN DB-Zugriff.
 *
 * Human-Approval-Gate ist Pflicht: detectAndPersistChurnSuggestions
 * schreibt status='pending'-Zeilen. Erst ein expliziter approve-Call durch
 * den Nutzer erzeugt einen research_plan + ruft generateInterviewGuide —
 * niemals automatisch.
 *
 * COST GUARDRAIL:
 *   - Detector: O(n) DB-Reads, keine Tokens.
 *   - Derivation: 1 Opus-Call PRO neuem Cluster. Der Detector überspringt
 *     Cluster, für die schon eine pending/approved Suggestion existiert
 *     (de-dup auf (org_id, kind, source_refs.signalType)), damit
 *     wiederholte Scans keine Duplikate generieren.
 *   - Approve: 1 weiterer Opus-Call (generateInterviewGuide), aber NUR
 *     wenn der User aktiv den Vorschlag annimmt.
 */

// ── Tunable constants ──────────────────────────────────────────────────────

/** Schwelle für "gemeinsamer Churn-Grund": ab wie vielen verlorenen
 *  Accounts mit demselben Signal-Typ ein Cluster gebildet wird. 3 ist
 *  bewusst konservativ — kleinere Schwellen erzeugen statistisch
 *  rauschende Vorschläge. */
export const BRIDGE_CHURN_MIN_ACCOUNTS = 3;

/** Trailing window in Tagen für "verlorene Accounts in den letzten X Tagen".
 *  90 deckt typische QBR-Zyklen ab; alte Churns interessieren operativ
 *  weniger. Filter wirkt gegen accounts.churned_at — den echten Churn-
 *  Zeitstempel (gesetzt per DB-Trigger beim Status-Übergang nach 'churned';
 *  siehe Migration 20260624000000_account_churned_at.sql). */
export const BRIDGE_CHURN_WINDOW_DAYS = 90;

export const DEFAULT_BRIDGE_MODEL = CLAUDE_MODELS.opus;

// ── Output schema for the LLM derivation ───────────────────────────────────

const DerivedGoalSchema = z.object({
  /** false wenn der Cluster zu mehrdeutig / zu dünn ist, um ehrlich ein
   *  Research-Goal zu rechtfertigen. Engine downgraded ein false NICHT auf
   *  Heuristik — das LLM ist die einzige Instanz, die hier ehrlich
   *  zurückhaltend sein darf. */
  derivable: z.boolean(),
  /** Deutsch, 8-400 Zeichen, MUSS den Cluster-Grund semantisch referenzieren
   *  (lexikalisch geprüft per Eval-Heuristik, nicht im Schema). Null wenn
   *  derivable=false. */
  goal: z.string().min(8).max(400).nullable(),
});

export type DerivedGoal = z.infer<typeof DerivedGoalSchema>;

// ── Public record shape ────────────────────────────────────────────────────

export interface BridgeSuggestion {
  id: string;
  orgId: string;
  sourceModule: string;
  sourceRefs: BridgeSourceRefs;
  kind: string;
  derivedGoal: string | null;
  segment: string | null;
  status: "pending" | "approved" | "dismissed";
  approvedPlanId: string | null;
  decidedAt: string | null;
  createdAt: string;
}

/** Shape we write into bridge_suggestions.source_refs for kind='churn_cluster'.
 *  Loose contract — future kinds extend this with their own shape; UI reads
 *  the fields that match its current renderer. */
export interface ChurnClusterRefs {
  kind: "churn_cluster";
  signalType: string;
  accountIds: string[];
  windowDays: number;
}

export type BridgeSourceRefs = ChurnClusterRefs | Record<string, unknown>;

// ── Error types ────────────────────────────────────────────────────────────

export class BridgeUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "BridgeUnavailableError";
  }
}

// ── German labels for the LLM (RISK_SIGNAL_TYPES → Klartext) ───────────────

/**
 * Mapping vom RISK_SIGNAL_TYPES-Enum auf den deutschen Klartext-Begriff.
 * Wird in den User-Prompt eingebaut, damit das LLM eine konsistente
 * Vokabel verwendet und der ankernde Begriff im Goal vorkommt (die
 * Eval-Heuristik prüft danach lexikalisch). Bei unbekannten signalType-
 * Werten (z.B. "MIXED" als Eval-Marker) wird der Originalstring durch-
 * gereicht — die Posture-Rules im System-Prompt fangen das ab.
 */
const SIGNAL_TYPE_GERMAN_LABEL: Record<string, string> = {
  CHAMPION_LOSS: "Verlust des internen Champions / Fürsprechers",
  COMPETITOR_PRESSURE: "Druck durch konkurrierende Anbieter",
  STALLING_PATTERN: "Entscheidungsverzögerung / Stalling",
  BUDGET_FRICTION: "Budget-Reibung / Kostendruck",
  CHAMPION_DISENGAGEMENT: "Champion-Disengagement (Rückzug des Fürsprechers)",
  LATE_DECISION_MAKER: "Spät auftauchender Decision-Maker",
  STAKEHOLDER_CHURN: "Wechsel relevanter Stakeholder",
  ENGAGEMENT_DROP: "Engagement-Rückgang / Kommunikationsabbruch",
  MULTI_THREADING_FAILURE: "Fehlende Multi-Threading-Beziehung",
};

function germanLabelFor(signalType: string): string {
  return SIGNAL_TYPE_GERMAN_LABEL[signalType] ?? signalType;
}

// ── System prompt ──────────────────────────────────────────────────────────

export const BRIDGE_DERIVATION_SYSTEM_PROMPT = `Du leitest aus einem CS-CHURN-CLUSTER eine einzige Research-Goal-Zeile auf DEUTSCH ab. Ziel: ein nachgelagerter Interview-Guide-Generator soll daraus einen sinnvollen Leitfaden formen.

POSTURE — Honest derivation, KEIN Inventory von Spezifika.
- Du arbeitest ausschließlich mit dem strukturierten Cluster-Input: dem Churn-Grund-Label (signalType, plus deutscher Klartext), der Anzahl betroffener Accounts, optional einem Segment-Hinweis und dem trailing window. NICHTS sonst.
- Erfinde KEINE Produkt-, Konkurrenten-, oder Preisinformationen, die nicht im Input stehen. Wenn der Input keinen Konkurrenten nennt, schreib auch keinen.
- Der Goal-Satz MUSS den Churn-Grund semantisch referenzieren — verwende den deutschen Klartext-Begriff (oder ein eng verwandtes Wort daraus) explizit.

EHRLICHE ABSAGE (derivable=false):
- Wenn der signalType "MIXED" / "UNCLEAR" / ein nicht-Enum-Wert ist oder der Input mehrdeutig macht, welcher Aspekt zu untersuchen wäre → "derivable": false, "goal": null.
- Wenn accountCount kleiner als 2 ist (extrem dünne Datenbasis) → "derivable": false, "goal": null.

DÜNN ABER NICHT MEHRDEUTIG (accountCount = 2):
- Liefere "derivable": true, aber formuliere den Goal-Satz erkennbar VORSICHTIG ("erste Hinweise auf …", "Eine explorative Mini-Studie zu …") und nenne die kleine Fallzahl im Satz, wenn das natürlich passt. Bleibe minimal — keine ausgedachten Spezifika.

KLARER CLUSTER (accountCount >= 3):
- Liefere "derivable": true und einen konkreten Goal-Satz auf Deutsch, 1–3 Sätze lang. Beispiel-Form: "Verstehen, warum X bei Kunden in [Segment] zu Kündigungen führt — auf Basis von N verlorenen Accounts." Ankere den Begriff aus dem Klartext-Label.

FORM (8–400 Zeichen für das goal-Feld):
- Auf Deutsch (Sie-Form nicht nötig — der Goal-Satz ist intern).
- KEINE Markdown-Listen, KEIN Vorlauf, KEINE Erklärungen außerhalb des JSON.

OUTPUT — return ONLY this JSON, no markdown, no preamble:

{
  "derivable": <bool>,
  "goal": <string|null>
}`;

// ── User-prompt builder ────────────────────────────────────────────────────

export interface DeriveInput {
  /** Either a RISK_SIGNAL_TYPES value or a marker like "MIXED"/"UNCLEAR"
   *  to test the refusal path. The system prompt instructs the LLM to
   *  refuse on non-enum markers. */
  signalType: string;
  /** Number of churned accounts in the cluster. */
  accountCount: number;
  /** Optional segment hint (e.g. "Enterprise" or "SMB SaaS"). When passed,
   *  the LLM may anchor the goal on this persona; when omitted, the goal
   *  stays segment-agnostic. */
  segment?: string | null;
  /** Trailing window in days the cluster was sampled from. Mainly for
   *  human readability in the goal phrasing ("in den letzten 90 Tagen"). */
  windowDays?: number;
  /** Optional free-text note (used in MIXED-cluster eval cases to describe
   *  which signal types were mixed). When present, the LLM treats this as
   *  the dominant signal that something is ambiguous. */
  signalNotes?: string | null;
}

function buildDeriveUserPrompt(input: DeriveInput): string {
  const label = germanLabelFor(input.signalType);
  const lines: string[] = [
    `CHURN-CLUSTER-INPUT`,
    `signalType:   ${input.signalType}`,
    `klartext:     ${label}`,
    `accountCount: ${input.accountCount}`,
  ];
  if (input.segment && input.segment.trim() !== "") {
    lines.push(`segment:      ${input.segment.trim()}`);
  }
  if (input.windowDays !== undefined) {
    lines.push(`windowDays:   ${input.windowDays}`);
  }
  if (input.signalNotes && input.signalNotes.trim() !== "") {
    lines.push(`signalNotes:  ${input.signalNotes.trim()}`);
  }
  lines.push(
    ``,
    `Liefere das Ergebnis als JSON-Objekt — keine Markdown-Blöcke, kein Vorlauf.`,
  );
  return lines.join("\n");
}

// ── Pure derivation entry (eval + production both call this) ──────────────

/**
 * Pure-input entry — no DB. Robust transport: forced tool-use via
 * callClaudeStructured (no text-JSON regex/parse). Used by:
 *   - the eval harness (deterministic property checks on fixed clusters)
 *   - detectAndPersistChurnSuggestions below (DB-driven; takes the detected
 *     cluster's signalType + accountCount and persists the result)
 * Fail-closed preserved (BridgeUnavailableError).
 */
export async function deriveResearchGoalFromCluster(
  input: DeriveInput,
  model: string = process.env.BRIDGE_MODEL ?? DEFAULT_BRIDGE_MODEL,
): Promise<DerivedGoal> {
  const userPrompt = buildDeriveUserPrompt(input);

  let data: DerivedGoal;
  try {
    data = await callClaudeStructured({
      schema: DerivedGoalSchema,
      system: BRIDGE_DERIVATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      model,
      maxTokens: 512,
      timeoutMs: 60_000,
      toolName: "emit_derived_goal",
      toolDescription:
        "Return the derived research goal — derivable plus a German goal sentence, or derivable=false with goal=null when the cluster is too ambiguous or thin.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      throw new BridgeUnavailableError(
        "Claude derivation returned invalid output twice",
        err,
      );
    }
    throw new BridgeUnavailableError("Claude derivation call failed", err);
  }

  // Defense-in-depth (UNCHANGED): the schema allows "derivable=true &&
  // goal=null" — a contradiction. Normalize either contradiction to an honest
  // refusal to keep persistence consistent.
  if (data.derivable && (data.goal === null || data.goal.trim() === "")) {
    return { derivable: false, goal: null };
  }
  if (!data.derivable && data.goal !== null) {
    return { derivable: false, goal: null };
  }
  return data;
}

// ── Database augmentation (bridge_suggestions + CS-Health reads) ───────────
//
// Same inline-augmentation pattern as src/lib/synthesis/engine.ts and
// src/lib/research/chat-with-data.ts — bridge_suggestions is the new table
// from 20260619000000_bridge_suggestions.sql; until src/types/database.ts
// is regenerated, declare its shape here so supabase-js narrows correctly.

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

// CS-Health reader shapes — narrow read-only views of the existing tables.
// Mirrors the slim-augmentation pattern (only the columns this module
// touches), exact match to the live schema in
// 20260603000000_accounts.sql + 20260604000000_account_health.sql +
// 20260624000000_account_churned_at.sql (churned_at).

type AccountRow = {
  id: string;
  org_id: string;
  company_name: string;
  status: "active" | "at_risk" | "churned";
  updated_at: string;
  /** Real moment of churn — DB-trigger-stamped on the transition into
   *  'churned' (null = never churned, or a legacy row not yet backfilled). */
  churned_at: string | null;
};

type AccountInsert = {
  id?: string;
  org_id?: string;
  company_name?: string;
  status?: "active" | "at_risk" | "churned";
  updated_at?: string;
  churned_at?: string | null;
};

type AccountHealthRow = {
  id: string;
  org_id: string;
  account_id: string;
  signals: Json;
  analyzed_at: string | null;
};

type AccountHealthInsert = {
  id?: string;
  org_id?: string;
  account_id?: string;
  signals?: Json;
  analyzed_at?: string | null;
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
      accounts: {
        Row: AccountRow;
        Insert: AccountInsert;
        Update: AccountInsert;
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

// ── Detector helpers ───────────────────────────────────────────────────────

const SEVERITY_RANK: Record<AcuteSignalSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Pull the highest-severity signal type from a stored signals array. The
 * array shape comes from src/lib/accounts/health-service.ts:
 * `StoredHealthSignal = { type, confidence, reasoning, quotes, severity }`.
 * Defense: tolerate missing severity (legacy rows) by treating undefined
 * as "low" so they sort to the bottom; tolerate missing type by skipping
 * the entry.
 */
function pickStrongestSignalType(signals: unknown): string | null {
  if (!Array.isArray(signals)) return null;
  let bestType: string | null = null;
  let bestRank = -1;
  for (const raw of signals) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const type = typeof s.type === "string" ? s.type : null;
    if (!type) continue;
    const sev =
      typeof s.severity === "string"
        ? (s.severity as AcuteSignalSeverity)
        : "low";
    const rank = SEVERITY_RANK[sev] ?? 1;
    if (rank > bestRank) {
      bestRank = rank;
      bestType = type;
    }
  }
  return bestType;
}

// ── Detector ───────────────────────────────────────────────────────────────

export interface ChurnCluster {
  signalType: string;
  accountIds: string[];
  windowDays: number;
}

/**
 * Pure detector — deterministic clustering of recently churned accounts by
 * dominant signal type. Returns ALL clusters above threshold; the caller
 * decides which ones to materialize as suggestions.
 *
 * STRATEGY:
 *   1. Find accounts in this org with status='churned' AND
 *      churned_at >= now() - BRIDGE_CHURN_WINDOW_DAYS.
 *   2. For each: fetch its LATEST account_health_scores row (most recent
 *      analyzed_at) and extract the highest-severity signal type from
 *      signals[]. Accounts with no scores OR scores with no signals are
 *      skipped — we can't classify their churn.
 *   3. Group by signalType. Clusters with accountIds.length >=
 *      BRIDGE_CHURN_MIN_ACCOUNTS qualify.
 *
 * CHURN TIMESTAMP: filters on accounts.churned_at — the real moment of
 * churn, DB-trigger-stamped on the status transition into 'churned' (see
 * migration 20260624000000_account_churned_at.sql). This replaced the old
 * updated_at proxy, which drifted on every field edit of an already-churned
 * row and made stale losses look fresh.
 *
 * FAIL-SAFE on null: a churned account whose churned_at is null (a legacy
 * row not covered by the one-time backfill) is EXCLUDED by the >= comparator
 * — SQL null is not >= the cutoff. So the bridge stays quiet for it rather
 * than guessing a churn date and triggering a false suggestion. Fail-safe,
 * not fail-loud.
 */
export async function detectChurnClusters(
  orgId: string,
): Promise<ChurnCluster[]> {
  const supabase = createBridgeSupabase();
  const sinceIso = new Date(
    Date.now() - BRIDGE_CHURN_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Step 1: churned accounts in the window. Filter on churned_at (the real
  // churn moment); null churned_at rows fall out of the >= comparator —
  // intended fail-safe (see doc comment above).
  const { data: churned, error: chErr } = await supabase
    .from("accounts")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "churned")
    .gte("churned_at", sinceIso);
  if (chErr) {
    throw new BridgeUnavailableError(
      `Could not read churned accounts: ${chErr.message}`,
    );
  }
  if (!churned || churned.length === 0) return [];

  const accountIds = churned.map((a) => a.id);

  // Step 2: latest health score per account. We do ONE select + dedup in
  // JS — keeps the query simple and one round trip.
  const { data: scores, error: scErr } = await supabase
    .from("account_health_scores")
    .select("*")
    .eq("org_id", orgId)
    .in("account_id", accountIds)
    .order("analyzed_at", { ascending: false });
  if (scErr) {
    throw new BridgeUnavailableError(
      `Could not read account_health_scores: ${scErr.message}`,
    );
  }
  if (!scores || scores.length === 0) return [];

  // Pick the FIRST score per account (latest by analyzed_at desc).
  const latestPerAccount = new Map<string, AccountHealthRow>();
  for (const s of scores) {
    if (!latestPerAccount.has(s.account_id)) {
      latestPerAccount.set(s.account_id, s);
    }
  }

  // Step 3: group accounts by strongest signal type.
  const buckets = new Map<string, string[]>();
  for (const accountId of accountIds) {
    const latest = latestPerAccount.get(accountId);
    if (!latest) continue;
    const sigType = pickStrongestSignalType(latest.signals);
    if (!sigType) continue;
    if (!buckets.has(sigType)) buckets.set(sigType, []);
    buckets.get(sigType)!.push(accountId);
  }

  const clusters: ChurnCluster[] = [];
  for (const [signalType, ids] of buckets) {
    if (ids.length >= BRIDGE_CHURN_MIN_ACCOUNTS) {
      clusters.push({
        signalType,
        accountIds: ids,
        windowDays: BRIDGE_CHURN_WINDOW_DAYS,
      });
    }
  }
  return clusters;
}

// ── Detector → persistence orchestration ───────────────────────────────────

function toBridgeSuggestion(row: BridgeSuggestionRow): BridgeSuggestion {
  return {
    id: row.id,
    orgId: row.org_id,
    sourceModule: row.source_module,
    sourceRefs: (row.source_refs as unknown as BridgeSourceRefs) ?? {},
    kind: row.kind,
    derivedGoal: row.derived_goal,
    segment: row.segment,
    status: row.status,
    approvedPlanId: row.approved_plan_id,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  };
}

/**
 * Scan an org for churn clusters and persist new suggestions. De-dup:
 * for each detected cluster, skip if a pending OR approved suggestion
 * already exists for (org_id, kind='churn_cluster',
 * source_refs->>signalType). Dismissed suggestions DO NOT block re-
 * detection (the user explicitly rejected the previous one, but a new
 * cluster on the same signal type is a fresh signal worth surfacing).
 *
 * Each new cluster triggers ONE Opus call (deriveResearchGoalFromCluster).
 * Suggestions with derivable=false are still persisted — the UI shows
 * them so the user can write their own goal manually.
 */
export interface ScanResult {
  scanned: number;
  created: number;
  skipped: number;
  failed: number;
}

export async function detectAndPersistChurnSuggestions(
  orgId: string,
  model: string = process.env.BRIDGE_MODEL ?? DEFAULT_BRIDGE_MODEL,
): Promise<ScanResult> {
  const clusters = await detectChurnClusters(orgId);
  if (clusters.length === 0) {
    return { scanned: 0, created: 0, skipped: 0, failed: 0 };
  }

  const supabase = createBridgeSupabase();
  let created = 0;
  let skipped = 0;
  let failed = 0;

  // Fetch existing pending/approved suggestions once and dedup in JS —
  // simpler than per-cluster round trips. The set is small for any
  // realistic org.
  const { data: existing, error: exErr } = await supabase
    .from("bridge_suggestions")
    .select("*")
    .eq("org_id", orgId)
    .eq("kind", "churn_cluster")
    .in("status", ["pending", "approved"]);
  if (exErr) {
    throw new BridgeUnavailableError(
      `Could not check existing suggestions: ${exErr.message}`,
    );
  }
  const existingSignalTypes = new Set<string>();
  for (const row of existing ?? []) {
    const refs = row.source_refs as unknown as ChurnClusterRefs;
    if (refs?.signalType) existingSignalTypes.add(refs.signalType);
  }

  for (const cluster of clusters) {
    if (existingSignalTypes.has(cluster.signalType)) {
      skipped++;
      continue;
    }

    let derived: DerivedGoal;
    try {
      derived = await deriveResearchGoalFromCluster(
        {
          signalType: cluster.signalType,
          accountCount: cluster.accountIds.length,
          windowDays: cluster.windowDays,
        },
        model,
      );
    } catch (err) {
      console.error(
        `[bridge] derivation failed for signalType=${cluster.signalType}:`,
        err instanceof Error ? err.message : err,
      );
      failed++;
      continue;
    }

    const refs: ChurnClusterRefs = {
      kind: "churn_cluster",
      signalType: cluster.signalType,
      accountIds: cluster.accountIds,
      windowDays: cluster.windowDays,
    };

    const { error: insErr } = await supabase
      .from("bridge_suggestions")
      .insert({
        org_id: orgId,
        source_module: "cs_health",
        source_refs: refs as unknown as Json,
        kind: "churn_cluster",
        derived_goal: derived.derivable ? derived.goal : null,
        segment: null,
        status: "pending",
      });
    if (insErr) {
      console.error(
        `[bridge] failed to insert suggestion for signalType=${cluster.signalType}:`,
        insErr.message,
      );
      failed++;
      continue;
    }
    created++;
  }

  return { scanned: clusters.length, created, skipped, failed };
}

// ── List + dismiss ─────────────────────────────────────────────────────────

export async function listBridgeSuggestions(
  orgId: string,
): Promise<BridgeSuggestion[]> {
  const supabase = createBridgeSupabase();
  const { data, error } = await supabase
    .from("bridge_suggestions")
    .select("*")
    .eq("org_id", orgId)
    .in("status", ["pending"])
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(toBridgeSuggestion);
}

export async function dismissBridgeSuggestion(
  orgId: string,
  suggestionId: string,
): Promise<BridgeSuggestion | null> {
  const supabase = createBridgeSupabase();
  const { data, error } = await supabase
    .from("bridge_suggestions")
    .update({
      status: "dismissed",
      decided_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", suggestionId)
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return toBridgeSuggestion(data);
}

// ── Approve → research_plan + generateInterviewGuide ───────────────────────

export interface ApproveResult {
  /** The newly created research_plan id. Always present on a successful
   *  approve, even if the subsequent generateInterviewGuide call failed. */
  planId: string;
  /** True iff generateInterviewGuide succeeded. False means the plan was
   *  created (with the derived goal as objective) but topics weren't
   *  auto-filled; the user can regenerate from the plan's edit screen. */
  guideGenerated: boolean;
  /** When guideGenerated=false: a short reason string. Null on success. */
  guideError: string | null;
}

/**
 * Approve a pending suggestion:
 *   1. Verify status='pending' (idempotency: a second approve on the same
 *      suggestion returns conflict-like null).
 *   2. Create a research_plan-draft via createResearchPlan with the
 *      derived_goal as objective and an empty topics array (the agent
 *      reads topics; we'll fill them in step 3 via the existing guide
 *      generator).
 *   3. Call generateInterviewGuide — same entry the new-plan UI uses;
 *      it writes the generated topics into the plan in-place.
 *   4. Update the suggestion: status='approved', approved_plan_id,
 *      decided_at.
 *
 * If step 3 fails (Opus unavailable, schema lost twice), step 4 still
 * runs — the plan IS created, the user just needs to retry guide-gen
 * from the plan-edit screen. We expose this through ApproveResult.
 *
 * If derived_goal is null (the LLM said derivable=false during scan),
 * we still allow approve: the plan is created with a fallback objective
 * naming the cluster, and the user can edit before invoking guide-gen.
 */
export async function approveBridgeSuggestion(
  orgId: string,
  suggestionId: string,
): Promise<ApproveResult | null> {
  const supabase = createBridgeSupabase();
  const { data: row, error: rowErr } = await supabase
    .from("bridge_suggestions")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", suggestionId)
    .maybeSingle();
  if (rowErr || !row) return null;
  if (row.status !== "pending") return null;

  const refs = row.source_refs as unknown as ChurnClusterRefs;
  const signalLabel = refs?.signalType
    ? germanLabelFor(refs.signalType)
    : "CS-Churn-Muster";
  const accountCount = refs?.accountIds?.length ?? 0;

  // Derive a usable title + objective even when the LLM-derived goal is
  // null. The user can rename/rephrase before saving the plan; we just
  // need a non-empty seed so createResearchPlan + generateInterviewGuide
  // have something to work with.
  const title = `Churn-Studie: ${signalLabel}`;
  const fallbackObjective =
    accountCount > 0
      ? `Verstehen, warum ${signalLabel} bei ${accountCount} verlorenen Accounts in den letzten ${refs?.windowDays ?? BRIDGE_CHURN_WINDOW_DAYS} Tagen zu Kündigungen geführt hat.`
      : `Verstehen, welche Rolle ${signalLabel} bei jüngsten Kündigungen gespielt hat.`;
  const objective = row.derived_goal?.trim()
    ? row.derived_goal.trim()
    : fallbackObjective;

  const plan = await createResearchPlan(orgId, {
    title,
    objective,
    topics: [],
    persona: row.segment,
    sampleTarget: null,
  });

  let guideGenerated = false;
  let guideError: string | null = null;
  try {
    await generateInterviewGuide({
      orgId,
      planId: plan.id,
      goal: objective,
      segment: row.segment ?? undefined,
      language: "de",
    });
    guideGenerated = true;
  } catch (err) {
    guideError =
      err instanceof GuideGeneratorUnavailableError
        ? err.message
        : err instanceof Error
          ? err.message
          : "unknown";
    console.error(
      `[bridge] generateInterviewGuide failed for plan ${plan.id}:`,
      guideError,
    );
  }

  // Mark suggestion approved + link to the plan. Done in any case — the
  // plan exists; the suggestion's lifecycle is closed.
  const { error: upErr } = await supabase
    .from("bridge_suggestions")
    .update({
      status: "approved",
      approved_plan_id: plan.id,
      decided_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", suggestionId);
  if (upErr) {
    console.error(
      `[bridge] failed to mark suggestion ${suggestionId} approved:`,
      upErr.message,
    );
  }

  // Defense-in-depth: verify the plan exists under this org. Should always
  // succeed since we just wrote it; the read confirms the org-scope chain.
  const verify = await getResearchPlan(orgId, plan.id);
  if (!verify) {
    throw new BridgeUnavailableError(
      `Plan ${plan.id} created but not readable under org ${orgId}`,
    );
  }

  return { planId: plan.id, guideGenerated, guideError };
}

// Re-export the enum so the eval + UI don't need a second import path.
export { RISK_SIGNAL_TYPES };
